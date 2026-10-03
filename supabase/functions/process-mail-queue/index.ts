import { createClient } from "npm:@supabase/supabase-js@2";
import { sendTransactionalEmail, type MailJob } from "./brevo-client.ts";
import { reconcileJobs } from "./reconcile.ts";
import { checkBrevoReadiness } from "./readiness.ts";
import { prepareParticipantAuthMail } from "./participant-auth-mail.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const apiKey = Deno.env.get("BREVO_API_KEY") ?? "";
const secret = Deno.env.get("MAIL_QUEUE_SECRET") ?? "";
const senderEmail = Deno.env.get("MAIL_SENDER_EMAIL") ?? "";
const senderName = Deno.env.get("MAIL_SENDER_NAME") ?? "AERO";
const replyToEmail = Deno.env.get("MAIL_REPLY_TO_EMAIL") ?? "";
const authMailKey = Deno.env.get("AUTH_MAIL_PAYLOAD_KEY") ?? "";
const allowlist = new Set((Deno.env.get("MAIL_TEST_ALLOWLIST") ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));

Deno.serve(async (request) => {
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (Deno.env.get("MAIL_QUEUE_ENABLED") !== "true")
    return Response.json({ enabled: false });
  const mailEnv = Deno.env.get("MAIL_ENV");
  if (mailEnv !== "test" && mailEnv !== "production")
    return new Response("MAIL_ENV must be test or production", { status: 503 });
  if (mailEnv === "production" && Deno.env.get("BREVO_CONTRACT_VERIFIED") !== "true")
    return new Response("Brevo account contract not verified", { status: 503 });
  if (!url || !serviceKey || !apiKey || !senderEmail || !replyToEmail)
    return new Response("Configuration incomplete", { status: 503 });
  if (mailEnv === "test" && allowlist.size === 0)
    return new Response("Test recipient allowlist missing", { status: 503 });
  let input: { action?: string; batchId?: string; limit?: number };
  try {
    const raw = await request.text();
    input = raw ? JSON.parse(raw) : {};
  } catch { return new Response("Invalid request", { status: 400 }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return new Response("Invalid request", { status: 400 });
  if (Object.keys(input).some((key) => !["action", "batchId", "limit"].includes(key))
    || (Object.hasOwn(input, "limit") && !Object.hasOwn(input, "batchId")))
    return new Response("Invalid request", { status: 400 });
  if (input.action === "health") {
    const result = await checkBrevoReadiness(apiKey, senderEmail);
    return result.ready ? Response.json({ enabled: true }) : Response.json({ enabled: false, ...result }, { status: 503 });
  }
  if (input.action !== undefined) return new Response("Invalid action", { status: 400 });
  const targeted = Object.hasOwn(input, "batchId");
  if (targeted && (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.batchId!)
    || !Number.isInteger(input.limit) || input.limit! < 1 || input.limit! > 20))
    return new Response("Invalid batch request", { status: 400 });
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const workerId = crypto.randomUUID();
  let reconciled = 0;
  try { if (!targeted) reconciled = await reconcileJobs(db, apiKey); }
  catch { /* A later invocation resumes reconciliation. Sending remains conservative. */ }
  let accepted = 0;
  let processed = 0;
  let failed = 0;
  let uncertain = 0;
  let blocked = false;
  let lastError: string | undefined;
  for (let count = 0; count < (targeted ? input.limit! : 20); count++) {
    const { data: jobs, error } = targeted
      ? await db.rpc("claim_batch_mail_jobs", { p_worker: workerId, p_batch_id: input.batchId, p_limit: 1 })
      : await db.rpc("claim_mail_jobs", { p_worker: workerId, p_limit: 1 });
    if (error) return Response.json({ enabled: false, processed, accepted, code: "MAIL_QUEUE_UNAVAILABLE",
      error: "Gönderim kayıtlarına erişilemedi. Durumu kontrol edin." }, { status: 503 });
    const job = (jobs as (MailJob & { id: string })[] | null)?.[0];
    if (!job) break;
    processed++;
    if (allowlist.size && !allowlist.has(job.recipient_email.toLowerCase())) {
      const marked = await db.rpc("mark_mail_job", { p_job_id: job.id, p_worker: workerId,
        p_status: "failed", p_error: "Alıcı test izin listesinde değil." });
      if (marked.error || marked.data !== true) return Response.json({ enabled: false, processed, accepted,
        code: "MAIL_RESULT_UNCONFIRMED", error: "Gönderim sonucu kaydedilemedi. Yeniden göndermeden önce kayıtları kontrol edin." }, { status: 503 });
      failed++;
      continue;
    }
    let outgoing = job;
    if (job.kind === "participant_auth" || job.kind === "acceptance") {
      try { outgoing = await prepareParticipantAuthMail(db, job, authMailKey); }
      catch {
        const marked = await db.rpc("mark_mail_job", { p_job_id: job.id, p_worker: workerId, p_status: "failed", p_error: "Hesap bağlantısı hazırlanamadı." });
        if (marked.error || marked.data !== true) return Response.json({ enabled: false, processed, accepted, code: "MAIL_RESULT_UNCONFIRMED", error: "Gönderim sonucu kaydedilemedi." }, { status: 503 });
        failed++;
        continue;
      }
    }
    const result = await sendTransactionalEmail(outgoing, { apiKey, senderEmail, senderName, replyToEmail });
    const status = result.kind === "accepted" ? "provider_accepted"
      : result.kind === "quota" ? "quota_wait"
      : result.kind === "rate" || result.kind === "config" ? "queued"
      : result.kind === "failed" ? "failed" : "uncertain";
    const next = result.kind === "rate" ? new Date(Date.now() + (result.retryAfter ?? 60) * 1000).toISOString()
      : result.kind === "quota" ? new Date(Date.now() + 15 * 60_000).toISOString()
      : result.kind === "config" ? new Date(Date.now() + 60 * 60_000).toISOString()
      : new Date(Date.now() + 60_000).toISOString();
    const marked = await db.rpc("mark_mail_job", { p_job_id: job.id, p_worker: workerId,
      p_status: status, p_message_id: result.kind === "accepted" ? result.messageId : null,
      p_error: result.kind === "accepted" ? null : result.reason, p_next_attempt: next });
    if (marked.error || marked.data !== true) return Response.json({ enabled: false, processed, accepted,
      code: "MAIL_RESULT_UNCONFIRMED", error: "Gönderim sonucu kaydedilemedi. Yeniden göndermeden önce kayıtları kontrol edin." }, { status: 503 });
    if (result.kind === "accepted") accepted++;
    if (result.kind === "failed") failed++;
    if (result.kind === "uncertain") uncertain++;
    if (result.kind !== "accepted") lastError = result.reason;
    if (result.kind === "rate" || result.kind === "quota" || result.kind === "config") { blocked = true; break; }
  }
  return Response.json({ enabled: true, processed, accepted, reconciled, failed, uncertain, blocked, error: lastError });
});

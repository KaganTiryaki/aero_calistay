import { createClient } from "npm:@supabase/supabase-js@2";
import { sendTransactionalEmail, type MailJob } from "./brevo-client.ts";
import { reconcileJobs } from "./reconcile.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const apiKey = Deno.env.get("BREVO_API_KEY") ?? "";
const secret = Deno.env.get("MAIL_QUEUE_SECRET") ?? "";
const senderEmail = Deno.env.get("MAIL_SENDER_EMAIL") ?? "";
const senderName = Deno.env.get("MAIL_SENDER_NAME") ?? "AERO";
const replyToEmail = Deno.env.get("MAIL_REPLY_TO_EMAIL") ?? "";
const allowlist = new Set((Deno.env.get("MAIL_TEST_ALLOWLIST") ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));

Deno.serve(async (request) => {
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
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
  let input: { action?: string; batchId?: string; limit?: number } = {};
  try { input = await request.json(); } catch { /* Scheduled calls may have no body. */ }
  if (input.action === "health") return Response.json({ enabled: true });
  const targeted = typeof input.batchId === "string";
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
  for (let count = 0; count < (targeted ? input.limit! : 20); count++) {
    const { data: jobs, error } = targeted
      ? await db.rpc("claim_batch_mail_jobs", { p_worker: workerId, p_batch_id: input.batchId, p_limit: 1 })
      : await db.rpc("claim_mail_jobs", { p_worker: workerId, p_limit: 1 });
    if (error) return new Response("Queue unavailable", { status: 503 });
    const job = (jobs as (MailJob & { id: string })[] | null)?.[0];
    if (!job) break;
    processed++;
    if (allowlist.size && !allowlist.has(job.recipient_email.toLowerCase())) {
      await db.rpc("mark_mail_job", { p_job_id: job.id, p_worker: workerId,
        p_status: "failed", p_error: "Alıcı test izin listesinde değil." });
      continue;
    }
    const result = await sendTransactionalEmail(job, { apiKey, senderEmail, senderName, replyToEmail });
    const status = result.kind === "accepted" ? "provider_accepted"
      : result.kind === "quota" ? "quota_wait"
      : result.kind === "rate" || result.kind === "config" ? "queued"
      : result.kind === "failed" ? "failed" : "uncertain";
    const next = result.kind === "rate" ? new Date(Date.now() + (result.retryAfter ?? 60) * 1000).toISOString()
      : result.kind === "quota" ? new Date(Date.now() + 15 * 60_000).toISOString()
      : result.kind === "config" ? new Date(Date.now() + 60 * 60_000).toISOString()
      : new Date(Date.now() + 60_000).toISOString();
    await db.rpc("mark_mail_job", { p_job_id: job.id, p_worker: workerId,
      p_status: status, p_message_id: result.kind === "accepted" ? result.messageId : null,
      p_error: result.kind === "accepted" ? null : result.reason, p_next_attempt: next });
    if (result.kind === "accepted") accepted++;
    if (result.kind === "rate" || result.kind === "quota" || result.kind === "config") break;
  }
  return Response.json({ enabled: true, processed, accepted, reconciled });
});

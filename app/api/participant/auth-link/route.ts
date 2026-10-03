import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { json, protectMutation } from "@/lib/http";
import { requestMetadata } from "@/lib/activity/metadata";
import { callMailWorker } from "@/lib/mail/dispatch";

const inputSchema = z.object({ email: z.email().max(254) });
const generic = { ok: true, message: "Hesabınız varsa bağlantı e-postanıza gönderildi." };
function hash(value: string) {
  const secret = process.env.PARTICIPANT_AUTH_LINK_HMAC_KEY;
  if (!secret || secret.length < 32) throw new Error("AUTH_LINK_NOT_CONFIGURED");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return json(generic, 202);
    const email = parsed.data.email.trim().toLowerCase();
    const ip = requestMetadata(request.headers).ipAddress;
    if (!ip) return json({ error: "İstek doğrulanamadı." }, 503);
    const client = createAdminSupabase();
    const { data: reservation, error: reserveError } = await client.rpc("reserve_participant_auth_link", {
      p_email_hash: hash(`email:${email}`), p_ip_hash: hash(`ip:${ip}`), p_purpose: "recovery",
    });
    if (reserveError) throw reserveError;
    const row = Array.isArray(reservation) ? reservation[0] : reservation;
    if (!row?.allowed) return json({ error: generic.message, retryAfter: row?.wait_seconds ?? 60 }, 429);
    const { data: userId, error: identityError } = await client.rpc("find_auth_user_by_email", { p_email: email });
    if (identityError) throw identityError;
    if (!userId) return json(generic, 202);
    const { data: membership, error: membershipError } = await client.from("participant_memberships").select("application_id").eq("user_id", userId).maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return json(generic, 202);
    const health = await callMailWorker({ action: "health" });
    if (!health.ready) return json(generic, 202);
    const { data: link, error: linkError } = await client.auth.admin.generateLink({ type: "recovery", email });
    if (linkError || !link.properties.hashed_token) return json(generic, 202);
    const { data: app, error: appError } = await client.from("applications").select("event_id").eq("id", membership.application_id).single();
    if (appError) throw appError;
    const { data: event, error: eventError } = await client.from("events").select("participant_portal_url").eq("id", app.event_id).single();
    if (eventError || !event?.participant_portal_url) throw eventError ?? new Error("PORTAL_NOT_CONFIGURED");
    const tokenUrl = `${event.participant_portal_url}/aktivasyon?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=recovery`;
    const payload = { email, url: tokenUrl, expiresAt: new Date(Date.now() + 60 * 60_000).toISOString() };
    const mailKey = Buffer.from(process.env.AUTH_MAIL_PAYLOAD_KEY ?? "", "base64");
    if (mailKey.length !== 32) throw new Error("AUTH_MAIL_KEY_INVALID");
    const { createCipheriv, randomBytes } = await import("node:crypto");
    const nonce = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", mailKey, nonce);
    cipher.setAAD(Buffer.from(membership.application_id));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
    const { data: jobId, error: queueError } = await client.rpc("queue_participant_auth_mail", { p_user_id: userId,
      p_application_id: membership.application_id, p_nonce: nonce.toString("base64"), p_ciphertext: ciphertext.toString("base64"),
      p_auth_tag: cipher.getAuthTag().toString("base64"), p_expires_at: payload.expiresAt });
    if (queueError) throw queueError;
    const { data: job, error: jobError } = await client.from("mail_jobs").select("batch_id").eq("id", jobId).single();
    if (jobError || !job) throw jobError ?? new Error("AUTH_MAIL_JOB_MISSING");
    await callMailWorker({ batchId: job.batch_id, limit: 1 });
    return json(generic, 202);
  } catch {
    return json({ error: "Bağlantı şu an oluşturulamadı. Lütfen daha sonra tekrar deneyin." }, 503);
  }
}

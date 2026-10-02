import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
type Db = SupabaseClient;
type Job = { id: string; tag: string; recipient_email: string; provider_message_id: string | null; status: string; first_send_at: string; next_attempt_at: string };
type BrevoEvent = { date: string; email: string; event: string; messageId: string; tag?: string | string[] };

async function fingerprint(event: { messageId: string; email: string; event: string; date: string }): Promise<string> {
  const value = JSON.stringify([event.messageId.trim().replace(/^<|>$/g, "").toLowerCase(), event.email.trim().toLowerCase(), event.event, new Date(event.date).toISOString()]);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nextCheck(firstSend: string): string {
  const age = Date.now() - new Date(firstSend).getTime();
  const delay = age < 10 * 60_000 ? 60_000 : age < 60 * 60_000 ? 5 * 60_000 : 60 * 60_000;
  return new Date(Date.now() + delay).toISOString();
}

export async function reconcileJobs(db: Db, apiKey: string): Promise<number> {
  const { data: jobs, error } = await db.from("mail_jobs")
    .select("id,tag,recipient_email,provider_message_id,status,first_send_at,next_attempt_at")
    .in("status", ["provider_accepted", "uncertain", "sent"])
    .lte("next_attempt_at", new Date().toISOString()).order("next_attempt_at").limit(20);
  if (error) throw error;
  let matched = 0;
  for (const job of (jobs ?? []) as Job[]) {
    let complete = true;
    for (let offset = 0; ; offset += 1000) {
      const query = new URLSearchParams({ email: job.recipient_email, days: "30", limit: "1000",
        offset: String(offset), tags: JSON.stringify([job.tag]) });
      if (job.provider_message_id) query.set("messageId", job.provider_message_id);
      const response = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?${query}`, {
        headers: { "api-key": apiKey, Accept: "application/json" }, signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) { complete = false; break; }
      const report = await response.json() as { events?: BrevoEvent[] };
      if (!report || (report.events !== undefined && !Array.isArray(report.events))) { complete = false; break; }
      for (const event of report.events ?? []) {
        if (!event || typeof event.email !== "string" || typeof event.messageId !== "string"
          || typeof event.event !== "string" || typeof event.date !== "string") continue;
        if (!(Array.isArray(event.tag) ? event.tag.includes(job.tag) : event.tag === job.tag)
          || event.email.toLowerCase() !== job.recipient_email.toLowerCase()) continue;
        if (job.provider_message_id && event.messageId.trim().replace(/^<|>$/g, "").toLowerCase() !==
          job.provider_message_id.trim().replace(/^<|>$/g, "").toLowerCase()) continue;
        if (Number.isNaN(new Date(event.date).getTime())) continue;
        const { data: recorded, error: recordError } = await db.rpc("record_mail_event", {
          p_fingerprint: await fingerprint(event), p_tag: job.tag, p_message_id: event.messageId,
          p_email: event.email, p_event: event.event, p_provider_time: event.date,
        });
        if (recordError || recorded !== true) { complete = false; break; }
        matched++;
      }
      if (!complete || !report.events || report.events.length < 1000) break;
    }
    if (complete) {
      const { error: updateError } = await db.from("mail_jobs")
        .update({ next_attempt_at: nextCheck(job.first_send_at) }).eq("id", job.id)
        .in("status", ["provider_accepted", "uncertain", "sent"]);
      if (updateError) throw updateError;
    }
  }
  await db.from("mail_provider_state").update({ reconciliation_heartbeat_at: new Date().toISOString() }).eq("id", 1);
  return matched;
}

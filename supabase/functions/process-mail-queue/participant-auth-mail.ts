import type { MailJob } from "./brevo-client.ts";

type Payload = { application_id: string; nonce: string; ciphertext: string; auth_tag: string; expires_at: string; recipient_email: string };
type QueryResult = { data: Payload[] | null; error: unknown };
type AuthDatabase = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
  auth?: { admin: { generateLink(input: { type: "invite" | "magiclink"; email: string }): Promise<{ data: { properties: { hashed_token?: string } } | null; error: unknown }> } };
  from?(table: string): { select(columns: string): { eq(column: string, value: unknown): { single(): Promise<{ data: Record<string, unknown> | null; error: unknown }> } } };
};

function decode(value: string) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }
export async function prepareParticipantAuthMail(db: AuthDatabase, job: MailJob, secret: string, now = Date.now()): Promise<MailJob> {
  const { data, error } = await db.rpc("read_participant_auth_mail", { p_job_id: job.id });
  if (error) throw new Error("AUTH_MAIL_PAYLOAD_UNAVAILABLE");
  let row = data?.[0];
  if (!row && job.kind === "acceptance" && db.auth && db.from) {
    const { data: app, error: appError } = await db.from("applications").select("id,event_id,status,email").eq("id", job.application_id).single();
    const { data: identity, error: identityError } = await db.rpc("participant_auth_identity", { p_application_id: job.application_id });
    const { data: event, error: eventError } = await db.from("events").select("participant_portal_url").eq("id", app?.event_id).single();
    if (appError || identityError || eventError || !app || app.status !== "accepted_pending_payment" || app.email !== job.recipient_email || !event?.participant_portal_url)
      throw new Error("AUTH_MAIL_PAYLOAD_INVALID");
    const type = identity ? "magiclink" : "invite";
    const { data: generated, error: generateError } = await db.auth.admin.generateLink({ type, email: app.email });
    if (generateError || !generated?.properties.hashed_token) throw new Error("AUTH_MAIL_GENERATE_FAILED");
    const material = decode(secret); if (material.byteLength !== 32) throw new Error("AUTH_MAIL_KEY_INVALID");
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const expiresAt = new Date(now + 60 * 60_000).toISOString();
    const payload = { email: app.email as string, url: `${event.participant_portal_url as string}/aktivasyon?token_hash=${encodeURIComponent(generated.properties.hashed_token)}&type=${type}`, expiresAt };
    const key = await crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt"]);
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode(app.id), tagLength: 128 }, key, new TextEncoder().encode(JSON.stringify(payload))));
    const { data: stored, error: storeError } = await db.rpc("store_participant_auth_mail", { p_job_id: job.id, p_application_id: app.id,
      p_nonce: btoa(String.fromCharCode(...nonce)), p_ciphertext: btoa(String.fromCharCode(...encrypted.slice(0,-16))),
      p_auth_tag: btoa(String.fromCharCode(...encrypted.slice(-16))), p_expires_at: expiresAt });
    if (storeError || stored !== true) throw new Error("AUTH_MAIL_STORE_UNCONFIRMED");
    const { data: reread, error: rereadError } = await db.rpc("read_participant_auth_mail", { p_job_id: job.id });
    if (rereadError || !reread?.length) throw new Error("AUTH_MAIL_PAYLOAD_UNAVAILABLE");
    row = reread[0];
  }
  if (!row) throw new Error("AUTH_MAIL_PAYLOAD_UNAVAILABLE");
  if (row.recipient_email.toLowerCase() !== job.recipient_email.toLowerCase() || Date.parse(row.expires_at) <= now)
    throw new Error("AUTH_MAIL_PAYLOAD_INVALID");
  const material = decode(secret);
  if (material.byteLength !== 32) throw new Error("AUTH_MAIL_KEY_INVALID");
  const key = await crypto.subtle.importKey("raw", material, "AES-GCM", false, ["decrypt"]);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(row.nonce), additionalData: new TextEncoder().encode(row.application_id), tagLength: 128 }, key,
    new Uint8Array([...decode(row.ciphertext), ...decode(row.auth_tag)]));
  const payload = JSON.parse(new TextDecoder().decode(clear)) as { email: string; url: string; expiresAt: string };
  const url = new URL(payload.url);
  if (payload.email.toLowerCase() !== job.recipient_email.toLowerCase() || Date.parse(payload.expiresAt) <= now || url.protocol !== "https:" || !url.pathname.endsWith("/aktivasyon"))
    throw new Error("AUTH_MAIL_PAYLOAD_INVALID");
  return { ...job, html_content: `${job.html_content}<p><a href="${url.toString()}">Hesabım için güvenli bağlantı</a></p>`,
    text_content: `${job.text_content}\n\nHesabım için güvenli bağlantı: ${url.toString()}` };
}

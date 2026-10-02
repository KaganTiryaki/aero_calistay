export type MailJob = {
  id?: string;
  recipient_email: string;
  subject: string;
  html_content: string;
  text_content: string;
  tag: string;
  idempotency_key: string;
};

export type BrevoConfig = {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  replyToEmail: string;
};

export type SendResult =
  | { kind: "accepted"; messageId: string }
  | { kind: "quota" | "rate" | "failed" | "uncertain" | "config"; reason: string; retryAfter?: number };

export async function sendTransactionalEmail(
  job: MailJob,
  config: BrevoConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  let response: Response;
  try {
    response = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": config.apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { email: config.senderEmail, name: config.senderName },
        replyTo: { email: config.replyToEmail },
        to: [{ email: job.recipient_email }],
        subject: job.subject,
        htmlContent: job.html_content,
        textContent: job.text_content,
        tags: [job.tag],
        headers: { "Idempotency-Key": job.idempotency_key },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { kind: "uncertain", reason: "Sağlayıcı yanıtı alınamadı; olayları araştırın." };
  }
  let body: { messageId?: string; code?: string; message?: string } = {};
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed;
  } catch { /* Absence of a parseable body is handled below. */ }
  if (response.status === 201 && typeof body.messageId === "string" && body.messageId.trim())
    return { kind: "accepted", messageId: body.messageId };
  if (response.status === 201 || response.status >= 500 || body.code === "duplicate_parameter")
    return { kind: "uncertain", reason: "Gönderim sonucu belirsiz; yeniden göndermeyin." };
  if (body.code === "not_enough_credits") return { kind: "quota", reason: "Günlük e-posta hakkı doldu." };
  if (response.status === 429) {
    const reset = Number(response.headers.get("x-sib-ratelimit-reset") || response.headers.get("retry-after") || 60);
    return { kind: "rate", reason: "Brevo hız sınırı.", retryAfter: Number.isFinite(reset) ? Math.max(1, reset) : 60 };
  }
  if (body.code === "invalid_email")
    return { kind: "failed", reason: "Alıcı e-posta adresi geçersiz." };
  if (response.status === 401 || response.status === 403) {
    const ipBlocked = typeof body.message === "string" && /\bip\b.*(?:address|unauthor|recogn|allow|block|whitelist)/i.test(body.message);
    return { kind: "config", reason: ipBlocked
      ? "Brevo bu sunucunun IP adresine izin vermiyor. Brevo güvenlik ayarlarını kontrol edin."
      : "Brevo gönderim erişimini reddetti. API anahtarını ve Brevo IP izinlerini kontrol edin; e-posta gönderilmedi." };
  }
  return { kind: "config", reason: body.code ? `Brevo hesabı veya gönderim ayarı: ${body.code}` : `Brevo hesap/gönderim hatası: HTTP ${response.status}` };
}

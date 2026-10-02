type Readiness = { ready: true } | { ready: false; code: string; error: string };

async function providerError(response: Response): Promise<Readiness> {
  let message = "";
  try { const body = await response.json(); message = typeof body?.message === "string" ? body.message : ""; } catch { /* Use HTTP status. */ }
  if (response.status === 401 || response.status === 403) {
    const ipBlocked = /\bip\b.*(?:address|unauthor|recogn|allow|block|whitelist)/i.test(message);
    return { ready: false, code: ipBlocked ? "BREVO_IP_BLOCKED" : "BREVO_AUTH_REJECTED",
      error: ipBlocked ? "Brevo bu sunucunun IP adresine izin vermiyor. Brevo güvenlik ayarlarını kontrol edin."
        : "Brevo erişimi reddetti. API anahtarını ve Brevo IP izinlerini kontrol edin; e-posta gönderilmedi." };
  }
  return { ready: false, code: "BREVO_UNAVAILABLE", error: "Brevo erişimi doğrulanamadı. Daha sonra yeniden deneyin." };
}

export async function checkBrevoReadiness(apiKey: string, senderEmail: string, fetchImpl: typeof fetch = fetch): Promise<Readiness> {
  try {
    const headers = { "api-key": apiKey, Accept: "application/json" };
    const account = await fetchImpl("https://api.brevo.com/v3/account", { headers, signal: AbortSignal.timeout(5000) });
    if (!account.ok) return providerError(account);
    const details = await account.json();
    if (details?.relay?.enabled !== true)
      return { ready: false, code: "BREVO_SMTP_INACTIVE", error: "Brevo işlem e-postası hesabı aktif değil." };
    const response = await fetchImpl("https://api.brevo.com/v3/senders", { headers, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return providerError(response);
    const body = await response.json();
    if (!Array.isArray(body?.senders) || !body.senders.some((sender: { email?: unknown; active?: unknown }) =>
      typeof sender.email === "string" && sender.email.toLowerCase() === senderEmail.toLowerCase() && sender.active === true))
      return { ready: false, code: "BREVO_SENDER_INACTIVE", error: "Brevo gönderici e-posta adresi doğrulanmamış veya aktif değil." };
    return { ready: true };
  } catch { return { ready: false, code: "BREVO_UNAVAILABLE", error: "Brevo erişimi doğrulanamadı. Daha sonra yeniden deneyin." }; }
}

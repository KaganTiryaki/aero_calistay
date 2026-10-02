type Reply = { enabled?: boolean; processed?: number; accepted?: number; failed?: number; uncertain?: number;
  blocked?: boolean; code?: string; error?: string };
export type DispatchResult = { ready: boolean; processed: number; accepted: number; failed: number;
  uncertain: number; blocked: boolean; code?: string; error?: string };
const unavailable: DispatchResult = { ready: false, processed: 0, accepted: 0, failed: 0, uncertain: 0,
  blocked: true, error: "Gönderim sonucu doğrulanamadı. Yeniden göndermeden önce Gönderimler bölümünü kontrol edin." };

export async function callMailWorker(input: { action: "health" } | { batchId: string; limit: number }): Promise<DispatchResult> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.MAIL_QUEUE_SECRET;
  if (!base || !secret) return { ...unavailable, error: "E-posta servisi yapılandırılmamış." };
  try {
    const response = await fetch(new URL("/functions/v1/process-mail-queue", base), {
      method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(input), cache: "no-store", signal: AbortSignal.timeout("action" in input ? 12000 : 45000),
    });
    const data = await response.json() as Reply;
    if (!data || typeof data !== "object") return { ...unavailable };
    const code = typeof data.code === "string" ? data.code.slice(0, 80) : undefined;
    const error = typeof data.error === "string" ? data.error.slice(0, 500) : undefined;
    if (!response.ok || data.enabled !== true) return { ...unavailable, code, error: error ?? unavailable.error };
    const processed = data.processed ?? 0, accepted = data.accepted ?? 0;
    const failed = data.failed ?? 0, uncertain = data.uncertain ?? 0;
    const limit = "action" in input ? 0 : input.limit;
    if (![processed, accepted, failed, uncertain].every((value) => Number.isSafeInteger(value) && value >= 0)
      || processed > limit || accepted + failed + uncertain > processed) return { ...unavailable };
    return { ready: true, processed, accepted, failed, uncertain, blocked: data.blocked === true, code, error };
  } catch { return { ...unavailable }; }
}

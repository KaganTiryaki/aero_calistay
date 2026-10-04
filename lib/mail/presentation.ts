export type MailPresentation = { label: string; tone: "good" | "wait" | "bad" | "neutral"; detail: string | null };
type MailJobView = { status: string; delivery_status: string; last_error: string | null };

export function presentMailJob(job: MailJobView): MailPresentation {
  const detail = job.last_error;
  const result = (label: string, tone: MailPresentation["tone"]): MailPresentation => ({label,tone,detail});
  if (["hard_bounced", "invalid"].includes(job.delivery_status)) return result("Adrese teslim edilemedi", "bad");
  if (["blocked", "complained", "unsubscribed"].includes(job.delivery_status)) return result("Gönderim engellendi", "bad");
  if (job.delivery_status === "delivered") return result("Teslim edildi", "good");
  if (["deferred", "soft_bounced"].includes(job.delivery_status)) return result("Teslimat gecikti", "wait");
  if (job.delivery_status === "error") return result("Teslimat sorunu", "bad");
  switch (job.status) {
    case "queued": return result("Gönderim sırası bekliyor", "wait");
    case "sending": return result("Gönderiliyor", "wait");
    case "provider_accepted": case "sent": return result("Gönderildi · teslimat bildirimi bekleniyor", "wait");
    case "quota_wait": return result("Günlük gönderim sınırına ulaşıldı", "wait");
    case "uncertain": return result("Gönderim sonucu kontrol ediliyor", "wait");
    case "failed": return result("Gönderilemedi", "bad");
    case "cancelled": return result("Gönderim iptal edildi", "neutral");
    default: return result("Durum kontrol ediliyor", "neutral");
  }
}

import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { json } from "@/lib/http";

export async function requireParticipant() {
  const { data, error } = await (await createServerSupabase()).auth.getUser();
  if (error || !data.user?.email_confirmed_at) throw new Error("FORBIDDEN");
  const client = createAdminSupabase();
  const { data: membership, error: memberError } = await client.from("participant_memberships")
    .select("application_id").eq("user_id", data.user.id).maybeSingle();
  if (memberError) throw memberError;
  if (!membership) throw new Error("FORBIDDEN");
  return { userId: data.user.id, applicationId: membership.application_id, client };
}

export function participantFailure(error: unknown) {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const known: Record<string, string> = {
    FORBIDDEN: "Bu işlem için erişiminiz yok. Hesabınıza yeniden giriş yapın.",
    NOT_REVIEWABLE: "Dekont henüz incelemeye hazır değil.", STALE_PAYMENT: "Dekont değişti. Listeyi yenileyin.",
    APPLICATION_INACTIVE: "Başvuru bu işlem için uygun durumda değil.", PAYMENT_PENDING: "Dekontunuz zaten inceleniyor.",
    INVALID_PAYMENT: "Banka referansı, tutar ve işlem tarihi zorunludur.", INSUFFICIENT: "Gelen tutar beklenen ödemeden az.",
    PAYMENT_NOT_CONFIGURED: "Ödeme ve katılımcı bağlantısı ayarlarını tamamlayın.", PAYMENT_EXPIRED: "Ödeme süresi doldu. Organizasyonla iletişime geçin.",
    INVALID_FILE: "Geçerli bir PDF, JPEG veya PNG yükleyin; en fazla 5 MiB.", UPLOAD_MISSING: "Dosya yüklemesi tamamlanmadı. Yeniden yükleyin.",
    REQUEST_CONFLICT: "Bu işlem daha önce farklı bilgilerle kaydedildi. Listeyi yenileyin.",
    STALE_APPLICATION: "Başvuru değişti. Listeyi yenileyin.", INVALID_REASON: "Bir düzeltme gerekçesi yazın.",
  };
  const code = Object.keys(known).find((key) => message.includes(key));
  if (code) return json({ error: known[code] }, code === "FORBIDDEN" ? 403 : 409);
  if (error && typeof error === "object" && "code" in error && error.code === "23505") return json({ error: "Bu banka işlemi zaten kullanılmış veya kayıt değişmiş. Listeyi yenileyin." }, 409);
  return json({ error: "İşlem tamamlanamadı. Bağlantıyı kontrol edip tekrar deneyin." }, 500);
}

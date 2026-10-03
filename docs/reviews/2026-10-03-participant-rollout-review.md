# Katılımcı hesabı ve ödeme akışı — uygulama ve canlıya geçiş raporu

Tarih: 3 Ekim 2026. Çalışma tabanı: `codex/immediate-mail-review` worktree'si. Bu rapor yerel uygulama değişikliklerini ve henüz karşılanmayan canlı geçiş koşullarını ayırır.

## Değişiklik özeti

- Katılımcı giriş/aktivasyon, kendi başvurusu, özel dekont yükleme ve doğrulanmış QR ekranları eklendi.
- Admin ödeme ayarları, dekont inceleme/onay/düzeltme ve öğün/personel ekranları eklendi. İlk onay `accepted_pending_payment` durumunda kalır; QR yalnız banka incelemesinden sonra `confirmed` durumuyla açılır.
- Yeni `202610030002_participant_payment_meals.sql`, var olan mail migration'ından sonraki numarayı kullanır. Çakışan kaynak migration çalışma kopyasından çıkarıldı. Eski migration dosyaları değiştirilmedi.
- Acceptance bağlantısı ve recovery payload'ı AES-256-GCM ile şifrelenerek iş kaydına bağlanır; worker alıcı ve sona erme denetimi yapar, mevcut health/quota/idempotency/sonuç-kayıt davranışlarını kullanır. Mevcut admin/mail UI ve endpoint'leri yeni durumlara uyarlandı.
- Form kaynaklı e-posta normalization'ı, yeni middleware yönlendirmeleri ve tarama sonuç kapısı bağlandı.

## Yerel doğrulama

| Kontrol | Sonuç |
|---|---|
| `npm.cmd test` | Başarılı: 100/100 |
| `$env:CI='1'; npm.cmd run lint` | Başarılı |
| `npx.cmd tsc --noEmit` | Başarılı |
| `npm.cmd run build` | Başarılı; 47 statik sayfa üretildi ve katılımcı/admin/personel rotaları çıktı |
| `git diff --check` | Başarılı (yalnızca Git satır sonu uyarıları var) |
| `deno check supabase/functions/process-mail-queue/index.ts` | Deno CLI bu çalışma ortamında bulunmuyor; doğrulanmadı |
| PGlite migration/RPC senaryoları | Test kümesinde başarılı; gerçek ayrı PostgreSQL bağlantı yarışı yerine geçmez |

Auth akışında mevcut magiclink ile recovery parolasını ayıran doğrulama eklendi. Panel-mail regresyon testlerinde görülen beş hata giderildi: sağlayıcı tanısı kaybolması, yetkisiz isteğin hatalı eşlenmesi, tekrar yanıtının yanlış sayımı, batch kimliği çakışmasında sağlayıcı çağrısı ve auth mail birim testinin tam tur koşusu. Son tam tur 100 testin tamamını geçti.

## Canlı geçiş durumu

Bu çalışma canlı Supabase şemasını, Auth/Storage ayarını veya secret'ları değiştirmedi; Edge Function ya da Next.js dağıtımı yapmadı; gerçek mail göndermedi. Başlangıçta planın belirttiği gibi `schema_migrations` tablosunun mevcut olmadığı önceki mail inceleme raporunda kayıtlıdır; bu uygulama turunda canlıyı yeniden sorgulamadım. O kaydı güncel canlı kanıtı saymayın.

Ayrı canlı geçiş öncesi zorunlu işler:

1. Canlı şema envanteri ve migration baseline/delta incelemesi; bu migration'ı körlemesine `db push` ile uygulamayın.
2. Eski kabul edilmiş kayıtlar ve aktif QR'ları banka onaylarıyla karşılaştırıp kayıt bazında geçiş kararı alın.
3. Migration'ı yedekli staging/gerçek Postgres ortamında sınayın; iki admin onay/onay ve onay/iptal yarışlarını ayrı bağlantılarda çalıştırın.
4. `PARTICIPANT_AUTH_LINK_HMAC_KEY` ve 32-byte base64 `AUTH_MAIL_PAYLOAD_KEY`'i güvenli ortamda üretip yerleştirin; Brevo worker ve yeni web deployment'ını özellikleri kapalı tutarak yayınlayın. Secret değerleri bu rapora yazılmaz.
5. Auth redirect allowlist, public signup kapalılığı, private Storage bucket/RLS, katılımcı portal URL'si, e-posta link takip/önizleme davranışı ve worker sağlık kontrolünü canlıda doğrulayın.
6. Kullanıcının belirleyeceği tek test alıcısıyla aktivasyon → giriş/recovery → dekont → kontrollü ödeme kararı → QR → öğün zincirini, gerçek mailbox ve provider event kayıtlarıyla doğrulayın. Test alıcısı/amacı ve canlı yayın yetkisi ayrıca belirlenmeden gönderim/açılış yapılmadı.
7. Android/iPhone gerçek cihaz/kamera, tarayıcı izinleri, ses/titreşim ve basılı QR testini yapın.

Deno CLI bulunmadığından Edge TypeScript statik kontrolü yerelde açık kaldı. Kabul işinde linki üretip şifreleme kaydına yazma/retry dalı için worker-level test de mevcut test setinde henüz kapsanmıyor. Payload temizliği/retention için migration'da otomatik silme görevi yok; canlı öncesi retention kararı ve temizleme görevi tasarlanıp denetlenmelidir. `claim_participant_account` ilk hesapta davetle ilişkilendirilen doğrulanmış email'i kullanır; aktivasyon linki olmadan davet sahiplenme canlı prova kapsamına dahil edilmedi.

## Çalışma alanı

- Temel kopya: `C:/Users/kağan/.codex/worktrees/immediate-mail-live/Users__kağan__Desktop__aero_cal`
- Kaynak katılımcı worktree'si değiştirilmedi.
- Tanıtım ana checkout'u değiştirilmedi.
- Temel worktree'deki `supabase/.temp/` korundu.
- Değişiklikler commit edilmedi; diff inceleme ve canlı yetkisi bekleyen yerel çalışma olarak duruyor.

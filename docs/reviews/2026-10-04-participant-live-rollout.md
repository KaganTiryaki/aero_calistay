# Katılımcı canlı yayın raporu — 4 Ekim 2026

Canlı domain: https://www.aerocalistay.org

## Yayın kanıtı

- Supabase: `gvojltalvboumhqjkvrr` / aero-calistay; mevcut proje kullanıldı.
- Web: `dpl_D6BuLLtFpu5jXrG6nqygjjmW7cuY`, READY; https://aero-calistay-hch0j8vm6-kagantiryakis-projects.vercel.app. www/apex production alias'ları doğrulandı.
- Kaynak snapshot: `a74e022`, manuel başvuru formu `41524a2`, son kuyruk/retention düzeltmeleri `1be2d82`. Son upload son düzeltmelerin stage edilmiş içeriğiyle başladı; kaynak içeriği sonra aynı şekilde 1be2d82'de commit edildi. Deployment Git metadata'sındaki önceki HEAD `9747c51` olduğundan kaynak snapshot ile metadata ayrımı korunur.
- Edge: process-mail-queue sürüm **10**, ACTIVE, artifact SHA256 `92ab41fc307244b9fca3ff4158f39f805ad4d7039342416bb11b6193de65f798`. Private queue bearer korunur; verify_jwt false olan eski sözleşme korunur.
- Git kaynak worktree ve ana tanıtım checkout'u değiştirilmedi. Push/merge yapılmadı. `supabase/.temp/` korunur.

## Şema ve ayarlar

- Canlı şema, tüm public veriler, Auth kullanıcı metadata'sı, Storage envanteri ve eski Edge kaynağı planın ignored çalışma alanında yedeklendi. Yedek manifesti: 14 public tablo, 2 başvuru, 2 mail işi, 1 admin/Auth kullanıcısı; 0 QR, 0 Storage objesi. Auth password/refresh token alınmadı.
- 002 enum ekleme ayrı commit sınırıyla uygulandı. 003–008 tek incelenmiş transaction ile; 009 provider_accepted payload retention düzeltmesi ayrıca uygulandı. Eski migration geçmişine kör db push yapılmadı.
- Private participant-receipts bucket oluşturuldu. Anon ödeme onayı ve authenticated şifreli payload okuması false olarak doğrulandı. RLS, rol/event bağları ve QR ödeme zorunluluğu test edildi.
- Participant rollout, acceptance, payment için Next ve DB kapıları önce kapalı yayınlandı. Next→DB→worker health 200 sonrası kapılar açıldı; son canlı health'te üç DB kapısı true.
- IBAN, tutar ve son tarih null bırakıldı. Portal `https://www.aerocalistay.org/katilimci`. Banka onayından önce pozitif başvuru tutarı tanımlanması zorunlu.
- Public Auth signup kapalı. Site URL production domain; redirect listesi yalnız gerekli www/apex callback ve aktivasyon rotaları. Login/verification limitleri 30.
- Yeni AES payload, Next HMAC ve ayrı monitor secret kriptografik rastgele üretildi. Mevcut Vercel/Supabase/Brevo sırlarının üzerine boş değer yazılmadı; sırlar rapor/commit'e alınmadı.
- Supabase free tier, varsayılan e-posta sağlayıcısıyla template değiştirmeyi reddetti. Ücretli plana geçilmedi/SMTP kimliği oluşturulmadı. Personel için mevcut code/hash oturum biçimi açık form submit'inden sonra ayrı server-side rol doğrulamasıyla desteklenir. Katılımcı davetleri mevcut Brevo worker üzerinden kendi token-hash bağlantısıyla çalışır.

## Zamanlanmış işler

- `aero-auth-payload-cleanup`: saatlik `0 * * * *`, ACTIVE. Scheduler gerçek çalıştırmasında succeeded görüldü; geçici 5 saniyelik doğrulama ardından saatlik plana döndürüldü. Süresi bitmiş kesin kabul edilmiş/terminal send payload'ları en geç 24 saat içinde temizlenir. Uncertain işlerin payload ve provider/audit kayıtları korunur.
- `aero-mail-reconcile`: `*/5 * * * *`, ACTIVE. Vault'ta ayrı monitor bearer saklanır. Endpoint yalnız uzlaştırma yapar; token üretmez/mail göndermez. Scheduler succeeded, net HTTP 200 ve yeni reconciliation heartbeat doğrulandı.
- Banka onayındaki confirmation işi ile yeniden kuyruğa alınan davetleri yönetici Gönderimler ekranındaki **Kuyruktaki e-postaları gönder** düğmesinden başlatabilir. İlk kabul ekranı ve katılımcı yeniden link isteği hedeflenen worker çağrısını doğrudan yapar. Belirsiz gönderimler otomatik yeniden gönderilmez.

## Doğrulama

- Son Node suite **138/138**, lint, TypeScript ve production build geçti. Worker gerçek Supabase SDK ile Deno check geçti. Son web düzeltmeleri Vercel production build'inde de doğrulandı.
- PostgreSQL 17.10 üzerinde gerçek canlı schema fixture + commit sınırları prova edildi; ayrı bağlantılarda çift onay tek review/QR/confirmation, onay/iptal yarışı cancelled + 0 aktif QR, eşzamanlı öğün taraması tek redemption üretti.
- Bağımsız final review timestamp/AAD, admin rolü ve global scanner closure sorunlarını yakaladı; RED→GREEN testlerle düzeltildi. Parola retry, geçersiz dekontu değiştirme, payload swap/expiry, Auth/Staff kimlik bağları ve nullable ödeme ayarları sınandı.
- Canlı `/giris`, `/katilimci/giris`, `/personel/giris`: 200. Auth'suz participant/panel API: 403. Monitor auth'suz: 401. Bearer health: 200; schemaReady/keysReady/workerReady true. Private no-store doğrulandı. Aktivasyon sayfalarında no-referrer metadata mevcut.
- Var olmayan `.invalid` test adresiyle link isteği 202 döndü; job/Auth kullanıcı/mail oluşturmadı. Son mevcut kayıtlar: **2 approval_queued**, **2 provider_accepted**, **1 admin**, **0 aktif QR**. Silme veya başvuruyu yeni statüye dönüştürme yapılmadı.

## Kullanıcı testi

1. `/giris` → `/panel/basvurular`: Başvuru ekle bölümünden yalnız kendi test e-postasıyla yeni pending kayıt oluştur.
2. `/panel/onay`: komite seç, davet gönder. Mailden bağlantıyı aç, açık kullanıcı işlemiyle doğrula ve 12–256 karakter parola oluştur.
3. `/katilimci/giris`: çıkış/giriş, yeniden davet ve recovery dene. İlk kabul QR açmamalı.
4. `/panel/odemeler`: nullable ayarlar ve başvuru beklenen tutarı; katılımcı dekontu, düzeltme, yeni dekont; sentetik banka onayı. Yalnız onay confirmed + aktif QR yaratmalı. Confirmation mail kuyruğu Gönderimler ekranında görülebilir ve kullanıcı tarafından gönderilebilir.
5. `/panel/ogunler`: aktif zaman aralığı oluştur; Ayarlar'da genel giriş açıkken `/tara`: aynı öğün tekrar, ikinci öğün, iptal. İkinci hesapla A/B veri erişimi dene.

Gerçek mailbox/delivery, oturum açık admin paneli boyunca uçtan uca test, A/B gerçek hesaplar ve Android/iPhone kamera/ses/basılı QR cihaz denemeleri kullanıcıyla yapılmadı. Ajan gerçek test e-postası göndermedi; provider health gerçek teslimat kanıtı değildir. Bunlar başarı sayılmadı.

## Geri dönüş ve yerel dosyalar

Sorunda Next env ve DB rollout/acceptance/payment kapılarını kapat; veri/audit kalsın. Eski mail-driven QR üreticisini geri açma. Tek başına eski Next rollback yeni DB/worker için yeterli değildir; uyumlu ileri düzeltme gerekir.

Private yedek, secret giriş dosyaları ve yürütme logları ignored `.superpowers/sdd/2026-10-04-katilimci-canli-yayin-devir-plani/` içinde korunur. Bunlar commit edilmedi. Geçici ASCII PostgreSQL runtime/test cluster klasörlerinin recursive temizliği otomatik onay incelemesinde politika nedeniyle engellendi; test sunucuları kapatıldı, klasörler korunur. Ana makinedeki Docker/başka servisler değiştirilmedi.

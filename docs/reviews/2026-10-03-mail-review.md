# AERO e-posta akışı — inceleme ve doğrulama

Tarih: 3 Ekim 2026, Türkiye saati. İncelenen temel sürüm: `7c2fa6e`. Kapsam: canlı kabul e-postası, panel gönderim durumları, grup işleyicisi, olay işleme ve panel girişinin veritabanı bağlantısı. `basvuru-onay-qr` worktree'sindeki henüz yayınlanmamış ödeme/katılımcı akışı bu raporun kapsamına dahil değildir.

## Son mail neden ulaşmadı?

Canlı kayıtta 00:40 gönderimi bir kez denenmiş ve Brevo tarafından `unauthorized` yanıtıyla reddedilmiş. Sağlayıcı mesaj kimliği yok; mail `queued`, teslimat `unknown`. İnceleme sırasında dört bekleyen kayıt, sıfır sağlayıcı kabulü ve sıfır mail olayı vardı. Bu gönderim için başarılı teslimat kanıtı yok.

Yeni sağlık kontrolü canlıda `/v3/account` ve `/v3/senders` GET çağrılarını başarıyla tamamladı. API erişimi, işlem e-postası hesabı ve aktif gönderici şu an doğrulanıyor. Bu, önceki SMTP gönderim reddinin nedenini tek başına açıklamaz ve SMTP POST isteğinin/alıcı teslimatının başarılı olduğunu kanıtlamaz. Önceki kod Brevo'nun ayrıntılı hata mesajını saklamadığı için anahtar reddi ile IP engeli o tarihsel kayıt üzerinden kesin olarak ayrılamıyor. Yeni SMTP hata tanısı IP engelini güvenli bir mesajla ayrı gösteriyor.

## Bulunan ve düzeltilen sorunlar

| Öncelik | Sorun ve etkisi | Düzeltme / test kanıtı |
|---|---|---|
| P1 | Sağlık kontrolü yalnızca ortam değişkenlerine bakıyordu; geçersiz Brevo erişiminde de hazır diyordu. | Hesap erişimi, aktif SMTP hesabı ve doğru aktif gönderici kontrolü; reddedilen anahtar, IP engeli, yanlış gönderici, timeout ve bozuk yanıt testleri. |
| P1 | `mark_mail_job` başarısız veya `false` olduğunda işleyici yine başarı sayıyordu. | Kalıcı kayıt onayı zorunlu; kayıp sonuç `MAIL_RESULT_UNCONFIRMED`. Başarı sayacı artırılmıyor, yeni kayıt talep edilmiyor. |
| P1 | `null`, bozuk JSON ve yanlış alanlarla gelen işleyici isteği çökmeye veya genel kuyruğa düşmeye yol açabiliyordu. | Girdi doğrulaması; bozuk hedefli istek hiçbir grubu talep edemiyor. |
| P1 | Panel girişinin kullandığı üç `public` RPC yoktu; migration yalnızca `private` fonksiyonları oluşturuyordu. Mevcut oturumlar bu hatayı gizleyebiliyordu. | Yeni `202610030001_admin_login_rpc.sql`. Yalnızca `service_role` çağırabilir; anon/authenticated rolleri reddediliyor. Gerçek uygulama adlarıyla PostgreSQL testi önce başarısız, sonra başarılı. |
| P2 | İşleyici hatasının açıklaması Next.js tarafında kayboluyor; bloklanan gönderim normal başarılı HTTP yanıtına benziyordu. | Güvenli hata kodu/açıklaması korunuyor; engel, başarısız ve belirsiz sayaçları taşınıyor. |
| P2 | Yanlış tipte, negatif veya limit üstü sayaçlar panel tarafından kabul ediliyordu. | Sayaçların pozitif/tamsayı sınırları, toplamları ve istenen grup limiti doğrulanıyor. |
| P2 | Aynı grubu tekrar denemek, daha önce kabul edilmiş mail için sıfır başarı gösteriyordu. | Sonuç, kalıcı mail kayıtlarından tekrar özetleniyor. Yeni gönderim sayısı ile toplam sağlayıcı kabulü ayrılıyor. |
| P2 | Son seçim temizlenince sonuç mesajı da ekrandan kayboluyordu. | Bildirim seçim koşulunun dışına taşındı. Bekleyen, başarısız ve belirsiz sonuçlar görünür kalıyor. |
| P2 | JSON `null` Brevo yanıtı işleyiciyi çökertebiliyor; hatalı messageId başarılı sayılabiliyordu. | Yanıt yapısı ve dolu string mesaj kimliği doğrulaması. Bozuk 201 yanıtı belirsiz kalır. |
| P2 | Uzlaştırma reddedilen bir veritabanı kaydını başarı sayıyor, bozuk olayda çöküyordu. | Kayıt sonucu `true` olmak zorunda; bozuk olaylar atlanıyor, eksik inceleme ertelenmiyor. |
| P2 | Eski gruplar için tek istekte 20 gönderim, 45 saniyelik çağrı süresini aşabiliyordu. | Panelden doğrudan gönderim üç kayıtla sınırlandı. Büyük eski gruplarda kalan kayıtlar aynı grupta görünür. |

## Test kapsamı ve sonuçlar

`npm.cmd test`: **83/83 başarılı**, sıfır başarısız/atlanmış test. Önceki 31 teste 52 test eklendi. Son tam tur yaklaşık 22 saniye sürdü.

| Katman | Kontrol edilen davranışlar |
|---|---|
| Brevo istemcisi | 201/messageId, sahte başarı, null/non-JSON, timeout, 5xx, kota, 429, alıcı hatası, hesap reddi, mükerrer idempotency yanıtı, SMTP IP engeli. |
| Gerçek Edge işleyicisi | Yetkisiz istek, kapalı/eksik ayarlar, test alıcı listesi, hedefli grup, bozuk istek, gerçek provider kabulünün kalıcı kaydı, sonuç kaybı, hız/kota/hesap engelinde durma. TypeScript modülleri VM içinde gerçek kodlarıyla çalıştırıldı; dış HTTP ve Supabase sınırları kontrollü yanıtlarla değiştirildi. |
| Panel API | Admin ve origin denetimi, event sınırı, yanlış batch kimliği, anahtar sağlık hatasında yeni başvuruyu değiştirmeme, eski grupta yeniden sağlık kontrolü, idempotent tekrar sonucu. Gerçek route/http/security kodları çalıştırıldı; kimlik ve dış veritabanı sınırı kontrollüydü. |
| PostgreSQL/PGlite | Gerçek migration ve RPC'ler, eski gruptan bağımsız hedefli talep, iki işleyicide tekrarsız kiralama, günlük kota, süre dolmuş kilit, iptal, yanlış alıcı/mesaj olayları, geç teslimat ve QR'ı yeniden açmama, service-role giriş RPC erişimi. |
| Webhook | Bearer reddi, JSON-array etiket, UTC epoch, yanlış/bozuk/aşırı büyük payload, belirsiz tarih, ilgisiz etiket, depolama hatasında sağlayıcıya yeniden deneme yanıtı. |
| Uzlaştırma | 1000 olay sonrası ikinci sayfa, belgeye uygun filtreler, yanlış alıcı/etiket/mesaj, yanlış tarih, sağlayıcı/kayıt hatasında onaylanmamış kaydı ertelememe, kaçmış teslimat olayı. |

Ek kontroller: ESLint başarılı; `tsc --noEmit` başarılı; Next.js production build başarılı; Deno Edge Function `check` başarılı; `git diff --check` başarılı. Edge kodu normal uygulama TypeScript kontrolünden dışlandığı için ayrıca Deno kontrolü yapıldı.

Canlı tarayıcı incelemesi: oturumsuz `/panel/gonderimler` isteği `/giris` ekranına yönlendi; giriş formu yüklendi, konsolda error/warn yoktu. Gerçek admin hesabıyla tarayıcı giriş/gönderim testi yapılmadı.

## Canlı operasyon ve doğrulama sınırları

- Giriş RPC düzeltmesi canlı veritabanına uygulandı. E-posta işleyicisi yeni gerçek sağlık kontrolüyle yayınlandı. Panel yayınının kimliği aşağıdaki yayın kaydında tutulur.
- Veritabanında `cron.job` bulunmuyor. Sağlayıcı kabulü sonrasında olayların işlendiğini canlıda kanıtlayan mail olayı henüz yok. Sağlık kontrolü webhook aboneliğini ve zamanlanmış uzlaştırmanın çalıştığını kanıtlamaz.
- `supabase_migrations.schema_migrations` bulunmuyor. Mevcut şema manuel uygulanmış; bu incelemede tüm migration'lar yeniden çalıştırılmadı. Otomatik `db push` öncesinde şema karşılaştırması ve migration geçmişi kurulması gerekir.
- Gerçek e-posta bu inceleme kapsamında yeniden gönderilmedi; mevcut alıcılar topluca tetiklenmedi. SMTP gönderimi, gerçek mailbox teslimatı ve Brevo event/webhook zinciri kontrollü tek alıcılı testte doğrulanmalıdır.
- PGlite gerçek PostgreSQL fonksiyonlarını çalıştırır, fakat ayrı sunucu bağlantılarıyla paralel transaction/deadlock veya canlı ağ gecikmesini temsil etmez. İki işleyici testi kayıtların tekrar kiralanmamasını sınar.
- Bu, fiziksel telefon/QR tarama, ödeme akışı, tüm UI etkileşimleri veya bağımsız kapsamlı güvenlik denetimi değildir. Bunlara ilişkin başarı iddiası yoktur.

## Kontrollü teslimat testi

1. Açıkça onaylanan tek alıcının ve tek grubun kimliğini sabitle.
2. Sağlık kontrolünü aynı canlı işleyicide çalıştır.
3. Yalnızca o gruptan bir kayıt gönder. Sonuç belirsizse körlemesine yeniden gönderme.
4. Kalıcı sağlayıcı mesaj kimliğini, Brevo request/delivered veya bounce olayını ve paneldeki karşılığını kontrol et.
5. Alıcı kendi mailbox'ında görünürlüğü doğrular. Provider delivered, alıcı sunucusunun kabulünü gösterir; inbox/spam yerleşimini tek başına kanıtlamaz.

## Kaynaklar

- [Brevo hesap API](https://developers.brevo.com/reference/get-account)
- [Brevo göndericiler API](https://developers.brevo.com/reference/get-senders)
- [Brevo IP güvenliği](https://developers.brevo.com/docs/ip-security)
- [Brevo olay raporu API](https://developers.brevo.com/reference/get-email-event-report)

## Yayın kaydı

Panel yayın kimliği ve son canlı RPC doğrulaması, dağıtım tamamlandığında eklenir.

# AERO yönetici paneli uygulama ve yayın kontrolü — 4 Ekim 2026

## Yerel uygulama

- Çalışma dalı: `codex/immediate-mail-review`.
- `37c8384`: Dekontları ana menüye ve sayfanın başına taşıma; gerçek “Diğer işlemler” sayfası; PDF/JPEG/PNG önizleme ve uzantılı indirme; ödeme listesinin başvuru sürümü ve komite adı için ileri migration.
- `9930797`: Gönderim sonucunda ortak API sayaçları; sağlayıcı kabulü ile teslimatı ayıran durumlar; ana tabloda gereksiz hata/işlem sütunlarının kaldırılması.
- `c8c6f6e`: Komiteyi önce seçme, adayları sayfalar arasında toplama, 500 aday sınırı, tek batch ve en fazla üç iletilik işçi adımları; salt okunur batch kontrolü ve belirsiz sonuçta devamın engellenmesi.
- `c9f6547`: Son incelemede bulunan dört sorunu giderme: dekont önizlemesini seçili kayda bağlama, reddedilip oluşturulmayan gönderimi güvenle çözme, dekont durumunu sayfalamadan önce filtreleme, gönderim sürdürmeyi işin zamanı ve sağlayıcı kapasitesiyle eşleştirme.
- `npm test`: 169/169 geçti. `npm run lint`, `npx tsc --noEmit`, `npm run build`, `git diff --check`: başarılı. Build'de mevcut `libheif-js` dinamik require uyarısı var; derleme tamamlandı.
- `202610040010_payment_review_metadata.sql` bütün migration tarihçesiyle yerel PGlite üzerinde uygulandı; yeni `list_payment_reviews_by_status` işlevi mevcut RPC'yi değiştirmeden filtreyi sayfalamadan önce uygular. Ödeme/QR regresyonları geçti. Kullanıcı onayıyla üretime de uygulandı; işlevin kurulu olduğu ve yalnız `authenticated` rolüne açıldığı sorguyla doğrulandı.

## Canlı sistemde salt okunur bulgular

- `payment_submissions.status='under_review'`: **1** kayıt.
- Gönderimi sağlayıcı tarafından kabul edilen fakat `delivery_status='unknown'` olan `mail_jobs`: **4** kayıt.
- `mail_events`: **0** kayıt.
- Brevo hesabında **Outbound webhook listesi boş**. Yerleşik tarayıcıda `Transactional email → Webhook → Outbound webhook` akışından doğrulandı. Kurulum sihirbazı incelendi ve kaydetmeden kapatıldı.
- Vercel Production ortamında `BREVO_WEBHOOK_TOKEN` değişkeni tanımlı; değeri okunmadı veya rapora yazılmadı.
- Bu kanıtlar, yeni bildirimlerin uygulamaya ulaşmamasını açıklar. Eski dört iletinin gerçekten teslim edilip edilmediğini tek başına göstermez.

## Yayın için kalan somut adımlar

1. İleri veritabanı değişikliği tamamlandı. Mevcut RPC korunuyor; yeni RPC için anonim erişimi kapalı.
2. Vercel Production yayını tamamlandı; `dpl_D7q7UBZNYfRE81rvNSsoMXVEkyB8` `READY`, `https://www.aerocalistay.org` alan adına bağlı. İlk CLI denemesi `TEAM_ACCESS_REQUIRED` ile engellenmişti; Vercel hesabının doğrulanmış sahibiyle eşleşen commit yazarıyla yeniden deneme başarılı oldu. Yetkili bir yöneticiyle yerleşik tarayıcıda 390 px ve masaüstünde menü, mevcut dekont, PDF/JPEG önizleme ve seçim akışını kontrol et; ödeme onayı ya da gerçek e-posta göndermeden ekranları doğrula. Yönetici oturumu olmadığı için bu son görsel kabul henüz yapılmadı.
3. Brevo'da `AERO_participant_delivery` adlı **Outbound webhook** kurulum ekranı Endpoint adımına kadar hazırlandı: `https://www.aerocalistay.org/api/webhooks/brevo`, **Token authentication**. Vercel Production `BREVO_WEBHOOK_TOKEN` okunamayan hassas değişken olduğu için yeni rastgele 64 karakterlik değerle güncellendi ve yeni sürüm yeniden yayınlandı. İmzalı olmayan, sentetik geçersiz gövdeyle yapılan yetkili istek `400` döndü; bu, yeni Bearer değerinin canlı uç noktada çalıştığını doğruladı ve posta/veri kaydı oluşturmadı. Token yalnız yerel panoya kondu, rapora yazılmadı. Kullanıcının Brevo alanına bu değeri kendisinin girmesi gerekiyor. Sonra **Send one at a time** ve yalnız **Transactional email** teslim edildi, ertelendi, geçici/kalıcı geri döndü, geçersiz adres, engellendi, şikâyet, abonelikten çıkıldı ve hata olaylarını seçip kaydet; açılma/tıklama olaylarını seçme.
4. Gerekirse tek ve açıkça belirlenmiş test alıcısıyla kontrollü gerçek e-posta gönder; Brevo olayının `mail_events` içine işlendiğini ve yalnız eşleşen işin teslimat durumunu değiştirdiğini doğrula. Eski dört kaydı kanıtsız güncelleme.

Brevo'nun resmi belgeleri, yeni sihirbazda Token authentication ve tek tek gönderimi desteklediğini; transactional e-posta olaylarında `email`, `message-id`, `ts_event` ve tag alanlarını kullandığını açıklıyor: https://help.brevo.com/hc/en-us/articles/27824932835474-Create-outbound-webhooks-to-send-real-time-data-from-Brevo-to-an-external-app ve https://developers.brevo.com/docs/transactional-webhooks .

## Açık doğrulama sınırı

Yerleşik tarayıcıda bu çalışma anında AERO yönetici oturumu açık değildi. Üretim veritabanı ve yayın tamamlandı; Brevo webhook aktivasyonu, gerçek posta testi ve yönetici ekranlarının oturumlu görsel kontrolü henüz tamamlanmadığı için tüm son kullanıcı akışı üretimde doğrulanmış sayılmaz. Yerel derleme ve izole veritabanı testleri geçmiştir.

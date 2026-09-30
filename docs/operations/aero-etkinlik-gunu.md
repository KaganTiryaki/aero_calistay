# AERO etkinlik yönetimi: kurulum ve etkinlik günü

`MAIL_QUEUE_ENABLED=false` ile başlayın. Gerçek kişilere e-posta göndermeden önce bağlantı ve prova adımlarını bitirin.

## İlk kurulum

1. AERO için ayrı bir Supabase projesi ve Brevo Free hesabı açın. Mevcut başka projenin veritabanını veya posta anahtarlarını kullanmayın.
2. Supabase migration dosyalarını sırayla, `202609300001_admin_activity.sql` dahil uygulayın. Auth içinde herkese açık kayıt olmayı kapatın. Proje URL'si ve publishable key'i `.env.local` içine, secret key'i yalnızca sunucu ortamına girin. `.env.example` yalnızca değişken adlarını gösterir.
3. Brevo'da transactional gönderimi ve gönderen alan adını doğrulayın. DNS ekranındaki Brevo code ve DKIM kayıtlarını alan adı yönetiminde uygulayın. Mevcut DMARC kaydını veya posta hizmetini kendiliğinizden değiştirmeyin. Ayrı bir API anahtarı, SMTP anahtarı ve rastgele webhook bearer token'ı üretin.
4. Ortak yönetici hesabını oluşturmak için `node --env-file=.env.local scripts/bootstrap-shared-admin.mjs` çalıştırın. Betik 43 karakterlik rastgele şifre üretir, Supabase Auth hesabını ve `admin` rolünü açar, şifreyi kullanıcının Documents klasöründe tek kullanımlık dosyaya yazar ve `ADMIN_LOGIN_EMAIL` değerini `.env.local` içine ekler. Dosyayı yalnızca yöneticilere güvenli bir kanaldan iletip silin. Canlı dağıtımın sunucu ortamına da aynı `ADMIN_LOGIN_EMAIL` değerini girin.
5. Ortak şifreyi bilen 15 yönetici aynı hesabı kullanır. Giriş ve yönetim işlemlerinde zaman, IP, tarayıcı/cihaz başlığı, tarayıcı çerezi kimliği ve Supabase oturum kimliği tutulur. Bunlar kişiyi kesin olarak tanımlamaz; aynı ağ veya cihazdan gelen iki yöneticiyi ayırmayabilir.
6. Edge Function'ı yalnızca ilgili Supabase projesine dağıtın. `supabase/config.toml` JWT denetimini kapatır; fonksiyon kendi `MAIL_QUEUE_SECRET` bearer sırrını zorunlu tutar. Brevo API anahtarı, gönderici ve yanıt adresi de fonksiyon sırlarıdır.
7. Önce `MAIL_ENV=test`, `MAIL_TEST_ALLOWLIST` (yalnız test alıcıları) ve `MAIL_QUEUE_ENABLED=false` kullanın. Test hesabında tek alıcıyla Brevo `201/messageId`, tag, `request` ve `delivered` olaylarını, webhook bearer doğrulamasını, günlük kredi yanıtını ve idempotency anahtarının gerçek davranışını kontrol edin. Sözleşme sonuçlarını kaydedin. Belirsiz gönderimde otomatik tekrar **kapalı** kalır. Canlı `MAIL_ENV=production` için `BREVO_CONTRACT_VERIFIED=true` ayrıca zorunludur.
8. Supabase Vault'a `aero_project_url` ve `aero_mail_queue_secret` girin. `supabase/setup-cron.sql` dosyasını özel projede çalıştırın. Cron geçmişinden dakikalık çağrıları, panelde işleyici ve uzlaştırma zamanlarını doğrulayın. Test alıcılarıyla gönderim çalışınca ve domain hazır olunca canlı ortamda `MAIL_QUEUE_ENABLED=true` yapın.

## Kullanım

- `Başvurular`: kişi ekleyin veya Excel'den üç sütun yapıştırın. Aynı etkinlikte aynı e-posta yeniden eklenmez.
- `Onay ve e-posta`: seçilen herkese komite atayın, e-posta örneğini okuyun, kalıcı kuyruğa alın. Kuyruğa almak e-postanın gittiği anlamına gelmez.
- `Gönderimler`: `provider_accepted` Brevo'nun API kabulüdür; onay/QR ancak `request` veya `delivered` olayıyla oluşur. `uncertain` işini körlemesine yeniden göndermeyin; Brevo raporunda tag ve mesaj kimliğini araştırın. Kesin başarısız işte “Başvuruyu yeniden aç” ile kişiyi yeni sürüm olarak tekrar seçilebilir hale getirin; e-postayı kontrol edip yeniden kuyruğa alın.
- `Onaylananlar`: doğrulananları ve teslimat durumunu görün. Teslimat hatası onayı otomatik kaldırmaz. İptal kartı geçersiz kılar. QR yenileme eski baskıyı geçersiz kılar.
- `Kartlar`: ilk taslak 90 × 120 mm; gerçek kartlık ölçüsüne göre yüzde 100 ölçekte test baskısı alın. E-posta kartta yoktur.
- `Ayarlar`: gerçek komiteleri ekleyin ve ancak hazır olduğunuzda girişi açın. Personel hesapları panelden davet edilmez.
- `İşlem geçmişi`: ortak hesabın giriş ve işlem zamanını, IP/cihaz izini ve oturum numarasını inceleyin. `Sonuç doğrulanmalı` kaydı işlem başladıktan sonra sunucu/bağlantı hatası olabileceğini gösterir; asıl kayıt durumunu ayrıca kontrol edin.
- `/tara`: yönetici kamerayı açar veya kartın altındaki manuel kodu girer. Ağ hatasında başarı gösterilmez; aynı kart tekrar okutulursa ilk giriş saati görünür.

## Etkinlikten önce

- Supabase projesinin aktif olduğunu, dışa aktarılmış ve güvenli saklanan bir yedeği, Brevo günlük hakkını ve Cron'un son başarılı çalışmasını kontrol edin. Free planda otomatik yedek ve kesintisiz proje etkinliği varsaymayın.
- 10, 20, 30, 50, 250 ve 350 kişilik sentetik grupları sağlayıcı taklidiyle deneyin; gerçek ücretsiz e-posta kotasını prova için tüketmeyin. Varsayılan kabul bütçesi 290/gün, personel rezervi 10/gündür.
- En az bir Android Chrome ve bir iPhone Safari ile gerçek boyutta basılmış kartı okutun. Kamera izni, manuel kod, tekrar okutma, yetkisiz hesap ve ağ kesintisini deneyin.
- Etkinliğin giriş saatini ve kartlık ölçüsünü, gerçek komiteleri ve personel listesini organizatörle doğrulayın. Yedek basılı listeyi sınırlı erişimle saklayın.
- Canlı domainin HTTPS ve Vercel bağlantısını kontrol edin. Önizleme ortamından gerçek katılımcılara e-posta çıkarmayın.

## Hata ve kesinti

- `quota_wait`: iş Supabase'de kalır; kota uygun hale geldiğinde otomatik devam eder. Brevo tarafından zaten kabul edilmiş işe ikinci send yapılmaz.
- Paylaşılan Brevo hesabının gerçek kalan kredisi henüz API'den doğrulanmış bir günlük bakiye olarak okunmuyor. 290 kabul + 10 personel payı yalnızca yerel bütçedir; başka gönderimler varsa Brevo'nun kesin kota reddi işi bekletir. Üretim anahtarını açmadan önce aynı hesapta SMTP ve API tüketimini gerçek test hesabında karşılaştırın.
- `uncertain`: ağ kesilmiş veya işleyici yanıtı kaybetmiş olabilir. Olay uzlaştırması otomatik araştırır. 24 saat sonuç yoksa yönetici Brevo logunu incelemelidir; yokluk gönderilmediğinin kanıtı değildir.
- Brevo veya Supabase erişilemezse paneldeki kayıtları silmeyin. İşleyici tekrar çalıştığında kalıcı kuyruktan devam eder. İnternet tamamen kesildiğinde tek sorumlu üzerinden basılı katılımcı listesiyle kontrollü manuel yedek kullanın.
- Toplu iptal Brevo'nun zaten kabul ettiği e-postayı geri çekmez; iptal kartı geçersiz kılar. Katılımcıya sonradan e-posta ulaşabilir.

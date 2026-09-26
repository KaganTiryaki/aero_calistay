# AERO başvuru, onay e-postası ve QR giriş sistemi — Supabase + Brevo planı

**Tarih:** 26 Eylül 2026
**Seçilen e-posta servisi:** Kullanıcının kararıyla Brevo Free.
**Durum:** Yerel uygulama kodu hazır; canlı servis kurulumu ve saha doğrulaması bekliyor.
**Amaç:** Yöneticinin ad, soyad ve e-posta ile kaydettiği başvuruları komite bazında toplu onaylaması; e-posta gönderiminden sonra kişilerin onaylılar listesine geçmesi, benzersiz QR kodlarının yaka kartına basılması ve görevlilerin `/tara` üzerinden giriş kaydetmesi.

**Mimari:** Mevcut Next.js sitesine yönetim ve tarama ekranları eklenir. Supabase veritabanı, personel oturumu ve kalıcı gönderim kuyruğunu tutar; Brevo Transactional Email API kabul e-postalarını gönderir. Supabase zamanlayıcısı kuyruğu işleyen küçük bir Edge Function çağırır; yönetim panelinin açık kalması gerekmez. Brevo webhook'ları ve periyodik olay sorgulaması gönderim sonucunu doğrular; onay ve QR birlikte tamamlanır.

**Teknolojiler:** Mevcut Next.js App Router, React, TypeScript ve Tailwind; Supabase Postgres/Auth/Cron/Edge Functions; Brevo HTTP API ve personel hesapları için Brevo SMTP; QR üretmek için `qrcode`, okumak için `qr-scanner` adayları.

**Kapsam belgesi:** Kullanıcının bu görüşmedeki isteği; aşağıdaki iş akışı ve varsayımlar. Bu tek dosya hem tasarım kararlarını hem uygulama adımlarını içerir. Kod örneği, SQL veya migration yazılmamıştır. İleride uygulama istendiğinde adımlar `superpowers:executing-plans` ile sırayla yürütülebilir; bu dosya uygulamayı başlatmaz.

## 1. Önerilen sonuç

Panelde dört ana bölüm olacak:

1. **Başvurular:** Ad, soyad, e-posta ekleme; arama, düzenleme ve çoklu seçim.
2. **Onay ve e-posta:** Seçilen kişilere komite atama, kişiselleştirilmiş e-postayı önizleme ve gönderme.
3. **Onaylanan başvurular:** Başarılı gönderim sonrasında otomatik gelen kişiler; QR görüntüleme, indirme ve yaka kartı baskısı.
4. **Gönderimler:** Kuyruk, başarı, hata ve teslimat bilgileri; güvenli yeniden deneme.

Görevliler `https://aerocalistay.org/tara` adresinde kendi hesaplarıyla giriş yapıp telefonun kamerasıyla yaka kartlarını tarayacak. Ekran kişinin adını, soyadını, komitesini ve giriş sonucunu gösterecek.

### Kullanıcıdan gelen gereksinimler

- Başvuranların listesi dışarıdan gelecek; kullanıcı bunları panele girecek.
- Temel alanlar ad, soyad ve e-posta olacak.
- Kabul edilecek kişiler panelde seçilecek.
- Kabul e-postasında kişinin adı, soyadı ve kabul edildiği komite bulunacak.
- Gönderim başarılı olduktan sonra kişi otomatik olarak onaylananlar bölümüne geçecek.
- Her onaylı kişinin farklı QR kodu olacak; bunlar yaka kartlarına basılacak.
- Etkinlik personeli `/tara` üzerinden QR okuyacak.
- Ücretsiz hizmetlerle başlamak öncelikli.

### Planın seçtiği varsayımlar

- İlk sürüm tek etkinliği yönetir; kişi bu etkinlikte tek komiteye kabul edilir.
- QR okutmak etkinliğe ilk girişi kaydeder. Çıkış, tekrar giriş ve ayrı oturum yoklaması bu sürüme dahil değildir.
- QR e-postaya eklenmez; kullanıcı QR'ı yaka kartı için istedi. Kabul e-postası metin ve marka bilgisi içerir.
- Katılımcılara hesap açılmaz. Hesaplar yalnızca yönetici ve görevli içindir.
- Brevo'nun yalnızca API isteğini kabul etmesi kişiyi onaylı listeye geçirmez; servis mesajı kendi kuyruğunda bekletebilir. Brevo'nun gönderim olayı veya teslim olayı doğrulanınca onay ve QR birlikte oluşur. Alıcının gelen kutusuna ulaşma garantisi verilmez.
- İlk baskı taslağı 90 × 120 mm dikey karttır; gerçek kartlık ölçüsü baskı öncesi doğrulanır. QR en az 30 mm genişlikte hedeflenir ve gerçek çıktıda denenir.
- Çalıştay komiteleri panelde tanımlanır; mevcut sitedeki ekiplerden otomatik türetilmez.

Bu varsayımlar araştırmada doğrulanmış organizasyon bilgileri değildir. Uygulama öncesi değiştirilebilir; plan bunların cevabını beklemeden hazırlanmıştır.

## 2. Mevcut projede doğrulanan durum

| Alan | Kaynakta görülen durum | Plana etkisi |
|---|---|---|
| Uygulama | `app/page.tsx` içinde tek sayfalık tanıtım sitesi | Panel ve tarayıcı yeni bölümler olacak. |
| Sürümler | Kilit dosyasında Next.js 15.5.20, React/React DOM 19.2.7 | Entegrasyon Next.js 15 düzenine göre yapılacak; büyük sürüm yükseltme bu işin şartı değil. |
| Backend | Supabase, Brevo, API route, oturum ve yönetim paneli bulunmuyor | Veritabanı ve yetkilendirme sıfırdan eklenecek. |
| Başvuru | `lib/content.ts` içindeki `site.applyUrl` Google Form'a bağlı; `apply.open` false | Yeni panel dışarıdan gelen listeyi işleyecek. Form entegrasyonu ve başvuruları yeniden açma kapsam dışında. |
| Komite metinleri | `teams.committees` organizasyon ekiplerini; `disciplines` akademik alanları anlatıyor | Kabul komitesi listesi ayrıca oluşturulacak; ikisi eşit kabul edilmeyecek. |
| Sayfa kabuğu | `app/layout.tsx` tüm sayfalara preloader, arka plan efektleri, özel imleç ve Lenis uyguluyor | Bu efektler yalnızca tanıtım sayfasının layout'una taşınacak. Panel/kamera hafif bir kabuk kullanacak. |
| Metin düzeni | `CLAUDE.md` statik metin ve ayarlar için `lib/content.ts` istiyor | Yeni Türkçe ekran metinleri ve e-posta şablon metni burada tutulacak; kişi ve komite kayıtları veritabanında olacak. |
| Testler | `package.json` yalnızca dev/build/start/lint komutları içeriyor | İş kuralları ve veritabanı yarış koşulları için test altyapısı eklenecek. |
| Yayın | `.vercel` dizini ve Vercel'i anlatan README mevcut | Mevcut yayın düzeni kullanılacak; canlı domain, hesap planı ve DNS yetkisi bu araştırmada doğrulanmadı. |

İlk araştırma başında `git status --short` boştu. Brevo revizyonu başında yalnızca bu henüz commit edilmemiş plan dosyası vardı. Bu çalışma aynı plan dosyasını günceller; commit, push, yayın veya harici servis kurulumu kapsamaz.

## 3. Servis seçimi ve ücretsiz kullanım

### Seçim: Supabase Free + Brevo Free

| Hizmet | Araştırmada doğrulanan ücretsiz sınır | Bu sistemde kullanım |
|---|---|---|
| Supabase | Proje başına 500 MB veritabanı, 1 GB dosya alanı, 50.000 aylık aktif kullanıcı; 2 aktif ücretsiz proje sınırı | Başvurular, yetkiler, kuyruk, QR kayıtları ve giriş kayıtları. Küçük metin kayıtları için uygun başlangıç. |
| Supabase süreklilik | Bir hafta hareketsizlik sonrası duraklatma; ücretsiz planda otomatik yedek yok | Etkinlik öncesi aktif proje kontrolü ve kontrollü yedek gerekir. |
| Brevo | Günlük 300 e-posta; kullanılmayan günlük hak devretmez | Kabul mesajları ve personel hesap e-postaları ortak gönderim bütçesini kullanır. Günlük limitler ayrı ayrı günlerde kullanılabilir; 9.000 mesajlık tek seferlik aylık havuz gibi yorumlanmaz. |
| QR | Uygulama içinde üretim ve okuma | Harici ücretli QR servisi gerekmez; görseller talep anında üretilir. |

Kaynaklar: [Supabase fiyat ve planları](https://supabase.com/pricing), [Brevo ücretsiz plan kısıtları](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).

**“Kaç kişi seçtiğim fark etmesin” şu şekilde sağlanır:** Panelde birden fazla sayfadan kişi seçilebilir ve büyük bir gönderim grubu oluşturulabilir. Grup kalıcı kuyruğa parçalar halinde alınır; servis kotası dolunca kalanlar bekler. Ücretsiz planda sınırsız aynı gün gönderimi vaat edilmez.

Örnek: O gün başka kullanım yoksa 250 kişinin kabul mesajı ücretsiz günlük sınıra sığar. 350 kişilik grupta teorik olarak 300 gönderim, sonraki kota dönemine kalan 50 kişi vardır. Aşağıdaki personel e-postası rezervi açıkken panel bunun yerine 290 + 60 planlar. “Gönderildi” sayacı yalnızca doğrulanmış gönderim olayı geldikçe artar.

**Kota yönetimi:** Varsayılan günlük kabul e-postası bütçesi en fazla 290; personel daveti/parola sıfırlama için 10 mesajlık pay ayrılır. Bu uygulama tercihidir, Brevo'nun ilave sınırı değildir. Yönetici kullanımına göre payı değiştirebilir. Gerçek kalan hak daha azsa küçük olan sınır kullanılır. Aynı Brevo hesabı başka projelerde kullanılmamalı; personel SMTP gönderimleri de bütçeye dahil edilmelidir.

Brevo'nun `GET /v3/account` plan/kredi bilgisi ile yerel gönderim rezervasyonları birlikte değerlendirilir. Hesabın yanıtındaki kredi alanının günlük kalan kullanım anlamı test hesabında doğrulanır; doğrulanamıyorsa panel yalnızca kendi kullanımı için tahmini sayı gösterir ve kesin bakiye iddiasında bulunmaz. Kota bekleyen işler varken 15 dakikada bir kota uygunluğu kontrol edilir. Resmî kaynaklarda kesin yenilenme saati doğrulanmadığı için UTC gece yarısı varsayımı yapılmaz; doğrulanmış yenilenme zamanı varsa İstanbul saatinde gösterilir. [Brevo hesap bilgisi API'si](https://developers.brevo.com/reference/get-account).

İstek hızı günlük e-posta kotasından ayrıdır. İşleyici `x-sib-ratelimit-limit`, `x-sib-ratelimit-remaining` ve `x-sib-ratelimit-reset` başlıklarını izler; 429 durumunda hız sınırına uygun bekler. Günlük kredi tükendiğinde hata gövdesi ve hesap bilgisi incelenir; her kota durumu 429 sayılmaz. [Brevo hız sınırı başlıkları](https://developers.brevo.com/docs/limit-headers).

### Neden kuyruk Supabase'de kalıyor?

Brevo ücretsiz planda günlük sınır sonrası en fazla 1.000 transactional mesajı kendi tekrar kuyruğunda tutabildiğini, bunun ötesindekileri teslim etmediğini belirtiyor. Bu nedenle binlerce kaydı sınırsızca Brevo'ya teslim etmeyeceğiz. Bekleyen asıl iş listesi Supabase'de kalacak; kota uygun oldukça gönderilecek. Brevo'nun kabul ettiği bir mesaj tekrar kendi kuyruğumuza yeni gönderim olarak eklenmeyecek. Kaynak: [Brevo ücretsiz plan kısıtları](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).

Kabul e-postaları Brevo'nun transactional API'siyle gönderilir; marketing kampanyası veya Brevo kişi listesi oluşturmak gerekmez. Kişi kaydının asıl kaynağı Supabase'dir. Brevo'ya gönderim için gerekli alıcı, içerik ve kişisel veri içermeyen iş etiketi iletilir.

İlk hedef ek backend/e-posta abonelik maliyetinin 0 olmasıdır. Domain yenilemesi, mevcut hosting hesabı ve limit aşımı bu hedefin dışında değerlendirilir. Mevcut Vercel planının bu etkinliğe uygunluğu yayın öncesi kontrol edilir; ücretli bir hizmet otomatik açılmaz.

## 4. Ekranlar ve kullanım akışı

### `/giris`

- Yönetici ve görevliler e-posta/şifre ile giriş yapar.
- Herkese açık hesap oluşturma kapalıdır. Yönetici hesapları ilk kurulumda, görevli hesapları yönetici tarafından açılır.
- Yönetici panele, görevli `/tara` sayfasına yönlendirilir.
- Parola sıfırlama/davet için Supabase Auth özel SMTP ayarı Brevo'ya bağlanır. Sunucu `smtp-relay.brevo.com`; port 587, STARTTLS desteği bağlantı testinde doğrulanır. Kullanıcı adı Brevo SMTP ekranından, parola ayrı SMTP anahtarından alınır; API anahtarı SMTP parolası değildir. [Brevo SMTP kurulumu](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP).
- Supabase'in varsayılan posta servisi yalnızca önceden izinli proje ekibi adresleriyle sınırlıdır ve üretim için önerilmez. [Supabase SMTP belgesi](https://supabase.com/docs/guides/auth/auth-smtp). Kabul e-postaları ise durum takibi için SMTP yerine Brevo HTTP API kullanır.

### `/panel/basvurular`

- Alanlar: ad, soyad, e-posta; isteğe bağlı ön komite tercihi.
- Ad ve soyad çok kelimeli ve Türkçe karakterli olabilir. Boş alanlar ve geçersiz e-posta kaydedilmez.
- Aynı etkinlikte normalize edilmiş e-posta için tek kayıt. Baş/son boşluklar temizlenir, e-posta küçük harfle karşılaştırılır; Gmail nokta/plus kurallarıyla adres birleştirilmez.
- Aynı e-posta girilirse mevcut kayıt gösterilir; üstüne sessizce yazılmaz. İlk sürümde ortak e-posta ile iki ayrı katılımcı kaydı desteklenmez.
- Temel yol tek tek form girişi. Ek kolaylık: Excel'den ad/soyad/e-posta sütunlarını tabloya yapıştırma; kaydetmeden önce satır bazında doğrulama ve tekrar listesi. XLSX dosya yükleme ilk sürüm için zorunlu değil.
- İsim/e-posta arama, komite/durum filtresi, sayfalama ve çoklu seçim.
- “Bu sayfayı seç” ile “Filtrelenen bütün kişileri seç” ayrı ve sayıları açık olur. Gönderim ekranı seçili kişi listesini sabitler.

### `/panel/onay`

1. Seçili kişiler listelenir.
2. Her kişinin kabul komitesi belirlenir. Aynı komite topluca atanabilir; satır bazında düzeltilebilir.
3. E-posta örneği ve kaç kişiye gönderileceği gösterilir.
4. “Onay e-postalarını gönder” düğmesi kalıcı bir gönderim grubu oluşturur.
5. Panel ilerlemeyi veritabanından alır; yenileme veya sekme kapatma işi silmez.
6. Brevo gönderimi doğrulanan kişilerin onayı ve QR kaydı otomatik tamamlanır. Sadece API'den mesaj kimliği alınmışsa “Brevo'da bekliyor” gösterilir.

**E-posta örneği:**

> Konu: AERO Sirkülasyon Çalıştayı — Başvurunuz onaylandı
>
> Merhaba {Ad} {Soyad},
>
> AERO Sirkülasyon Çalıştayı başvurunuz {KomiteAdı} komitesine kabul edilmiştir.
>
> Sizi aramızda görmekten mutluluk duyuyoruz.
>
> AERO Sirkülasyon Çalıştayı Ekibi

Tarih, adres veya program kullanıcıdan doğrulanmadan eklenmez. Şablon değişkenleri HTML için güvenli kaçıştan geçirilir; HTML yanında düz metin sürümü gönderilir. Her alıcı ayrı mesaj alır; diğer başvuranların adresleri görünmez.

Önerilen gönderici: doğrulanacak `AERO <basvuru@mail.aerocalistay.org>`. Yanıt adresi mevcut iletişim adresi olabilir. Bu yalnızca önerilen adres yapısıdır; çalışan posta kutusu veya doğrulanmış domain olduğu iddia edilmez. Brevo panelinin verdiği Brevo code/DKIM/DMARC kayıtları incelenip uygulanır. Mevcut DMARC kaydı varsa ikinci kayıt eklenmez veya politikası kendiliğinden değiştirilmez; mevcut posta hizmeti korunur. [Brevo domain doğrulama rehberi](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC).

### `/panel/onaylananlar`

- Ad, soyad, komite, kabul zamanı, e-posta durumu, QR ve giriş durumu gösterilir.
- QR görüntüleme, tekil SVG/PNG indirme, seçili kişiler için baskı ve CSV dışa aktarma.
- “Gönderildi”, “Teslim edildi”, “Teslim edilemedi” farklı rozetlerdir. “Teslim edildi” alıcı posta sunucusunun kabulünü ifade eder; okunma veya gelen kutusu yerleşimi garantisi değildir. “Brevo'da bekliyor” durumundaki kişiler henüz bu listede bulunmaz.
- Teslimat hatası onayı kendiliğinden kaldırmaz; yönetici hatayı görüp e-postayı düzeltebilir.
- Yeniden e-posta gönderme açık bir yönetici işlemidir. Var olan QR değişmez.
- Onay iptali QR'ı geçersizleştirir. Yeni QR üretimi ayrıca seçilen bir işlemdir; eski baskı geçersiz olur ve uyarı gösterilir.

### `/panel/gonderimler`

- Her grup için toplam, sırada, Brevo'da bekliyor, gönderildi, kota bekliyor, hata ve sonucu belirsiz sayıları. Teslimat rozetleri gönderilen mesajların altında gösterilir; toplam sayaçlarda aynı kişi iki kez sayılmaz.
- Sorunlu satırda okunabilir neden: geçersiz adres, domain ayarı, kota, bağlantı veya sağlayıcı hatası.
- Yeniden deneme yalnızca uygun başarısız kaydı işler. Başarılı kayıtlar tekrar gönderilmez.
- Gönderimi başlayan grubun alıcı/komite/metin kopyası değiştirilemez. Henüz işlenmeyen iş iptal edilip yeni sürüm oluşturulabilir; işlemdeki işin sonucu belirlenmeden değiştirilmez.
- Brevo'ya teslim edilmiş e-postanın panelden geri çekildiği iddia edilmez. Başvuruyu iptal etmek QR'ı geçersizleştirir; sağlayıcı kuyruğundaki mesajın sonradan ulaşma ihtimali yöneticiye gösterilir.

### `/panel/kartlar`

- Onaylı kişilerden seçili liste için baskı önizlemesi ve tarayıcıdan PDF olarak kaydetme.
- Kart: AERO kimliği, ad-soyad, komite, QR ve altında kısa manuel giriş kodu.
- E-posta kartta görünmez. Uzun isim ve komite adları satıra yayılır; QR alanına taşmaz.
- A4 yerleşimi, milimetre tabanlı kart boyutu, kesim işaretleri ve yüzde 100 baskı uyarısı.
- QR çevresinde en az dört modül boş alan; logolu veya gradyanlı QR yok. Marka görünümüne uyumlu çok koyu kod/açık zemin, gerçek baskıda okunabilirlik kontrolü.
- Aynı kartı tekrar indirmek veya yazdırmak aynı QR'ı üretir. QR görselleri herkese açık bir depoya yüklenmez.

### `/tara`

- Giriş yapan görevli “Kamerayı aç” ile arka kamerayı başlatır.
- İlk geçerli tarama giriş kaydını oluşturur; isim, komite ve “Giriş kaydedildi” görünür.
- Aynı QR tekrar okutulursa “Daha önce giriş yaptı” ve ilk giriş saati gösterilir; yeni kayıt eklenmez.
- Geçersiz, onaysız veya iptal edilmiş QR için ayrı ve net sonuç gösterilir.
- Kamera izni reddedilirse açıklama ve manuel kart kodu girişi bulunur. Görüntüden QR okuma yedek yol olarak sunulabilir.
- Sonuç ekranda kalır; görevli “Sıradaki kişi” ile okumaya devam eder. Her kamera karesi ayrı istek üretmez.
- Ağ kesilirse “Doğrulanamadı — bağlantıyı kontrol edin” gösterilir. Sunucu onayı gelmeden başarı gösterilmez.
- HTTPS ve kamera izni gerekir; iPhone Safari ve Android Chrome fiziksel cihazda denenir. [Kamera erişimi koşulları](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

## 5. Veri modeli ve durum kuralları

Tablo adları ve alanlar tasarım sözleşmesidir; bu çalışma tabloları oluşturmaz.

| Tablo | Temel içerik | Zorunlu kural |
|---|---|---|
| `events` | Etkinlik adı, giriş açık/kapalı, saat dilimi | İlk sürüm tek etkinlik; saat dilimi Europe/Istanbul. |
| `committees` | Etkinlik, komite adı, aktiflik | Aynı etkinlikte ad tekrarı engellenir; kullanılmış komite silinmek yerine pasifleştirilir. |
| `staff_members` | Auth kullanıcı kimliği, etkinlik, admin/staff rolü, aktiflik | Kullanıcı kendi rolünü değiştiremez; bütün isteklerde aktiflik kontrol edilir. |
| `applications` | Etkinlik, ad, soyad, normalize e-posta, komite, durum, sürüm, oluşturan | Etkinlik + e-posta benzersiz; kabul için komite zorunlu. |
| `mail_batches` | Grubu oluşturan, seçim özeti, oluşturulma zamanı | Yenilenen istek aynı grup kimliğiyle ikinci grup oluşturmaz. |
| `mail_jobs` | Başvuru, grup, gönderim sürümü, sabit alıcı/komite/şablon kopyası, durum, deneme sayısı, ilk gönderim denemesi zamanı, sonraki deneme, kilit süresi, Brevo mesaj kimliği, UUID tekrar anahtarı, kişiye özel iş etiketi | Başvuru + gönderim türü + sürüm benzersiz; aynı işin anahtarı ve içeriği değişmez. Belirsiz iş doğrudan yeniden gönderilmez. |
| `mail_provider_state` | Brevo hesabı için ortak kilit, kredi ölçümü/zamanı, hız sınırı beklemesi, günlük kabul bütçesi, SMTP rezervi, olay sorgulama imleci | Eşzamanlı işleyiciler aynı kalan hakkı ayrı ayrı harcayamaz. Kesinliği doğrulanmamış bakiye tahmin olarak gösterilir. |
| `qr_credentials` | Başvuru, rastgele QR değeri, arama özeti, manuel kod, aktiflik, sürüm | Bir başvurunun tek aktif QR'ı; QR ve manuel kod benzersiz. Ham QR yalnızca yetkili sunucu işlemlerine açık. |
| `check_ins` | Başvuru, etkinlik, görevli, sunucu zamanı, istek kimliği | Etkinlik + başvuru benzersiz; eşzamanlı taramalarda tek kayıt. |
| `mail_events` | Brevo mesaj kimliği, iş etiketi, alıcı özeti, olay türü, olay zamanı, sağlayıcı kimliği varsa kimlik, bileşik tekilleştirme anahtarı | Webhook ve olay API'sinden aynı olay gelirse ikinci kez uygulanmaz. `id` alanı tek başına evrensel olay kimliği sayılmaz. |
| `audit_logs` | Aktör, işlem, hedef kayıt, zaman, sınırlı değişiklik özeti | Onay, yeniden gönderim, iptal, QR yenileme ve manuel giriş izlenebilir. |

Zamanlar veritabanında UTC tutulur; kullanıcıya İstanbul saatinde gösterilir. Ham QR ve tam e-posta içeriği genel uygulama loglarına yazılmaz.

### Başvuru durumu

- `pending`: Başvuru var; kabul e-postası başarıyla gönderime alınmadı.
- `approval_queued`: Yönetici komite seçti ve gönderim kuyruğa alındı.
- `approved`: Brevo `request` gönderim olayı veya `delivered` teslim olayı doğrulandı; onay ve QR aynı veritabanı işleminde tamamlandı.
- `cancelled`: Yönetici kabulü iptal etti; QR kullanılamaz.

Gönderim hatası ayrı `mail_jobs` durumuyla görünür; kişi hata halinde onaylıya geçirilmez. “Onaylananlara taşıma” fiziksel olarak başka tabloya kopyalama değildir; aynı başvurunun `approved` durumuna göre listelenmesidir.

### Gönderim durumu

- `queued`, `sending`, `quota_wait`, `provider_accepted`, `sent`, `failed`, `uncertain`, `cancelled`.
- `provider_accepted`: Brevo mesaj kimliği var, doğrulanmış gönderim olayı henüz yok. İş yeniden gönderilmez; sağlayıcı kuyruğu ve olayları izlenir.
- `sent`: Brevo `request` veya `delivered` olayı doğrulandı. Onay ve QR sonlandırması bu duruma geçişle aynı transaction'dadır.
- Teslimat bilgisi ayrıca tutulur: `unknown`, `delivered`, `deferred`, `soft_bounced`, `hard_bounced`, `blocked`, `invalid`, `complained`, `error`, `unsubscribed`.
- Bir teslimat olayı sonradan geldiğinde daha eski bir olay mevcut sonucu geriye çeviremez. Olay geçmişi korunur.

## 6. E-posta kuyruğu ve kesinti davranışı

1. Yönetici isteği oturum/rol ve bütün satırların geçerliliği açısından denetlenir.
2. Başvuru sürümleri kilitlenerek grup ve kişi başına bir iş aynı veritabanı işlemi içinde oluşturulur. İstemcinin gönderdiği onay durumu güvenilir kabul edilmez.
3. Supabase Cron dakikada bir gönderim işleyicisini çağırır. Cron sırrı Vault'ta, işleyici sırrı Edge Function ortamında tutulur. İşleyici çağrıları bu sırla doğrulanır; publishable key tek başına yetki sayılmaz.
4. İşleyici veritabanından kısa süreli kilitle en fazla 20 uygun iş alır. Çalışma süresi sınırına yaklaşınca yeni iş almayı bırakır; kalanlar sonraki çağrıda devam eder.
5. İlk sürümde kişi başına `POST https://api.brevo.com/v3/smtp/email` çağrılır. HTTP `api-key` sunucuda kalır; payload tek alıcı, sender, replyTo, subject, htmlContent/textContent ve kişisel veri içermeyen `aero-job-<UUID>` etiketi taşır. Büyük seçimler çok sayıda kalıcı işten oluşur; ilk sürüm `messageVersions` ile dev bir batch oluşturmaz.
6. İstekten önce sabit bir UUID idempotency anahtarı, ilk deneme zamanı ve içerik kopyası kaydedilir. HTTP 201 ve `messageId` sonucu işte `provider_accepted` olarak saklanır. Başvuru henüz onaylanmaz; bu iş için ikinci bir send çağrısı yapılmaz. Gönderim/teslim olayı gelince iş `sent`, başvuru `approved` olur ve QR yoksa oluşturulur; sonlandırma tek transaction'dır.
7. İşleyici send aşamasına hiç girmeden kapanmışsa kilit süresi dolunca iş alınabilir. Send aşamasına girdikten sonra kapanmışsa e-posta gönderilmiş olabileceği için iş `uncertain` olur; önce sağlayıcı sonucu araştırılır. İşleyici kilidi süre sonuna karşı sahiplik anahtarıyla korunur; süresi geçmiş işleyici yeni send başlatamaz.
8. Ağ zaman aşımı, bağlantı kopması veya send sonrası DB hatasında otomatik send tekrarı varsayılan olarak kapalıdır. Brevo etiketi ve olay API'siyle sonuç aranır. Doğrulanmış gönderim/teslim bulunduğunda QR ve onay tamamlanır; kesin reddedildiği kanıtlanırsa uygun hata/kota durumuna geçilir. Sonuç yokluğu gönderilmediğinin kanıtı sayılmaz.
9. Tekrar anahtarı ek savunmadır; tek güvence değildir. Güncel Brevo rehberi TTL'yi 30 dakika, eski resmî duyuru 15 dakika olarak veriyor. Kullanılacak HTTP istek biçiminin aynı UUID ile ikinci çağrıda `duplicate_parameter` döndürdüğü test alıcısında doğrulanır. Bu doğrulama olmadan belirsiz send için otomatik retry açılmaz. Doğrulansa bile planın otomatik tekrar penceresi ilk denemeden itibaren en fazla 10 dakikadır; bu bir uygulama sınırıdır. Pencere aşılırsa yalnızca uzlaştırma ve yönetici incelemesi yapılır.
10. `duplicate_parameter` yeni bir mesaj kimliği döndürmeyebilir. Bu yanıt tek başına kişiyi onaylamaz; webhook veya olay API'si üzerinden mevcut mesaj bulunur. Aynı işin anahtarı değiştirilerek hatanın etrafından dolaşılmaz.
11. Kesin reddedilmiş hız sınırı ve geçici hatalar artan gecikmeyle bekler; `x-sib-ratelimit-*` başlıkları gözetilir. 5xx veya yanıt kaybında sağlayıcı kabulü belirsizse 8. adım uygulanır. Geçersiz adres tek satırı durdurur; hatalı API anahtarı, pasif transactional hesap veya gönderici problemi hesabın gönderim işleyicisini durdurup panelde kurulum hatası gösterir.
12. Günlük kota dolunca Brevo'ya henüz verilmemiş işler `quota_wait` durumunda Supabase'de kalır. Brevo tarafından zaten kabul edilmiş işler `provider_accepted` olarak izlenir; kota yenilendi diye tekrar gönderilmez. Yerel bütçe ve sağlayıcı kredi sorgusu için ortak hesap kilidi kullanılır. Kesinliği olmayan rezervasyonlar inceleme tamamlanmadan serbest bırakılmaz.
13. Tarayıcı düzenli aralıklarla grup özetini okur. Otomatik gönderim tarayıcıya veya kullanıcı bilgisayarına bağlı değildir.

Kaynaklar: [Supabase zamanlama](https://supabase.com/docs/guides/functions/schedule-functions), [Brevo gönderim endpoint'i](https://developers.brevo.com/reference/send-transac-email), [güncel idempotency rehberi](https://developers.brevo.com/docs/heterogenous-versions-batch-emails), [eski 15 dakika duyurusu](https://developers.brevo.com/changelog/2021/11/10).

**Uygulama öncesi sözleşme testi:** Güncel rehber `headers.idempotencyKey` örneği veriyor; genel API referansındaki `Idempotency-Key` örneğiyle yazım farkı var. Seçilen doğrudan HTTP çağrısı gerçek test hesabında doğrulanıp çalışan biçim testte sabitlenir. Gönderim için otomatik SDK tekrarları kullanılmaz; bütün denemeleri kalıcı işleyici yönetir. Test başarısızsa ilk gönderim, webhook ve olay sorgulaması çalışmaya devam eder; yalnızca belirsiz gönderimi otomatik tekrarlama özelliği kapalı kalır.

### Webhook doğrulaması ve durum eşlemesi

- `/api/webhooks/brevo`, Brevo webhook tanımındaki `auth.type=bearer` ve `auth.token` ile korunur. `BREVO_WEBHOOK_TOKEN` ayrı bir rastgele sırdır; API anahtarıyla aynı değer kullanılmaz. HTTPS üzerinde Authorization başlığı sabit zamanlı karşılaştırılır. Brevo için doğrulanmamış HMAC/imza başlıkları varsayılmaz.
- Eksik/yanlış token 401 ile reddedilir. Gövde boyutu, JSON şeması ve olay türü denetlenir. Token ve ham kişisel veriler loglanmaz. IP kısıtı eklenirse yalnızca Brevo'nun güncel yayımladığı aralıklar ve platformun güvenilir kaynak-IP bilgisi kullanılır.
- İş kimliği gönderimdeki Brevo etiketiyle ilişkilendirilir; `message-id` ve beklenen alıcı da eşleşmelidir. API cevabı gelmeden webhook ulaşırsa olay etiketten bulunur, mesaj kimliği bağlanır. SMTP ile giden personel mesajları başvuru onayı tetiklemez.
- Brevo webhook aboneliğinde `sent` seçilir; bu olayın payload'ında `event: request` gelir. API olay raporundaki türler aynı iç olay modeline dönüştürülür. `request` veya `delivered` onay/QR sonlandırır. `deferred` bekleme bilgisidir, tek başına onay oluşturmaz. Hard bounce, blocked, invalid, spam, error ve unsubscribe görünür hata/iletişim engeli oluşturur; send yapılmasını otomatik tetiklemez.
- Tekilleştirme anahtarı normalize mesaj kimliği + alıcı özeti + olay türü + sağlayıcı olay zamanı üzerinden oluşturulur. `id` alanının bütün bildirimlerde benzersiz olay kimliği olduğu varsayılmaz. Webhook/API aynı olay için farklı hassasiyette zaman verirse iş durumuna uygulama da idempotent olur; ikinci onay/QR oluşmaz.
- Önce olay kalıcı kaydedilir; 2xx yalnızca bu kayıt başarılıysa döner. Sonlandırma başarısızsa kalıcı olay daha sonra yeniden işlenir. Geçici DB erişim hatasında 429 kullanılır. Brevo'nun dokümanına göre 429 dışı 4xx ve 5xx yanıtları tekrar denemelerini durdurabilir; geçici hata için rastgele 500 döndürülmez.
- Geç gelen olay, yönetici tarafından iptal edilmiş başvuruyu tekrar açamaz; QR'ı etkinleştiremez. Gönderim sürümü kontrol edilir.
- Gönderim doğrulanmadan kalıcı hata geldiyse kişi onaylıya geçmez. Gönderim daha önce doğrulanmış ve onay oluşmuşsa sonradan bounce/şikâyet onayı geri almaz; görünür iletişim hatası oluşturur. Ters sırada gelen olaylar kendi zamanları ve gönderim kanıtıyla uzlaştırılır.

Kaynaklar: [Brevo webhook güvenliği](https://developers.brevo.com/docs/secured-webhooks), [transactional olay şemaları](https://developers.brevo.com/docs/transactional-webhooks), [webhook tekrar kuralları](https://developers.brevo.com/docs/retry-mechanism).

### Webhook gelmezse

- Aynı dakika zamanlayıcısında, gönderimlerden ayrı bir iş adımı olarak en fazla 20 bekleyen mesajın olayları sorgulanır. `GET /v3/smtp/statistics/events`; biliniyorsa mesaj kimliği, yoksa eşsiz iş etiketi, tarih aralığı ve alıcıyla aranır. Yanıt sayfalanır; zaman aralıkları biraz örtüştürülür, olaylar tekilleştirilir.
- İlk 10 dakika boyunca dakikada bir, ardından beş dakikada bir, bir saatten sonra saatte bir uzlaştırılır. Send yapılmaz. 24 saatte sonuç yoksa yöneticiye görünür inceleme gerekir; “başarısız, tekrar gönder” diye varsayılmaz.
- Brevo'da bekleyen işler sağlayıcı hatası veya mesaj sonucu görülene kadar saklanır. Gecikmiş olaylar daha sonra da doğru kayda uygulanır.
- Sonuçsuz iş için yönetici sağlayıcı logunu inceleyip açık bir yeniden gönderim seçebilir. Arayüz önceki mesajın ulaşmış olabileceğini söyler; yeni gönderim ayrı sürüm olur ve audit kaydına girer. Bu durumda dış sistemde mutlak tek gönderim garantisi verilemez.
- Panel/worker sağlığı son başarılı Cron çalışması ve son webhook/olay sorgulamasıyla izlenir; yeni mesajlar 10 dakikadan uzun süre işlenmiyorsa uyarı görünür.

Kaynak: [Brevo transactional olay raporu API'si](https://developers.brevo.com/reference/get-email-event-report).

## 7. QR ve giriş kaydı

### QR içeriği

- Önerilen veri biçimi: sürüm öneki `AERO1:` ve kriptografik olarak rastgele 32 baytlık, URL güvenli metin.
- QR'ın içinde ad, soyad, e-posta, sıra numarası veya tahmin edilebilir başvuru kimliği bulunmaz.
- Tarayıcı bu değeri yetkili doğrulama endpoint'ine gönderir. QR'ın kendisi herkese açık bir kişi detay sayfası açmaz.
- Yeniden baskı için ham değer erişimi kapalı `qr_credentials` tablosunda tutulur; genel liste sorgularına eklenmez. Hash alanı doğrulama araması içindir. Ham değer sadece admin baskı/indirme işleminde sunucudan döner.
- Manuel kod rastgele, okunabilir 10 karakterdir; benzersizlik kontrolü vardır. Manuel doğrulama aynı yetki ve hız sınırlarına tabidir.
- QR oluşturma sırasında eşsiz indeks çakışması olursa başka rastgele değer üretilir.
- Bir QR'ı kopyalamak ikinci kişiye ayrı hak vermez; aynı kimlik için tek giriş kuralı uygulanır. Görevli ekrandaki isimle yaka kartını karşılaştırır.

QR kütüphanelerinin özellikleri uygulama sırasında sabitlenecek sürümle denenir: [qrcode üreticisi](https://github.com/soldair/node-qrcode), [qr-scanner okuyucusu](https://github.com/nimiq/qr-scanner). Tarayıcıya yalnızca `/tara` açıldığında kamera kütüphanesi yüklenir.

### Atomik check-in

- Sunucu görevlinin aktif hesabını ve etkinlik yetkisini doğrular.
- QR biçimi/uzunluğu denetlenir; eşleşen aktif QR ve onaylı başvuru bulunur.
- Etkinlikte giriş kapalıysa kayıt yapılmaz.
- QR geçerliliği, başvuru onayı ve ilk giriş kaydı tek veritabanı işlemi içinde kontrol edilir; iptal/QR yenilemeyle yarış koşulu önlenir.
- Benzersiz indeks sayesinde iki telefon aynı anda taradığında biri ilk giriş, diğeri daha önce giriş sonucu alır.
- İstek kimliğiyle tekrar deneme desteklenir: Sunucu kaydı yaptıktan sonra telefon yanıtı kaybederse aynı istek önceki sonucunu alır.
- Personel serbest başvuru listesi veya e-posta listesi çekemez; yalnızca geçerli kodun sınırlı sonucunu görür.

İlk sürüm çevrimiçi çalışır. İnternet tamamen kesilirse güvenli yerde tutulan basılı katılımcı listesi ve tek sorumlu üzerinden manuel kayıt yedeği kullanılır; sonradan yönetici kaynak açıklamasıyla içeri işler. Çevrimdışı çok cihazlı QR senkronizasyonu ayrı kapsamdır.

## 8. Yetki ve uygulama sınırları

| İşlem | Admin | Görevli | Oturumsuz |
|---|---|---|---|
| Başvuru ekleme/düzenleme, komite tanımlama | Evet | Hayır | Hayır |
| Toplu e-posta, yeniden gönderim, iptal | Evet | Hayır | Hayır |
| QR indirme, baskı, kişi dışa aktarma | Evet | Hayır | Hayır |
| Kodla doğrulama ve giriş kaydı | Evet | Evet | Hayır |
| Tüm kişi/e-posta listesini okuma | Evet | Hayır | Hayır |

- Supabase RLS bütün ilgili tablolarda etkin. `anon` erişimi kapalı; görevliye doğrudan kişi ve QR tablosu okuma hakkı verilmez.
- Normal yönetim işlemleri kullanıcı oturumlu Supabase istemcisi ve RLS ile yürür. Gerekli özel RPC'ler rol/etkinlik kontrolü yapar; `SECURITY DEFINER` kullanılırsa sabit `search_path` ve dar EXECUTE yetkisi gerekir.
- Service role/secret anahtarı yalnızca güvenilir sunucu, işleyici ve webhook sonlandırması için kullanılır. İstemci paketinde bulunmaz. RLS'yi aşan bu yollarda giriş verisi ve işlem kapsamı ayrıca sınırlandırılır.
- Sunucu `getClaims()` veya uygun yerde `getUser()` ile kimliği doğrular. Sadece `getSession()` sonucuna veya tarayıcıdaki role güvenilmez. [Supabase SSR belgesi](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&queryGroups=framework).
- Güncel dokümandaki `proxy.ts` örneği Next.js 15'e aynen kopyalanmaz; mevcut sürümde oturum yenileme `middleware.ts` düzenine uyarlanır. Endpoint'lerin kendi yetki kontrolü yine zorunludur.
- Panel, tarama ve çıktı yanıtları `private, no-store`; sayfalar `noindex`. Gizlilik robots etiketine değil oturum ve yetkilere dayanır.
- Değişiklik yapan cookie tabanlı endpoint'lerde origin/CSRF kontrolü, JSON doğrulaması ve rol bazlı hız sınırı uygulanır. GET istekleri giriş kaydı oluşturmaz.
- Giriş denemeleri, manuel kod ve QR doğrulamasında hız sınırı kalıcı/ortak depoyla uygulanır; serverless süreç belleğine bırakılmaz.
- CSV dışa aktarmada formül çalıştırabilecek hücreler güvenli hale getirilir.
- Saklama süresi organizasyon tarafından yayın öncesi belirlenir; ilk sürüm sessiz otomatik silme yapmaz. Veriler, QR listeleri ve yedekler repoya veya herkese açık depoya konmaz.

## 9. Dosya ve modül planı

Aşağıdakiler gelecekteki uygulama dosyalarıdır; şu an oluşturulmaz.

| Dosya / dizin | İşlem ve sorumluluk |
|---|---|
| `app/layout.tsx` | Ortak HTML, fontlar ve metadata; tanıtım efektlerini alt layout'a ayır. |
| `app/(site)/layout.tsx`, `app/(site)/page.tsx` | Mevcut sayfayı aynı `/` URL'siyle taşı; mevcut efektleri burada tut. |
| `app/(operations)/layout.tsx` | Hafif panel/kamera kabuğu; kapalı sayfa metadata'sı. |
| `app/(operations)/giris/page.tsx` | Giriş ve parola sıfırlama arayüzü. |
| `app/(operations)/panel/layout.tsx` | Admin kontrolü ve panel menüsü. |
| `app/(operations)/panel/basvurular/page.tsx` | Başvuru listesi, ekleme/düzenleme, tablo yapıştırma. |
| `app/(operations)/panel/onay/page.tsx` | Komite eşleme, seçim özeti, e-posta önizlemesi. |
| `app/(operations)/panel/onaylananlar/page.tsx` | Onaylılar, QR, e-posta ve giriş durumları. |
| `app/(operations)/panel/gonderimler/page.tsx` | Grup ilerlemesi ve hatalı işler. |
| `app/(operations)/panel/kartlar/page.tsx` | Admin baskı çıktısı. |
| `app/(operations)/panel/ayarlar/page.tsx` | Komiteler, personel ve etkinliğin giriş açık/kapalı ayarı. |
| `app/(operations)/tara/page.tsx` | Staff/admin kamera ekranı. |
| `components/panel/`, `components/check-in/`, `components/badges/` | Formlar, tablolar, seçim, kamera, sonuç ve baskı bileşenleri; tek dev sayfa dosyası oluşturma. |
| `lib/content.ts` | Ekran metinleri, hata karşılıkları ve kabul e-postası şablon metni. |
| `lib/supabase/browser.ts`, `server.ts`, `admin.ts` | Tarayıcı/oturumlu sunucu/ayrıcalıklı sunucu istemcileri; admin modülü server-only. |
| `lib/auth/permissions.ts`, `middleware.ts` | Aktif üyelik/rol kontrolü ve oturum yenileme. |
| `lib/applications/validation.ts`, `service.ts` | Veri doğrulama, tekrar kayıt ve başvuru işlemleri. |
| `lib/mail/approval-template.ts`, `jobs.ts` | Şablonun güvenli HTML/metin çıktısı ve kalıcı gönderim oluşturma. |
| `lib/mail/brevo-events.ts` | Brevo webhook/rapor olaylarını iç durum modeline çevirme, alıcı/etiket eşleme ve tekilleştirme. |
| `lib/qr/credentials.ts`, `lib/check-in/service.ts` | QR baskı yetkisi, QR üretim parametreleri ve giriş sözleşmesi. |
| `app/api/panel/` | Başvuru, komite, personel, grup, yeniden gönderim, QR, iptal ve dışa aktarma endpoint'leri. |
| `app/api/check-in/route.ts` | Yetkili QR/manuel kod POST işlemi. |
| `app/api/webhooks/brevo/route.ts` | Bearer token ile doğrulanan Brevo olaylarını kalıcı kaydetme ve sonlandırma. |
| `supabase/migrations/` | Tablolar, indeksler, RLS, atomik onay/QR/check-in/kuyruk işlevleri. |
| `supabase/functions/process-mail-queue/index.ts` | Gönderim ve uzlaştırma adımlarını süre bütçesiyle çalıştıran işleyici; şablon tekrar yazılmaz, işteki sabit içerik kullanılır. |
| `supabase/functions/process-mail-queue/brevo-client.ts` | Brevo HTTP gönderimi, kredi ve olay sorguları; gizli otomatik send retry yok. |
| `supabase/functions/process-mail-queue/reconcile.ts` | Kabul edilmiş/belirsiz işleri mesaj kimliği veya etiketle uzlaştırma; sorgu aralıkları ve kalıcı imleç. |
| `supabase/tests/` | Veritabanı yetkileri, benzersizlik ve eşzamanlı işlem testleri. |
| `tests/unit/`, `tests/integration/`, `tests/e2e/` | İş kuralları, endpoint/sağlayıcı ve uçtan uca testler. |
| `package.json`, `package-lock.json`, `.env.example` | Gerekli paketler, test komutları ve yalnızca değişken adları. |
| `docs/operations/aero-etkinlik-gunu.md` | Hesap açma, kota, hatalı gönderim, baskı, tarama ve kesinti yönergesi. |

### Ortam yapılandırması

- Tarayıcıya açık: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
- Yalnızca Next.js sunucusu: `SUPABASE_SECRET_KEY` veya projenin desteklediği service-role karşılığı, `BREVO_WEBHOOK_TOKEN`.
- Yalnızca gönderim işleyicisi: `BREVO_API_KEY`, `MAIL_QUEUE_SECRET`, doğrulanmış gönderici/yanıt adresi; Supabase sunucu erişimi. Brevo anahtarı hem send hem uzlaştırma okumaları için gerekli kapsama sahip olur.
- Cron çağrı sırrı Supabase Vault'ta saklanır; migration içinde gerçek sır bulunmaz.
- Brevo SMTP kullanıcı adı ve ayrı SMTP anahtarı Supabase Auth ayarına girilir; frontend'e taşınmaz. Webhook token'ı Brevo webhook tanımına; API anahtarı Edge Function sırrına yerleştirilir. Üçü birbirinin yerine kullanılmaz.
- `MAIL_DAILY_APPROVAL_BUDGET` varsayılan 290; `MAIL_AUTH_RESERVE` varsayılan 10. Toplam sağlayıcının doğrulanmış hakkını aşmaz. Bu ayarlar Supabase'de yönetici kontrollü tutulabilir; frontend değeri yetkili sınır kabul edilmez.
- `BREVO_UNCERTAIN_RETRY_ENABLED` varsayılan false. Yalnızca sözleşme testinin geçtiği istek biçimiyle etkinleştirilebilir; ilk denemeden 10 dakika sonra yeniden send yine kapalıdır.
- Test ve canlı ortam ayrılır. Test ortamında alıcı allowlist'i bulunur; gerçek başvuranlara yanlışlıkla e-posta çıkmaz.

## 10. Uygulama sırası ve kabul testleri

Her aşama kendi çıktısıyla doğrulanır. Bu maddelerin hiçbiri bu plan hazırlanırken uygulanmadı.

### Aşama 1 — Veri ve rol temeli

**Dosyalar:** Supabase migrations/tests, `lib/supabase/*`, `lib/auth/permissions.ts`, `.env.example`, paket/test yapılandırması.

- [ ] Ayrı test projesi veya yerel Supabase ortamı hazırla; mevcut başka projeyi/servisi değiştirme.
- [ ] Şema, benzersiz indeksler ve RLS için önce yetki/tekrar kayıt testlerini yaz; eksik davranışların başarısız olduğunu göster.
- [ ] Tablo ve rol kurallarını uygula; ilk admin'i kontrollü sunucu işlemiyle oluştur.
- [ ] Aktif olmayan staff'ın ve `anon` kullanıcısının verilere erişemediğini test et.
- [ ] Aynı e-posta için eşzamanlı iki kayıt isteğinin yalnızca bir kayıt oluşturduğunu doğrula.

**Çıktı:** Korunan veritabanı ve çalışan yönetici/görevli kimliği.

### Aşama 1B — Brevo hesabı ve gönderim sözleşmesi

**Dosyalar:** `.env.example`, `supabase/functions/process-mail-queue/brevo-client.ts`, `tests/integration/brevo-contract.test.ts`, etkinlik günü yönergesi. Bu aşama yalnızca test hesabı/test alıcılarıyla uygulanır.

- [ ] Free hesabın transactional gönderime açık olduğunu, gönderen domain/adresini ve günlük 300 hakkını hesap panelinde doğrula; hesap kısıtlıysa gerçek başvuru gönderimini kapalı tut.
- [ ] Brevo'nun hesap için gösterdiği DNS kayıtlarını doğrula; mevcut DMARC ve posta hizmetini koru.
- [ ] Kabul mesajları için API anahtarını, Auth için ayrı SMTP anahtarını ve webhook için ayrı bearer token'ı yapılandır.
- [ ] Tek test alıcısına HTTP API ile mesaj gönder; 201/messageId, tag, sent aboneliğinin `request` payload'ı ve delivered olayını gözle.
- [ ] Aynı UUID/içerikle ikinci test isteğini gönder; `duplicate_parameter` ve tek gerçek mesaj beklentisini kontrol et. Geçmezse belirsiz send otomatik tekrarını kapalı bırak; çalışan ilk gönderim + uzlaştırma yolunu koru.
- [ ] Kredi API'sinin hesabın günlük kalan hakkını nasıl gösterdiğini, kota yenilenmesini ve SMTP tüketiminin yansımasını doğrula; hesap genelindeki bilgiler log çıktısına taşınmasın.
- [ ] Parola sıfırlama e-postasını yalnızca test personeline SMTP üzerinden gönder; başarısız bağlantıda SMTP/API anahtarı ayrımını kontrol et.

**Çıktı:** Gönderen kimliği doğrulanmış Brevo bağlantısı ve güvenilir tekrar/olay davranışı; tahminle kurulmuş bir retry mekanizması yok.

### Aşama 2 — Hafif ekran kabuğu ve başvuru paneli

**Dosyalar:** Root/site/operations layout'ları, giriş ve başvuru ekranları, `components/panel/*`, başvuru servisi/endpoint'leri, `lib/content.ts`.

- [ ] Mevcut `/` sayfasının ekran görüntüsü ve davranışını referans al.
- [ ] Tanıtım efektlerini site layout'una ayır; panel ve `/tara` yükünde kamera/animasyon gereksiz yere çalışmasın.
- [ ] Admin girişini, tekil kişi eklemeyi, düzenlemeyi, aramayı ve tablo yapıştırmayı kur.
- [ ] Çok kelimeli ad, Türkçe karakter, boş satır, geçersiz adres, tekrar adres ve eşzamanlı düzenleme senaryolarını test et.
- [ ] Çok sayfalı seçimde toplamın doğru olduğunu; yalnızca seçili kayıtların sonraki ekrana taşındığını doğrula.

**Çıktı:** Dışarıdan gelen listeyi güvenli biçimde kaydedebilen panel; mevcut tanıtım sayfasının görünümü korunmuş.

### Aşama 3 — Komite, e-posta önizleme ve kuyruk oluşturma

**Dosyalar:** Onay/ayarlar ekranları, `lib/mail/*`, panel endpoint'leri, ilgili migration ve testler.

- [ ] Komite ekleme/pasifleştirme ve kişiye/toplu komite atamayı kur.
- [ ] Ad-soyad-komite değişkenli HTML/düz metin e-postayı önizlet.
- [ ] İstek kimliği ve başvuru sürümünü kullanarak grup ve kişi işlerini transaction içinde oluştur.
- [ ] Çift tık, iki admin'in aynı kişiyi seçmesi, komitesiz kişi ve önizlemeden sonra değişen kayıt testlerini çalıştır.
- [ ] Kuyruktaki kişi henüz onaylı listesine geçmesin; eski kayıt üzerine sessiz gönderim yapılmasın.

**Çıktı:** Kişi ve içerikleri belirli, tekrar oluşturmaya dayanıklı gönderim grubu.

### Aşama 4 — Gönderim işleyicisi ve webhook

**Dosyalar:** Edge Function ve Brevo istemcisi/uzlaştırma modülü, Cron/Vault kurulumu, gönderimler ekranı, `/api/webhooks/brevo`, onay sonlandırma RPC'si, entegrasyon testleri.

- [ ] Sağlayıcı taklidiyle 201/messageId, `duplicate_parameter`, 429, kredi tükenmesi, kalıcı hata, zaman aşımı ve gönderim sonrası DB hatası testlerini önce yaz.
- [ ] Kilit süreli kuyruk alımını, UUID tekrar anahtarını, ortak kota rezervasyonunu ve `provider_accepted`/`uncertain` durumlarını uygula.
- [ ] HTTP 201'de QR oluşmadığını; `request` veya `delivered` olayı geldiğinde onay ve tek QR kaydının atomik oluştuğunu doğrula.
- [ ] Doğru/yanlış/eksik webhook bearer token'ını, aynı kimlikli farklı olayları, yinelenen olayları ve iptal sonrası geç olayı test et. API cevabından önce webhook gelmesi de kapsansın.
- [ ] Kalıcı olay kaydı başarısızken 2xx dönmediğini; geçici DB hatasının 429'a çevrildiğini doğrula. Brevo'nun webhook tekrarları hiç gelmese bile olay sorgusu sonucu tamamlasın.
- [ ] Personel SMTP mesajının veya başka başvuruya ait tag/alıcı eşleşmesinin yanlış kişiyi onaylamadığını test et.
- [ ] Panel kapalıyken kuyruk ilerlesin; işleyici yarıda durdurulduğunda kalıcı kayıtlardan devam etsin.
- [ ] Varsayılan ayarda timeout sonrası ikinci send olmadığını doğrula. Tekrar özelliği sözleşme testiyle açılmışsa ilk denemeden 10 dakika sonraki belirsiz işte send yine kapalı olsun; `duplicate_parameter` tek başına onay vermesin.
- [ ] Brevo'nun kendi kuyruğuna aldığı mesajı sonraki gün yeniden göndermediğimizi, quota_wait işlerinin ise hak açılınca devam ettiğini test et.
- [ ] Hard bounce/blocked/invalid olaylarını ve ardından eski gönderim olayının gelmesini olay zamanlarıyla uzlaştır; ikinci QR veya otomatik send oluşmasın.
- [ ] Domain doğrulandıktan sonra yalnızca belirlenmiş test alıcılarına gerçek gönderimle teslimat görünümünü doğrula.

**Çıktı:** Sekmeden bağımsız e-posta gönderimi ve yalnızca başarılı kişiler için otomatik onay/QR.

### Aşama 5 — Onaylılar, QR ve baskı

**Dosyalar:** Onaylılar/kartlar ekranları, badge bileşenleri, QR modülü ve admin endpoint'leri, baskı stilleri.

- [ ] Listeyi aynı başvuru kayıtlarının `approved` filtresinden üret.
- [ ] QR görüntüleme, SVG/PNG indirme, baskı ve güvenli CSV dışa aktarmayı ekle.
- [ ] Tekrar baskıda QR değişmesin; açık iptal/yenileme işleminde eski QR reddedilsin.
- [ ] Uzun ad/komite ve Türkçe karakterleri PDF önizlemesinde incele; sayfa taşması ve boş sayfa kontrolü yap.
- [ ] Gerçek boyutta basılmış kartı en az bir Android ve bir iPhone ile okut.

**Çıktı:** Yetkili panelden üretilebilen, tekrar basılabilen, okunabilir yaka kartları.

### Aşama 6 — `/tara` ve tek giriş kaydı

**Dosyalar:** Tarama sayfası/bileşenleri, check-in route/servis/RPC, rate-limit ve entegrasyon testleri.

- [ ] İlk giriş, tekrar giriş, geçersiz kod, onaysız kişi, iptal edilmiş QR ve kapanmış etkinlik senaryolarını önce test et.
- [ ] Kamera başlat/durdur, arka kamera seçimi, izin hatası ve manuel kod yolunu kur.
- [ ] Aynı QR'ı iki yetkili telefonla aynı anda okut; veritabanında tek giriş kaydı ve doğru iki sonuç bekle.
- [ ] Kayıt sonrası yanıt kaybını taklit et; aynı istek kimliğiyle tekrar deneme önceki sonucu alsın.
- [ ] İptal ile tarama yarışında transaction kuralları tutarlı kalsın; pasif personel giriş kaydedemesin.
- [ ] İnternet kesikken ekranda sahte başarı görünmesin; kamera görüntüsü sunucuya yüklenmesin.

**Çıktı:** Etkinlik günü telefonla kullanılabilen, eşzamanlı taramaya dayanıklı giriş ekranı.

### Aşama 7 — Tam prova ve yayın hazırlığı

**Dosyalar:** Uçtan uca testler ve etkinlik günü yönergesi; yalnızca gerekli düzeltmeler.

- [ ] Test komutlarını proje script'lerine bağla: birim/entegrasyon, veritabanı politikaları ve tarayıcı uçtan uca testleri.
- [ ] 10, 20, 30, 50, 250 ve 350 kişilik sentetik gruplarla akışı dene; kota senaryolarında sağlayıcı taklidi kullan, gerçek ücretsiz kotayı tüketme.
- [ ] Varsayılan bütçeyle 290/291 kişi sınırını, personel rezervi testte sıfırken 299/300/301 sınırını doğrula. 350 kişide 290 iş gönderime uygun, 60 iş kota bekliyor olsun; başka SMTP kullanımı varsa sayı azalsın.
- [ ] API'nin kabul ettiği ama Brevo kuyruğunda bekleyen mesajların onaylı listesine erken geçmediğini ve tekrar gönderilmediğini doğrula.
- [ ] 50 kişiden 3 gönderim başarısızken 47 onaylı/QR ve 3 görünür hata bekle; tekrar denemede başarılı 47 kişi yeniden e-posta almasın.
- [ ] Başvuru ekleme → komite → e-posta → onaylı liste → kart → telefonla giriş zincirini test alıcılarıyla tamamla.
- [ ] Uygulamada yeni tanımlanan test script'leri, hedefli lint, `npx.cmd tsc --noEmit` ve `npm.cmd run build` çalıştır.
- [ ] Supabase RLS'yi doğrudan API üzerinden admin/staff/anon rolleriyle dene; yalnızca gizli menülere güvenme.
- [ ] Domain HTTPS, Brevo domain/gönderici doğrulaması, aktif transactional hesap, webhook bearer token'ı, olay uzlaştırması ve personel SMTP hesabını yayın öncesi kontrol et.
- [ ] Etkinlikten bir gün önce Supabase'in aktifliğini, yedeği, kota durumunu ve iki farklı telefonla gerçek baskıyı doğrula.
- [ ] Yayın kararı alındığında mevcut deployment sürecini kullan; geçici önizleme ortamından gerçek katılımcılara gönderim çıkmasın.

**Çıktı:** Denenmiş sistem, kullanım yönergesi ve etkinlik günü kontrol listesi.

## 11. Özellikle gözden geçirilecek beş hata türü

1. **E-posta gönderildi, DB yazımı başarısız:** Aşama 1B/4 sözleşme testi, kalıcı iş etiketi ve webhook/olay sorgulamasıyla sonucu belirler; belirsizliği yeni send ile çözmeye çalışmaz.
2. **İki admin aynı kişiyi aynı anda seçti:** Aşama 3 sürüm ve benzersiz iş kuralıyla tek onay gönderimi oluşturur.
3. **İki telefon aynı kartı aynı anda okuttu:** Aşama 6 veritabanında tek giriş oluşturur.
4. **Kota doldu, Brevo kuyruğa aldı veya panel kapandı:** Aşama 4/7 kalan işleri kaybetmez; sağlayıcının yalnızca kabul ettiği kişiyi gönderilmiş saymaz.
5. **Uzun Türkçe isim veya kamera/ağ sorunu:** Aşama 5/6 okunabilir baskı, manuel kod ve açık hata sonucu sağlar.

## 12. Uygulamaya geçerken gereken gerçek bilgiler

Bu bilgiler plan yazımını engellemez; dış servisleri bağlama ve gerçek kullanım aşamasında gerekir:

- Kullanılacak Supabase projesi ve hesapta ücretsiz proje kapasitesi.
- Brevo Free hesabı ve transactional gönderim aktifliği; domainin DNS yönetimine erişim.
- Gerçek komite adları; admin ve görevli hesapları.
- Günlük en yüksek kabul e-postası sayısı: Brevo Free'ın 300/gün toplam sınırı ve varsayılan 290 kabul + 10 personel e-postası payına göre gönderim takvimi.
- Etkinlik tarihi, girişin ne zaman açılıp kapanacağı ve kartlık ölçüsü.
- `aerocalistay.org` domaininin mevcut Vercel projesine bağlantısı ve HTTPS durumu.

## 13. İlk sürüm dışında kalanlar

- Google Form yanıtlarını otomatik çekme ve yeni halka açık başvuru formu.
- Ret e-postası, bekleme listesi, ödeme veya bilet satışı.
- Katılımcı hesabı ve QR'ı katılımcıya e-postayla gönderme.
- WhatsApp/SMS, pazarlama listesi ve gelişmiş e-posta tasarım editörü.
- Çıkış/tekrar giriş takibi, her oturum için ayrı yoklama.
- Çevrimdışı çok cihazlı tarama ve mobil uygulama mağazası yayını.
- Mevcut tanıtım sitesinin yeniden tasarımı veya başvuru döneminin değiştirilmesi.

**Tamamlanma ölçütü:** Yönetici dışarıdan aldığı listeyi panele girebiliyor; seçtiği kişilere doğru komite adıyla e-posta gönderebiliyor; başarılı gönderimler otomatik olarak onaylı ve benzersiz QR sahibi oluyor; kartlar basılıp `/tara` ile güvenilir biçimde tek giriş olarak kaydedilebiliyor. Hatalı ve kotada bekleyen gönderimler açıkça görülüyor, kayıtlar ve işler kaybolmuyor.

## 14. Brevo kararlarının kaynakları ve açık doğrulama sınırı

26 Eylül 2026 araştırmasında ücretsiz kota, transactional API, bearer webhook doğrulaması, SMTP/API anahtarı ayrımı, olay sorgulaması ve webhook hata davranışı resmî kaynaklardan kontrol edildi. İlgili bağlantılar kararların yanında bulunur. Gerçek Brevo hesabı, DNS, API anahtarı ve canlı e-posta gönderimi bu plan çalışmasında denenmedi.

İdempotency süresi ve anahtarın taşındığı alan için resmî belgeler arasında fark vardır. Plan bunu uygulama öncesi sözleşme testi ve varsayılan olarak kapalı belirsiz-send retry ile ele alır. Kota yenilenme saati de hesapta doğrulanmadan sabit kodlanmaz. Bu iki doğrulama yapılana kadar sistemin güvenli davranışı tanımlıdır: işler Supabase'de kalır, doğrulanmış gönderimler onaylanır, belirsiz mesajlar tekrar gönderilmeden araştırılır.

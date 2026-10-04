# AERO arayüz ve işlem geri bildirimi incelemesi

Tarih: 2026-10-04. Kaynak: `codex/immediate-mail-review`, `13fbaa6`.

## Kapsam ve kanıt sınırı

Kullanıcı, dekont kabulü ve başvuru ekleme gibi işlemlerden sonra isimlerin kaybolmasının hata izlenimi yarattığını bildirdi. İstenen çıktı, görünür başarı ekranları ve diğer UI sorunları için uygulama planıdır.

Yerleşik tarayıcıyla canlı ana sayfa, 390 × 844 mobil görünüm, mobil menü, katılımcı giriş ve tokensız aktivasyon sayfası incelendi. `/panel/odemeler`, yönetici oturumu olmadığı için `/giris` sayfasına yönlendi. Admin ve oturum gerektiren katılımcı işlemleri bu incelemede çalıştırılmadı; ilgili bulgular güncel kaynak koduna dayanır. Canlı başvuru, dekont, e-posta veya hesap değiştirilmedi. Önceden istenen tam canlı test bu incelemeyle tamamlanmış sayılmaz.

Öncelik: P1 temel işlemde yanlış/eksik geri bildirim; P2 gezinme, hata kurtarma ve kullanım kolaylığı; P3 içerik cilası.

## Bulgular

| ID | Öncelik | Sorun ve etkisi | Kanıt / kaynak |
| --- | --- | --- | --- |
| UI-01 | P1 | Başvuru kaydedilince alanlar temizleniyor, başarı mesajı üretilmiyor. Kullanıcı kaydın oluşup oluşmadığını anlayamıyor. | Kaynak: `components/panel/ApplicationsClient.tsx:33`, `createApplication`. |
| UI-02 | P1 | Başvuru listesi her yenilemede yükleniyor metniyle tamamen değişiyor. İsimler geçici olarak kayboluyor. `load()` mesajı da siliyor. | Kaynak: `ApplicationsClient.tsx:21`, `:27`, `:53`. |
| UI-03 | P1 | Dekont kabulünde seçili kişinin önizlemesi kaldırılıyor; başarı mesajı sayfanın tepesinde kalıyor. Uzun PDF'nin altındaki butona basan kullanıcı, bulunduğu yerde sonucu göremeyebilir. | Kaynak: `components/panel/PaymentsClient.tsx:52`, `:73`; `app/(operations)/operations.css:17`. Tarayıcıda admin işlemi tekrarlanmadı. |
| UI-04 | P1 | Son dekont kabul edilip liste boşalınca, başarı mesajının varlığı “Liste alınamadı; tekrar deneyin.” metnini tetikliyor. Başarı yanlışlıkla hata gibi sunuluyor. | Kesin kaynak koşulu: `PaymentsClient.tsx:79`, `message ? ...`. |
| UI-05 | P1 | İşlem sonucu ve liste yükleme hatası tek mesaj alanını paylaşıyor. Başarılı kayıt sonrası GET hatası başarıyı örtebilir; kullanıcı işlemi gereksiz yere tekrar deneyebilir. | Kaynak: `PaymentsClient.tsx:30`, `:52`; `components/panel/MealsClient.tsx:14`; `components/participant/ParticipantClient.tsx:18`, `:37`. |
| UI-06 | P2 | Başvuru ekleme, filtreleri sıfırladıktan sonra eski render'ın `load()` fonksiyonunu çağırıyor. Eşzamanlı arama/filtre istekleri için güncellik kontrolü yok. Eski liste yeni filtreyle gösterilebilir. | Kaynak: `ApplicationsClient.tsx:20–39`. Yarış senaryosu kontrollü gecikmeli istek testiyle doğrulanmalı. |
| UI-07 | P2 | Kesin kabul, e-postalar, öğünler ve ayarlar ilk yüklemeyi gerçek boş durumdan ayırmıyor. Henüz veri gelmeden “kayıt yok” veya varsayılan ayar görülebiliyor. | Kaynak: `components/panel/useApproved.ts:7`, `SendingClient.tsx:11`, `MealsClient.tsx:6`, `SettingsClient.tsx:16`. |
| UI-08 | P2 | Kesin kabul iptali/QR yenileme, ayarlar ve e-posta yeniden kuyruğa alma işlemlerinin bazıları ağ hatasını yakalamıyor ve işlem sırasında tekrar tıklamayı engellemiyor. | Kaynak: `ApprovedClient.tsx:11`, `SettingsClient.tsx:29–56`, `SendingClient.tsx:31`. UI iyileştirmesi mevcut sunucu korumalarının yerine geçmez. |
| UI-09 | P2 | Toplu kabul tamamlanınca seçim ve komite bölümleri kaldırılıyor. Sonuç yalnız küçük üst metinde; hangi komite ve kaç kişiyle işlem yapıldığı kalıcı bir sonuç kartında yok. Komite değiştirme açıklaması aday GET'i tarafından silinebiliyor. | Kaynak: `components/panel/ApprovalClient.tsx`, `finish`, `onCommittee`, aday yükleme effect'i. |
| UI-10 | P2 | “Daveti yeniden gönder” ve “Hesap bağlantısını yeniden gönder” düğmeleri yalnız kuyruğa alıyor. Gönderim sonucu sonrası liste, periyodik yenilemeye kadar eski kalabiliyor. | Kaynak: `SendingClient.tsx:21–50` ve satır düğmeleri. Mevcut servis kabulü/teslimat ayrımı korunmalı. |
| UI-11 | P2 | Dekont listesi ve ödeme ayarları aynı `Promise.all` yüklemesine bağlı. Ayar hatası dekontları da engelliyor. Liste yenileme, kaydedilmemiş ödeme ayarlarını sunucu değerleriyle değiştiriyor. | Kaynak: `PaymentsClient.tsx:20–28`. |
| UI-12 | P2 | Katılımcı dekont yükleyince form durum gereği kalkıyor; sonuç küçük üst metinde. `/me` yüklenemediğinde hata metninin yanında “yükleniyor” durumu devam edebiliyor. | Kaynak: `ParticipantClient.tsx:12–49`. Dosya yükleme ile dekont kabulü ayrı durumlar olarak anlatılmalı. |
| UI-13 | P2 | Tokensız aktivasyon sayfası, geçerli bağlantıymış gibi “Hesabını etkinleştir” düğmesi sunuyor. Oturum devam ettirme GET'i başarısız olunca sessizce bu ekrana dönüyor. | Canlı görüldü: `/katilimci/aktivasyon`; kaynak: `components/participant/AuthClient.tsx:14–25`, `:49`. Devam eden doğrulanmış şifre belirleme oturumu istisnası korunmalı. |
| UI-14 | P2 | Giriş ekranında üç işlem bir arada, kurtarma seçeneklerinin farkı anlatılmıyor. Hata ve başarı aynı küçük `ops-note` görünümünde. Ana sayfaya dönüş ve şifreyi göster seçeneği yok. | Canlı: `/katilimci/giris`, mobil screenshot. Kaynak: `AuthClient.tsx:114–126`. |
| UI-15 | P2 | `/giris/katilimci` 404 veriyor; doğru yol `/katilimci/giris`. İncelenen kaynakta yanlış yolu üreten bağlantı bulunmadı. Kullanıcı bu yola dışarıdan veya elle gelmiş olabilir. | Canlı 404 screenshot; mevcut route: `app/(operations)/katilimci/giris/page.tsx`. |
| UI-16 | P2 | Ana sayfada ve mobil menüde katılımcı portalına bağlantı yok. “Katılım” ana sayfanın başına gidiyor; “Başvurular kapanmıştır” ekip başvurusuna ait olsa da katılımcı girişiyle ayrımı görünür değil. | Canlı ana sayfa ve mobil menü; `components/nav/StickyNav.tsx`, `lib/content.ts`. |
| UI-17 | P2 | Panel menüsü etkin bölümü göstermiyor; bütün bağlantılar aynı. Küçük ekranda geniş tablolar yatay kaydırma gerektiriyor, satır işlem düğmeleri 34 px yüksekliğinde. | Kaynak: `app/(operations)/panel/layout.tsx:13`, `operations.css:11–13`, `:45`, `:50`. Mobil admin ekranı canlı görülmedi; uygulama sırasında kontrol gerekli. |
| UI-18 | P2 | Disiplinler çarkı yalnız imleç hareketi veya dokunmatik kaydırmayla değişiyor. Odaklanabilir seçim/klavye yöntemi yok; `role="img"` altında etkileşim saklı. | Kaynak: `components/ui/DisciplineWheel.tsx`, `onPointerMove`, `role="img"`. Canlı erişilebilirlik ağacında seçim düğmeleri yok. |
| UI-19 | P3 | Ana sayfada “GÖRSEL YAKINDA” alanları yayın tamamlanmamış izlenimi verebilir. | Canlı içerik. Gerçek görsel sağlanana kadar boş galeriyi gizlemek; görsel uydurmamak. |

Not: Dekont satırları mevcut kodda `loading` sırasında tamamen gizlenmiyor; UI-02 başvuru listesine aittir. Dekontta belirgin kaybolma, seçili önizlemenin kaldırılmasıdır. Renk kontrastı, ekran okuyucu davranışı ve gerçek cihaz testi ölçülmedi; bunlar doğrulanmış kusur olarak sunulmuyor.

## Önerilen kullanıcı deneyimi

Öncelikli iki işlemde geçici toast yerine, işlem alanında görünür ve kullanıcı kapatana/yeni işleme geçene kadar kalan başarı kartı gösterilsin.

- Başvuru: **“Başvuru başarıyla eklendi”** → kişinin adı ve e-postası → “Onay bekleyenlere eklendi. Bu işlemde e-posta gönderilmedi.” → **“Toplu kabul ekranına git”**, **“Yeni başvuru ekle”**.
- Dekont: **“Dekont başarıyla kabul edildi”** → kişinin adı ve e-postası → “Başvuru kesin kabul edildi. Katılımcının QR koduna erişimi açıldı.” → **“Kesin kabul edilenleri görüntüle”**, **“Başka dekont incele”**. Kart, kaldırılan önizlemenin yerinde görünür; odağı başlığına taşır. Bekleyenler listesinden çıkışın nedeni açıkça yazılır.
- Dekont yükleme: **“Dekont incelemeye gönderildi”** → “Komite incelemesi bekleniyor. Kabul edildiğinde QR kodunuz açılacak.” Yükleme, ödeme kabulü gibi anlatılmaz.
- Toplu kabul: komite adı ve aday sayısı sonuç ekranında kalır; servis kabulü, teslim edildi, bekleyen, sorunlu ve belirsiz adetleri ayrı gösterilir. Kısmi sonuç tamamen başarılı diye sunulmaz.

İlk yükleme, yenileme, boş liste, hata ve işlem sonucu ayrı durumlar olmalı. Yenilemede mevcut bilgiler görünür kalır; sonuç mesajı GET başarısıyla silinmez. GET hatası, başarılı POST'u başarısız gibi göstermez. Belirsiz POST sonucunda otomatik tekrar gönderim yapılmaz.

## Kanıt dosyaları

- [404 görünümü](C:/Users/kağan/.codex/visualizations/2026/10/03/01a103d4-5876-73e3-ae07-ad2c18c06e49/ui-audit-404.png)
- [Masaüstü ana sayfa](C:/Users/kağan/.codex/visualizations/2026/10/03/01a103d4-5876-73e3-ae07-ad2c18c06e49/ui-audit-home-desktop.png)
- [Mobil katılımcı girişi](C:/Users/kağan/.codex/visualizations/2026/10/03/01a103d4-5876-73e3-ae07-ad2c18c06e49/ui-audit-participant-login-mobile.png)
- [Tokensız aktivasyon](C:/Users/kağan/.codex/visualizations/2026/10/03/01a103d4-5876-73e3-ae07-ad2c18c06e49/ui-audit-activation-without-token.png)

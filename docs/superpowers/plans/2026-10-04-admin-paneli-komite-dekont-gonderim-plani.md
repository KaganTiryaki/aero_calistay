# AERO admin paneli: komite, dekont ve gönderim uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Kullanıcının ayrıca istemediği paralel agent çalışmasını kendiliğinden başlatma.

**Goal:** Yönetici komiteyi seçip adayları belirledikten sonra tek toplu gönderim başlatabilsin; yüklenen dekontlara doğrudan ulaşabilsin ve e-posta durumlarını yanlış anlamadan takip edebilsin.

**Architecture:** Mevcut Next.js yönetici ekranları ve Supabase işlevleri kullanılacak. Tek toplu seçim tek `mail_batch` oluşturacak; mevcut işçi gönderimleri en fazla üç kişilik adımlarla işleyecek. Ekranlar ortak bir gönderim sonucu sözleşmesini kullanacak; dekontlar özel depoda kalıp yöneticiye süreli bağlantıyla gösterilecek.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase Auth/Postgres/private Storage, mevcut Brevo işçisi, Node test runner ve PGlite.

**Spec:** Bu dosyanın “Kullanıcı gereksinimleri ve ekran kararı” bölümü; kullanıcının 4 Ekim 2026 tarihli admin paneli geri bildirimi.

**Durum (4 Ekim 2026):** Kullanıcının “uygula” talebi üzerine ürün kodu ayrı çalışma dalında uygulandı ve yerel testlerden geçti. Üretim veritabanı, canlı yapılandırma, yayın ve gerçek e-posta henüz değiştirilmedi. Uygulama kanıtı ve kalan yayın adımları `docs/reviews/2026-10-04-admin-paneli-komite-dekont-gonderim.md` dosyasındadır.

## Çalışma alanı ve başlangıç durumu

- Uygulamanın çalışılan checkout'u: `C:/Users/kağan/.codex/worktrees/immediate-mail-live/Users__kağan__Desktop__aero_cal`.
- Dal: `codex/immediate-mail-review`; incelenen HEAD: `e22e50f`.
- Kullanıcının ana klasörü: `C:/Users/kağan/Desktop/Projeler/Users__kağan__Desktop__aero_cal`. Buradaki mevcut planlar korunur; uygulama kodu bu landing checkout'a kopyalanmaz.
- Planın iki klasördeki kopyası aynı tutulur. Uygulama sırasında bu dosyanın görev kutuları güncellendiğinde iki kopya birlikte güncellenir.
- `supabase/.temp/`, mevcut özel yedekler, kimlik bilgileri ve ilgisiz dosyalar kapsam dışıdır.
- Son önceki doğrulama 147 testtir. Bu plan hazırlanırken testler tekrar çalıştırılmadı; yeni uygulamanın tabanını uygulama başlangıcında yeniden ölç.

## Doğrulanan bulgular

| Bulgu | Kanıt | Plana etkisi |
|---|---|---|
| “Diğer işlemler” bir sayfa değil, açılır menü | `app/(operations)/panel/layout.tsx` içinde `details/summary`; ödeme bağlantısı `operations.nav.slice(4)` içinde | Gerçek bir yardımcı işlemler sayfası oluştur; dekont ekranını ana menüye taşı |
| Açılır menünün taşma alanı sorunlu olabilir | `.ops-nav` yatay taşmayı kaydırıyor; alt menü mutlak konumlanıyor | Kırpılma ihtimali koddan görülüyor, canlı tarayıcıda henüz yeniden üretilmedi; mobil/masaüstü kabul testi zorunlu |
| İncelemeye hazır dosya mevcut | Salt okunur canlı sorguda bir `under_review` kayıt, `file_sha256` dolu ve Storage nesnesi mevcut | Önce erişim ve listeleme sorununu çöz; dosyayı tekrar yüklemeyi çözüm sayma |
| Mevcut dosya kaydı JPEG | Son kaydın `expected_mime=image/jpeg` | Kullanıcının sözünü ettiği PDF ile aynı dosya olduğu varsayılmadı. PDF ve JPEG ayrı test edilecek |
| Dekont ekranı ayar formuyla başlıyor | `components/panel/PaymentsClient.tsx` ayarları listenin üstünde gösteriyor | İnceleme listesini öne çıkar, ayarları ikincil alana taşı |
| “Dekontu görüntüle” indirme bağlantısına gidiyor | GET `/api/panel/payments?receipt=...` her zaman `download: "dekont"` imzalıyor; UI `window.location.assign` kullanıyor | Panel içinde önizleme ve uzantısı doğru ayrı indirme eylemi ekle |
| Ödeme başvuru sürümü listede eksik | `list_payment_reviews` içindeki `application` JSON'unda `version` yok; UI `selected.application.version` ile PATCH yapıyor | Yeni ileri migration ile sürümü JSON'a ekle ve uçtan uca doğrula |
| Gönderim sonucunun istemci/sunucu alanları uyuşmuyor | `ApprovalClient` `providerAccepted/failed/unresolved/firstError` okuyor; API `acceptedTotal/failedTotal/pending/uncertainTotal/issue` döndürüyor | Yalnız metin değiştirme; ortak tip ve gerçek sayaçlar oluştur |
| Teslimat henüz doğrulanmamış | Salt okunur canlı sorguda dört `provider_accepted + unknown` iş, sıfır `mail_events` | “Teslim edildi” göstermeden önce webhook akışını doğrula; sağlayıcı kabulünü teslimat sayma |
| Mevcut seçim sırası kullanıcının isteğine ters | Başvurularda kişi seçiliyor, onay ekranında her kişiye komite atanıyor | Kabul ekranı komiteyle başlamalı ve adayları aynı ekranda seçtirmeli |
| Tek seçim teknik gruplara parçalanıyor | UI her üç kişi için ayrı batch oluşturuyor; API `selections.max(3)`; DB işlevi zaten 1–500 iş destekliyor | Tek mantıksal batch oluştur; üçlü sınırı işçinin gönderim adımında koru |

Canlı sorgular yalnız sayılar, durumlar, dosya varlığı ve MIME bilgisi döndürdü. Plan dosyasında e-posta adresleri, dekont içeriği, erişim tokenları ve imzalı bağlantılar tutulmaz. Yerleşik tarayıcı envanteri bu incelemede boş döndüğü için mevcut admin oturumuyla canlı sayfa doğrulaması yapılmadı.

## Kullanıcı gereksinimleri ve ekran kararı

### 1. Menü

Ana gezinme: **Başvurular · Toplu kabul · Dekontlar · E-postalar · Kesin kabul · Diğer işlemler**.

- `Dekontlar` mevcut `/panel/odemeler` sayfasına gider.
- `Toplu kabul` mevcut `/panel/onay` sayfasına gider.
- `E-postalar` mevcut `/panel/gonderimler` sayfasına gider.
- `Diğer işlemler` gerçek `/panel/diger-islemler` sayfasına gider. Kartlar, Ayarlar, İşlem geçmişi, Öğünler ve QR giriş bağlantıları açıklamalı kartlar olarak burada bulunur.
- Masaüstünde okunabilir menü; telefonda tüm bağlantılara erişim. Bir açılır menünün kırpılmasına bağlı erişim kalmaz. Mevcut koyu renk, yazı tipleri ve bileşen dili korunur.

### 2. Komite → adaylar → toplu gönderim

```text
1. Komite seç: Felsefe
2. Onay bekleyen adaylardan seçim yap: 12 kişi
3. Özeti kontrol et: Felsefe / 12 kişi / kabul maili önizlemesi
4. “12 kişiye kabul e-postası gönder”
5. Aynı ekranda ilerleme ve sonuç; E-postalar'da tek gönderim grubu
```

- Kabul ekranı doğrudan açılabilir; önce Başvurular sayfasında seçim yapma zorunluluğu kalkar.
- Aday listesi yalnız `pending` başvurulardan oluşur; isim/e-posta araması ve sayfalama vardır.
- Komite seçmeden aday seçimi ve gönderim açılmaz. Seçilen herkes aynı komiteye atanır; satır bazında komite seçimi kaldırılır.
- Arama ve sayfa değişimi seçilenleri kaybettirmez. Seçim sayısı görünür; “Bu sayfayı seç”, tek kişiyi kaldır ve “Seçimi temizle” eylemleri bulunur.
- Gönderimden önce komite değişirse aday seçimi temizlenir ve bunun yapıldığı bildirilir; yanlış komiteye sessizce toplu atama yapılmaz.
- Gönderim başlayınca komite ve seçim düzenlemesi kilitlenir. Sonuç çözümlenmeden eski deneme kimliği değiştirilmez.
- `Başvurular` başvuru ekleme/arama/durum takibi ekranı olarak kalır; eski kişi-önce seçimi ana akış olmaktan çıkar. Buradan `/panel/onay` bağlantısı bulunur.
- Tek gönderim en fazla 500 adaydır; aşımda açık bir seçim sınırı mesajı gösterilir.
- “Kabul” ilk kabul ve ödeme/dekont adımıdır. Toplu mail gönderimi ödeme onayı veya kesin kabul/QR oluşturma yerine geçmez.

### 3. Dekontlar

- Sayfa başlığı **Dekontlar ve ödemeler**; ilk alan **İnceleme bekleyen dekontlar**.
- Ad/soyad, e-posta, komite, yükleme tarihi ve dekont durumu görünür. Varsayılan filtre `under_review`; onaylananlar ve düzeltme istenenler ayrı filtrelerde bulunur.
- Bir kaydın **İncele** düğmesi aynı sayfada seçili kişi ve dosya önizlemesini açar. PDF panel içinde gösterilir; JPEG/PNG görsel olarak açılır. Desteklemeyen mobil PDF görüntüleyici için **Yeni sekmede aç** ve **İndir** alternatifi bulunur.
- İndirme adı `dekont.pdf`, `dekont.jpg` veya `dekont.png` olur; imzalı URL'nin Storage yolu kullanıcı girdisinden türetilmez.
- İmzalı bağlantı yalnız ilgili etkinliğin admini için verilir; süresi dolunca aynı yetki kontrolüyle yeniden alınır. URL kalıcı depolanmaz.
- Banka referansı, gelen tutar ve işlem tarihi doğrulanmadan ödeme onaylanmaz. “İnternetten yüklenmiş bir PDF” tek başına ödeme kanıtı kabul edilmez.
- Beklenen tutar eksikse bunu görünür biçimde göster, tutar/gerekçe/sürüm ile kaydet; kullanıcı incelemeyi yeniden seçmek zorunda kalmadan güncel sürümü al.
- Ödeme ayarları ikincil, açılır bir alana taşınır; liste ayarlar yüzünden aşağıda kaybolmaz. Dekont ve bankadan doğrulama güvenlik kuralları korunur.

### 4. E-posta durumları

Ana listede **Kişi · Komite · Durum · Ayrıntı** bulunur. Her satıra “Hata” ve “İşlem” başlığı altında anlamsız `—` basılmaz. Teknik teşhis Ayrıntı içinde; gerekli eylem yalnız o kayda uygun olduğunda görünür.

| Mevcut veri | Kullanıcıya gösterilecek durum | Açıklama / eylem |
|---|---|---|
| `queued` | Gönderim sırası bekliyor | Yeni mail henüz gönderilmedi |
| `sending` | Gönderiliyor | Süren iş için ikinci gönderim açılmaz |
| `provider_accepted` veya `sent`, `delivery_status=unknown` | Gönderildi · teslimat bildirimi bekleniyor | E-posta hizmeti kabul etti; alıcıya teslimat teyidi henüz yok |
| `delivered` | Teslim edildi | Geçerli, işle eşleşen webhook kanıtı var |
| `deferred` / `soft_bounced` | Teslimat gecikti | Sağlayıcının teslimat denemesi sürüyor; yeni bir mail otomatik üretilmez |
| `hard_bounced` / `invalid` | Adrese teslim edilemedi | Adres düzeltme eylemi, yalnız mevcut retry kurallarının izin verdiği durumda |
| `blocked` / `complained` / `unsubscribed` | Gönderim engellendi | Ayrıntıda anlamı gösterilir; engeli aşan otomatik tekrar yok |
| `quota_wait` | Günlük gönderim sınırına ulaşıldı | Kuyruk korunur; gönderim döngüsü durur |
| `uncertain` | Gönderim sonucu kontrol ediliyor | Körlemesine tekrar gönderilmez; uzlaşma sonucu beklenir |
| `failed` | Gönderilemedi | İnsanın anlayacağı gerekçe ve izinli yeniden deneme |
| `cancelled` | Gönderim iptal edildi | Tekrar gönderme eylemi yok |

`unknown` kuyrukta bekleyen kişide ayrıca gösterilmez. Öncelik: kalıcı teslimat sorunu/engelleme → teslim edildi → gecikme → gönderim sonucu. Tanınmayan enum ham teknik metin olarak basılmaz; “Durum kontrol ediliyor” gösterilir ve Ayrıntı kaydı korunur.

## Global Constraints

- Bu dosya bir uygulama planıdır; kullanıcı uygulama istemeden ürün değişikliği, canlı migration, deploy veya gerçek mail testi yapılmaz.
- Yalnız yerleşik tarayıcı kullanılır; Chrome kullanılmaz.
- Mevcut kayıtlar, onaylar, dekontlar, QR geçmişi ve eski gönderim grupları korunur; veri silme veya durumları “başarılı” olarak topluca düzeltme yoktur.
- Provider kabulü ve alıcı teslimatı ayrı gerçeklerdir. Sıfır webhook, dört mailin teslim edildiğinin veya edilmediğinin kanıtı değildir.
- Kullanıcının seçimi dışında komite/aday atanmaz. Aynı deneme kimliği ikinci batch veya ikinci mail üretmez.
- İşçinin mevcut en fazla üç mail işleme sınırı, rate limit ve belirsiz gönderimi tekrar üretmeme kuralları korunur. Cron'un mevcut yalnız uzlaşma davranışı mail gönderecek şekilde değiştirilmez.
- Private Storage, etkinlik sınırı, `requireStaff("admin")`, origin kontrolü, signed proof ve dosya doğrulaması gevşetilmez.
- Yeni payment migration ileri tarihli ayrı dosyadır; uygulanmış 003–009 migrationları düzenlenmez. Canlıya yalnız doğrulanmış ileri delta uygulanır; bütün tarihçeye kör `db push` yapılmaz.
- Genel görsel tasarım yenilemesi, personel/QR sistemi değişikliği, yeni mail sağlayıcı veya gereksiz bağımlılık ekleme kapsam dışıdır.
- Canlı mail testi gerekirse hedef ve gönderim sayısı ayrıca açıkça belirlenir. Bu plan hazırlanırken hiçbir yeni mail gönderilmedi.

## Review Focus

1. Farklı aday sayfalarına geçmek ve komiteyi değiştirmek yanlış komiteye sessiz atama üretmemeli — Görev 3.
2. 202 yanıtı, yanıt kaybı, çift tıklama ve sayfa yenileme aynı grubu tekrar oluşturmamalı — Görev 4.
3. `provider_accepted + unknown`, geç gelen bounce ve teslimat bildirimi olmayan eski gruplar yanlış başarı rozetine dönüşmemeli — Görev 2 ve 5.
4. Dekontu onaylamadan önce tutar düzeltmek, eski kayıt sürümü, imzalı URL süresinin dolması ve mobil PDF açılmaması doğru şekilde ele alınmalı — Görev 1.
5. Kuyruktaki beşten fazla aday, kota dolması, belirsiz iş ve pencerenin kapanması ilerleme/durum kaybına veya arka planda izinsiz tekrar maile yol açmamalı — Görev 4.

## Task 1 — Menü ve dekont incelemesi

**Dosyalar:**
- Modify: `app/(operations)/panel/layout.tsx`, `app/(operations)/operations.css`, `lib/content.ts`.
- Create: `app/(operations)/panel/diger-islemler/page.tsx`.
- Modify: `components/panel/PaymentsClient.tsx`, `app/api/panel/payments/route.ts`.
- Create: `supabase/migrations/202610040010_payment_review_metadata.sql` — bu ad doluysa sonraki kullanılmayan ileri numara.
- Test: `tests/unit/participant-payment-settings.test.mjs`, `tests/integration/participant-payment-meals.test.mjs`; Create: `tests/unit/admin-payments-client.test.mjs`.

**Interfaces:**
- Liste: GET `/api/panel/payments?page=0&status=under_review` yanıtına `application.version` ve `application.committee_name` eklenir. Durum veritabanında sayfalamadan önce filtrelenir. Dosya MIME bilgisi önizleme yanıtından alınır.
- Önizleme: GET `/api/panel/payments?receipt=<uuid>` → `{url, mime, fileName, expiresAt}`; `&download=1` uzantılı indirme için imza üretir. `receipt` ve `download` doğrulanır.
- Mevcut `list_payment_reviews(uuid,integer,integer)` korunur. Yeni `list_payment_reviews_by_status(uuid,integer,integer,text)` aynı TABLE dönüş sütunlarını ve staff kontrolünü kullanır; `application` JSON'una `version` ve nullable `committee_name` ekler. Komitesiz kayıtlar listeden düşmez.

- [ ] Başlangıç `git status` ve canlı dekont sayısını kaydet; kayıtları kimlik bilgileri içermeyen bir yerel test fixture'ıyla eşleştir.
- [ ] Önce test ekle: `under_review` JPEG/PDF aynı admin listesinde görünür; başvuru sürümü sayıdır; başka etkinlik/staff/anon imzalı URL alamaz; süre dolan bağlantı yenilenir; boş liste ve API hatası farklı görünür.
- [ ] Testi RED doğrula: `node --test tests/unit/participant-payment-settings.test.mjs tests/unit/admin-payments-client.test.mjs`.
- [ ] Menü açılır grubunu gerçek link/hub sayfasıyla değiştir; Dekontlar'ı ana bağlantı yap. Sayfanın üstüne filtreli inceleme listesini ve seçili dosya panelini yerleştir.
- [ ] API'de imzalanacak dosyanın kendi etkinliğindeki, tamamlanmış inceleme kaydına ait olduğunu kontrol et. Önizleme imzasına `download` koyma; indirmede MIME'dan `.pdf/.jpg/.png` türet.
- [ ] İleri migration ile başvuru sürümünü listede döndür. Tutar PATCH'inden sonra güncel kaydı yeniden al, seçili incelemeyi koru; boş `applicationVersion` gönderme.
- [ ] GREEN ve DB testi: `node --test tests/unit/participant-payment-settings.test.mjs tests/unit/admin-payments-client.test.mjs tests/integration/participant-payment-meals.test.mjs`.
- [ ] Yerleşik tarayıcıda 390 px ve 1440 px: ana menüden dekonta bir tık; PDF önizleme/indirme; telefonda dosyayı yeni sekmede açma; yanlışlıkla ödeme onayı yok.
- [ ] Sadece ilgili kaynak/test/migration dosyalarını ayrı commit'e al: `fix: expose receipt review and preserve payment versions`.

## Task 2 — Ortak gönderim sonucu ve anlaşılır durumlar

**Dosyalar:**
- Modify: `lib/mail/status.ts`, `app/api/panel/batches/route.ts`, `app/api/panel/dispatch-mail/route.ts`, `components/panel/ApprovalClient.tsx`, `components/panel/SendingClient.tsx`, `lib/content.ts`.
- Create: `lib/mail/presentation.ts`, `tests/unit/mail-presentation.test.mjs`.
- Modify: `tests/unit/panel-mail-routes.test.mjs`.

**Interfaces:**

```ts
type MailDispatchOutcome = {
  batchId: string;
  dispatchReady: boolean;
  canContinue: boolean;
  acceptedTotal: number;
  deliveredTotal: number;
  pending: number;
  failedTotal: number;
  uncertainTotal: number;
  issue: string | null;
  code?: string;
  error?: string;
};
type MailPresentation = {
  label: string;
  tone: "good" | "wait" | "bad" | "neutral";
  detail: string | null;
};
// presentation.ts: presentMailJob({status, delivery_status, last_error})
// status.ts: summarizeMailJobs(jobs) mevcut gerçek sayaçları üretir.
```

- [ ] RED testleri: provider kabulü/unknown teslim edildi sayılmaz; queued satırında teslimat bilinmiyor yazmaz; geç bounce başarıyı baskılar; ham hata yalnız ayrıntıda; bilinmeyen enum tarafsızdır.
- [ ] `node --test tests/unit/mail-presentation.test.mjs tests/unit/panel-mail-routes.test.mjs` ile başarısızlığı gör.
- [ ] İki API'nin yanıtını `MailDispatchOutcome` ile hizala; `batchId` ve `dispatchReady` iki yerde de bulunur. Yanıt gövdesini sayısal alanlar için doğrula; eksik alanı `undefined`, `NaN` veya sıfır başarı olarak kabul etme.
- [ ] `canContinue` sunucuda hesaplanır: gönderim servisi hazır, işçi engellenmemiş, hemen işlenebilir queued kayıt var ve grubun sending/quota_wait/uncertain/failed kaydı yok. `pending` tek başına devam koşulu değildir; bekleyen iş ve kota beklemesi aynı sayaca girer. E-postalar GET yanıtı da grup bazında aynı devam bilgisini verir.
- [ ] Eski `providerAccepted/failed/unresolved/firstError` okumalarını kaldır; API alanlarını ortak sunum fonksiyonundan göster.
- [ ] Gönderimler tablosunu tek anlaşılır durum ve ayrıntı yapısına geçir. Grubun göndermeye kalan/teslim edilen/gönderilemeyen sayıları aynı kayıtlardan türetilir; teslim edilenler gönderilenlerin alt kümesidir, toplam kişi sayısına ikinci kez eklenmez.
- [ ] Başvuru yeniden açma, kabul daveti tekrar deneme ve `participant_auth` aynı işlemmiş gibi etiketlenmez. Retry yalnız mevcut server/RPC izin veriyorsa açılır; belirsiz/kabul edilmiş mail için kör retry yoktur.
- [ ] GREEN ve ayrı commit: `fix: align mail results and explain delivery states`.

## Task 3 — Komiteyi önce seçen kabul ekranı

**Dosyalar:**
- Modify: `components/panel/ApprovalClient.tsx`, `components/panel/ApplicationsClient.tsx`, `lib/content.ts`, `app/(operations)/operations.css`.
- Create: `components/panel/ApprovalCandidates.tsx`, `lib/panel/approval-selection.ts`, `tests/unit/approval-flow.test.mjs`.
- Mevcut GET `app/api/panel/applications/route.ts` ve GET `/api/panel/committees` tüketilir; gereksiz ikinci aday endpoint'i açılmaz.

**Interfaces:**

```ts
type ApprovalPerson = {id: string; firstName: string; lastName: string; email: string; version: number};
type ApprovalDraft = {committeeId: string; people: ApprovalPerson[]};
// approval-selection.ts: readApprovalDraft(), persistApprovalDraft(draft)
// Yeni sessionStorage anahtarı: aero-approval-draft-v2.
// Eski aero-selected-applications anahtarı varsa kişiler otomatik gönderilmez;
// kullanıcıya eski seçimi inceleme/temizleme seçeneği gösterilir.
```

- [ ] RED: komitesiz gönderilemez; yalnız pending seçilir; iki sayfadaki seçim birikir; arama seçimi kaybetmez; komite değişimi seçimi temizler; eski seçim yeni komiteye sessiz atanmaz; 500 sınırı uygulanır.
- [ ] `node --test tests/unit/approval-flow.test.mjs` çalıştır.
- [ ] Komite seçimini ekranın ilk adımı yap. Seçilen komite sonrası aday araması/checkbox listesi, seçilen kişi özeti ve önizlemeyi göster.
- [ ] Başvurular ekranındaki eski “kişi seç → komiteye devam et” zorunluluğunu kaldır; başvuru ekleme ve durum filtrelerini koru, toplu kabul ekranına açık bağlantı bırak.
- [ ] Boş aktif komite, komitelerin yüklenememesi, boş aday listesi ve aday API hatası ayrı mesajlar verir. Komite/aday kayıtları yüklenmeden gönderim açılmaz.
- [ ] Mail önizlemesinde seçili komite ve örnek alıcı göster; aktivasyon tokenı/token içeren gerçek URL üretme.
- [ ] GREEN; yalnız yerel fixture ile 12 adayın Felsefe seçimine gittiğini ve istemci payload'ında herkesin aynı `committeeId` taşıdığını doğrula.
- [ ] Ayrı commit: `feat: select committee before acceptance candidates`.

## Task 4 — Tek toplu seçim, tek grup, güvenli gönderim ilerlemesi

**Dosyalar:**
- Modify: `app/api/panel/batches/route.ts`, `app/api/panel/dispatch-mail/route.ts`, `components/panel/ApprovalClient.tsx`, `components/panel/SendingClient.tsx`.
- Create: `lib/panel/approval-dispatch.ts`, `tests/unit/approval-dispatch.test.mjs`.
- Modify: `tests/unit/panel-mail-routes.test.mjs`, `tests/integration/participant-payment-meals.test.mjs`.

**Interfaces:**
- POST `/api/panel/batches`: mevcut `{batchId, selections:[{applicationId,version,committeeId}]}`; yeni grup için 1–500 benzersiz pending aday ve tek aktif komite.
- Tek kullanıcı işlemi tek `batchId` ve tüm seçim hash'i taşır. Aynı hash/id replay mevcut batch'in durumunu döndürür; replay kendi başına işçiyi çağırmaz. Eski batch'lerin replay/okuma desteği korunur; yeni oluşturma tek komite kuralıyla doğrulanır.
- Queue RPC zaten 1–500 destekler; önce mevcut canlı tanımı/testi doğrula. Bu değişiklik için yeni parent-operation tablosu ekleme.
- Batch oluşturma bir kez; işçi `limit:3` ile başlar. Kalan işler için POST `/api/panel/dispatch-mail` aynı batch'i işler ve Görev 2'nin outcome tipini döndürür.

- [ ] RED: 1/3/4/12/500 kişide bir batch; tekrar tıklamada aynı mail job sayısı; eski sürümde/yanlış etkinlikte yeni iş yok; karışık komite yeni oluşturma reddedilir; eski grubun replay'i bozulmaz.
- [ ] `node --test tests/unit/panel-mail-routes.test.mjs tests/unit/approval-dispatch.test.mjs tests/integration/participant-payment-meals.test.mjs` çalıştır.
- [ ] API'nin seçim sınırını yükselt; yeni grup için benzersiz adayları ve tek komite kuralını API'de doğrula. Mevcut service-role RPC'nin transaction içindeki pending/sürüm/etkinlik/aktif komite kontrollerini koru; komite aynı etkinlikte aktif değilse veya aday stale ise yeni grup atomik olarak reddedilir. Adayın önceden o komiteye atanmış olması gerekmez; atama bu işlemde yapılır.
- [ ] Worker'a `selections.length` yerine en fazla 3 gönder. Ekranın başlattığı, aynı batch üzerinde çalışan kontrollü devam döngüsü kur; her yanıttan sonra gerçek sayıları göster.
- [ ] Devam koşulu yalnız normal queued işlerin varlığıdır. Worker kota/erişim/sağlayıcı hatası, `uncertain`, HTTP/JSON yanıt kaybı veya sonuçların ilerlememesi durumunda döngüyü durdur. En fazla `ceil(toplam/3)+2` adım; sonsuz polling/gönderim döngüsü yoktur.
- [ ] 202 “kayıt/işlem devam ediyor” durumunu kesin tamamlanma sayma. Kayıt oluşmuş fakat yanıt kaybolmuşsa aynı batch/hash ile uzlaş; aday başvuru sürümü değişti diye yeni batch açma.
- [ ] Mevcut `existingBatch()` replay yolunun `dispatchBatch()` çağrısını kaldır; durum okuma ile gönderim eylemini ayır. Yanıt kaybında salt okunur replay kullan; devam göndermesi yalnız ayrı dispatch endpoint'i üzerinden açık kullanıcı işlemiyle başlatılmış döngüde yapılır.
- [ ] Sayfa kapanırsa sunucudaki batch/işler korunur; istemci döngüsü durur. E-postalar sayfasında **Kalan gönderimleri sürdür** yalnız izinli kuyruk işleri için görünür. Otomatik cron gönderimi eklenmez.
- [ ] E-postalar'da 12 kişinin üçlü fiziksel işlem adımları ayrı gönderim grupları olarak gösterilmez; tek batch altında yer alır.
- [ ] GREEN: 12 kişilik testte 1 batch/12 benzersiz acceptance işi; üçlü worker adımları tamamlandığında pending=0; replay mail sayısını artırmaz; quota/uncertain testinde ikinci otomatik deneme olmaz.
- [ ] Ayrı commit: `feat: keep bulk acceptance in one resumable batch`.

## Task 5 — Teslimat bildirimlerinin eksikliğini doğrula

**Dosyalar:**
- Inspect/only if needed modify: `app/api/webhooks/brevo/route.ts`, `lib/mail/brevo-events.ts`, `tests/unit/brevo-webhook.test.mjs`.
- Inspect: `record_mail_event` RPC, mevcut işçi tag/message-id eşleştirmesi ve Brevo transactional webhook ayarı.
- Evidence: `docs/reviews/2026-10-04-admin-paneli-komite-dekont-gonderim.md`.

- [ ] Mevcut webhook URL'si, etkinlik abonelikleri ve auth başlığını sağlayıcı tarafında salt okunur doğrula; gizli değerleri rapora koyma.
- [ ] Sıfır `mail_events` için “sağlayıcı ayarı eksik”, “auth reddediliyor”, “payload/tag/message-id eşleşmiyor” veya “henüz olay gelmedi” olasılıklarını kanıttan ayır. Henüz doğrulanmayan sebebi kesin sorun diye yazma.
- [ ] Yerel fixture testleri: geçerli delivered/bounce, yanlış auth, yinelenen olay, eski olay zamanı, başka alıcı/job ve yanlış tag durumları. Provider kabulünü bu testlerle teslim edildiye dönüştürme.
- [ ] Kod sorunu doğrulanırsa önce RED testi, sonra ilgili handler düzeltmesi; `node --test tests/unit/brevo-webhook.test.mjs tests/unit/mail-presentation.test.mjs`.
- [ ] Canlı webhook yapılandırması eksikse uygulama onayıyla kapsamı belirlenen ayarı yap; ayrıca gerçek test mailinin alıcısı/adedi açıkça yetkilendirilmeden gönderme. Yapılandırma ile gerçek mail testini ayrı kaydet.
- [ ] Eski dört gönderimin unknown bilgisini tahminle veya SQL toplu güncellemeyle değiştirme. Doğrulanmış olay varsa mevcut idempotent uzlaşma üzerinden uygula.
- [ ] Gerçek bildirim henüz doğrulanamıyorsa UI “teslimat bildirimi bekleniyor” halinde doğru çalışır; raporda canlı teslimat doğrulaması açık sınır olarak kalır.

## Task 6 — Son doğrulama ve uygulama sonrası yayın

**Dosyalar:** İlgili kaynak ve testler; `docs/reviews/2026-10-04-admin-paneli-komite-dekont-gonderim.md`.

- [ ] `npm.cmd test`, `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npm.cmd run build`, `git diff --check` çalıştır; değişikliklerin gerçek API/DB sözleşmesini sınadığını kontrol et.
- [ ] 147 test tabanına yeni testler eklenir; test sayısı için mevcut testleri silme. Son sayıyı ve komut sonuçlarını rapora yaz.
- [ ] Yerel/izole DB üzerinde migration 010 dahil tam tarihçe ve payment review metadata testi; aynı banka işlemi, sürüm çakışması, etkinlik ayrımı ve ödeme/QR regresyonları geçer.
- [ ] Yerleşik tarayıcı: masaüstü/mobil ana menü; gerçek yardımcı işlemler sayfası; pending dekont → PDF/görsel önizleme → indirme; komite → adaylar → özet → tek toplu gönderim; sayfa yenileme ve yeniden devam; açık/kapalı delivery olayları.
- [ ] Menü/metin ekran testleri mail göndermeden yapılır. Mail gönderimi fixture/stub ile sınanır; gerçek kontrollü test yalnız açıkça yetkilendirilmiş tek hedef/sayıyla yapılır.
- [ ] Kullanıcı uygulama talep ettiğinde canlı yayın adımını kapsam içindeki mevcut yetkiyle değerlendir. Yeni onay gerekiyorsa yalnız somut migration/deploy/gerçek mail adımı için iste; aynı yetkiyi tekrar tekrar isteme.
- [ ] Yayın yapılacaksa önce ilgili yeni payment metadata migration, sonra web deployment; mevcut worker'ın üçlü işleme sınırı korunur. Üretim sahibi kimliğiyle release commit; Git global ayarlarına dokunma.
- [ ] Geri dönüşte önce önceki web deployment'a dön; JSON'a eklenen metadata eski web'i bozmaz. Eski migrationı geri düzenleme veya dosya/job silme yoktur.
- [ ] Kullanıcının mevcut dekontunun listede göründüğünü, dosya sayısının azalmadığını ve menü/metin değişikliklerinin www alias'a yansıdığını doğrula. İlk/final `git status`, deployment ve kalan canlı test sınırlarını raporla.

## Tamamlanma kabul listesi

- [ ] “Diğer işlemler” tıklanınca gerçek sayfa açılıyor; diğer araçların hepsi buradan erişilebilir.
- [ ] Dekontlar ana menüde; incelemeye hazır mevcut dekont tekrar yüklemeden listeleniyor.
- [ ] PDF ve JPEG ayrı ayrı açılıp uzantılı indirilebiliyor; panelden istemeden çıkılmıyor.
- [ ] Beklenen tutar tanımlama boş başvuru sürümü nedeniyle başarısız olmuyor; banka doğrulaması atlanmıyor.
- [ ] Kabul ekranına doğrudan girilip komite seçildikten sonra aday seçilebiliyor.
- [ ] 12 adaylık kabul tek batch altında, her aday seçili komitede, her alıcı için tek acceptance işiyle tamamlanıyor.
- [ ] Çift tıklama/reload/202/kota/uncertain durumları duplicate veya sahte tamamlanma üretmiyor.
- [ ] “Brevo'da bekliyor”, bağlamsız “Henüz bilinmiyor”, ham “Hata/İşlem” sütunları ana ekrandan kalkıyor; teslimat gerçeği saklanmıyor.
- [ ] Sayaçlar API ile aynı alanları kullanıyor; `NaN`, `undefined` ve yanlış sıfır sonucu görülmüyor.
- [ ] Geç gelen bounce/complaint sonucu e-postayı yanlışlıkla başarılı göstermiyor.
- [ ] Yeni testler, lint, TypeScript, build ve mobil/masaüstü doğrulamaları geçiyor; canlı mail testi yapılıp yapılmadığı açıkça belirtiliyor.

## Planın kendi kontrolü

- Kapsam üç kullanıcı sorununu kapsıyor: menü/dekont erişimi, e-posta dilinin ve sayaçların doğruluğu, komite önce toplu gönderim.
- Kararlar somut; uygulamaya başlamayı engelleyen kullanıcı tercihi boşluğu yok. Tek gönderimde tek komite varsayımı kullanıcı tarifinden alınmıştır.
- Veri genişletmesi yalnız payment review metadata için ileri migrationdır; yeni gönderim tabloları veya farklı mail servisi gerektirmez.
- Teknik batch büyüklüğü ile işçi adımı ayrı tutuldu; tek grup 500 kişiye kadar, gönderim adımı en fazla üç kişi.
- Yan etkili işler uygulama aşamasına bırakıldı; bu planı yazmak deployment/gerçek mail onayı sayılmaz.

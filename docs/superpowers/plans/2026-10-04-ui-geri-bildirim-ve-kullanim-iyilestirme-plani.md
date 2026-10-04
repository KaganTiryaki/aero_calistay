# AERO işlem sonuçları ve arayüz iyileştirme planı

> Durum (2026-10-04): Yerel ürün uygulaması tamamlandı; 197/197 test, lint, TypeScript ve üretim derlemesi başarılı. Gerçek cihaz/ekran okuyucu, %200 yakınlaştırma ve tam canlı akış açık. Ayrıntılar: [doğrulama raporu](../../reviews/2026-10-04-ui-iyilestirme-dogrulama.md).

**Goal:** Başvuru, dekont ve diğer işlemlerin sonucunu açıkça göstermek; isimlerin kaybolmasını hata gibi algılatan davranışı gidermek; gezinme ve mobil kullanım sorunlarını düzeltmek.

**Architecture:** Mevcut Next.js sayfaları korunur. Ortak, erişilebilir bir sonuç kartı eklenir. Her istemcide işlem sonucu ile veri yükleme durumu ayrılır; ilk yükleme ve arka plan yenilemesi farklı gösterilir. Sunucu iş kuralları ve veri modeli korunur.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, mevcut operations.css, Node test runner ve mevcut istemci bileşen test yardımcıları. Tarayıcı doğrulaması yalnız Codex yerleşik tarayıcıyla.

**Spec:** [İnceleme ve kullanıcı deneyimi şartları](../../reviews/2026-10-04-ui-akis-inceleme.md). Kaynak başlangıcı `13fbaa6`, dal `codex/immediate-mail-review`.

**Global Constraints:** Uygulama aktif worktree'de yapılır; mevcut değişiklikler ve `supabase/.temp/` korunur. Yeni migration beklenmez. Tek düğmeyle dekont kabulü korunur; bankacılık alanları geri getirilmez. QR yalnız kesin kabul sonrası açılır. POST idempotency, ödeme sürüm kontrolü, davet devam ettirme, dekont finalize tekrar denemesi ve toplu kabul belirsiz-sonuç korumaları korunur. UI çalışması otomatik gerçek mail, toplu gönderim, canlı silme, erişim değişikliği veya üretim yayını başlatmaz. Canlı test ve yayın öncesi önceki yetkilendirmelerin kapsamı kontrol edilir; gerekli yeni kararlar somut sonuç hazırken alınır.

**Review Focus:** Başarıdan sonra GET hatasının sonucu bozması; son kayıtta yanlış hata/boş durum; eski isteklerin yeni filtreyi ezmesi; kişi/komite bilgilerinin kaybı; kısmi e-postanın tam teslimat gibi sunulması; mobil görünürlük ve odak.

## Tasarım kararları

1. Kritik işlemler için otomatik kapanmayan sonuç kartı. Modal zorunlu değil; dekont önizlemesi başarı kartına dönüşür, kullanıcı aynı yerde sonucu görür. Başvuru sonucunda kart formun yanında/yerinde görünür.
2. `ActionFeedback` verisi: `kind: success | error | info | uncertain`, `title`, `description`, isteğe bağlı kişi özeti ve bağlantılar. Başarı `role="status"`, hata `role="alert"`; renk yanında başlık/ikon bulunur. Uzun listede odak yalnız kullanıcının başlattığı tamamlanmış kritik işlemde taşınır; polling odağı almaz.
3. Veri yükleme: `initialLoading`, `refreshing`, `loadError`, `hasLoaded` ve ayrı `actionFeedback`. Başarılı POST önce sonuç kartını kurar; ardından yenileme hatası bağımsız “İşlem tamamlandı; liste yenilenemedi” uyarısıdır. POST sonucu belirsizse “Sonuç doğrulanamadı” ve durum kontrolü sunulur.
4. Aynı filtrede yenileme sırasında son başarılı liste görünür kalır. Filtre değişirken eski satırlar açık “Liste güncelleniyor” durumuyla salt okunur tutulur veya ilk kez yüklenen filtre için skeleton gösterilir; eski satır yeni filtre sonucu gibi sunulmaz.
5. İşlem adı bağlama uygun: “Kaydediliyor…”, “Dekont kabul ediliyor…”, “Kuyruğa alınıyor…”. Satır eylemleri kişi bazında kilitlenir. İstemci kilidi sunucu garantisi sayılmaz.

Ortak veri sözleşmesi (`lib/operations/action-feedback.ts`):

```ts
export type ActionFeedbackState = {
  kind: "success" | "error" | "info" | "uncertain";
  title: string;
  description: string;
  subject?: { name: string; email?: string };
  links?: { label: string; href: string }[];
};

export function refreshFailureAfterAction(
  feedback: ActionFeedbackState | null,
): string {
  return feedback?.kind === "success"
    ? "İşlem tamamlandı; liste yenilenemedi. Listeyi tekrar yenileyin."
    : "Liste yüklenemedi. Tekrar deneyin.";
}
```

Kart props'u `feedback: ActionFeedbackState`, `id: string`, isteğe bağlı `onDismiss: () => void` olsun. Mutasyon tamamlandıktan sonraki yenileme hatası ayrı `loadError` alanına yazılsın; bu yardımcı sonuç kartını değiştirmesin.

## Görev 1 — Ortak sonuç kartı ve yükleme durumları (P1)

**Dosyalar:** Create `components/operations/ActionFeedback.tsx`, `lib/operations/action-feedback.ts`, `tests/unit/action-feedback.test.mjs`; Modify `app/(operations)/operations.css`.

- [x] Sonuç veri tipini ve başarı/belirsizlik/hata durumlarını ayıran yardımcıyı ekle. Kişi bilgisi işlem başlarken yakalanır; liste yenilemesinden türetilmez. Token, şifre, dekont imzalı URL'si veya ham servis hatası sonuç verisine konmaz.
- [x] Başlık, açıklama, kişi özeti, kapatma düğmesi ve en fazla iki sonraki adım içeren kartı oluştur. `id` ve odaklanabilir başlıkla çağıran bileşenin odak yönetimini destekle. Canlı bölgeyi tek yerde tut; tekrarlı duyurudan kaçın.
- [x] Başarı/hata/bilgi görünümleri, dar ekranda taşmayan e-posta, 44 px hedeflenen işlem alanları, focus-visible ve reduced-motion uyumlu stilleri ekle. Mevcut koyu renk tasarımını koru.
- [x] Saf yardımcı testinde başarılı mutation + başarısız refresh'in başarıyı kaybetmediğini, belirsiz sonucun başarıya dönüşmediğini doğrula. Gerçek DOM odak/duyuru davranışını Görev 7'de kontrol et; render yardımcıları bu kanıtın yerine geçmez.
- [x] Çalıştır: `node --test tests/unit/action-feedback.test.mjs`.

Saf yardımcı için çalıştırılabilir test başlangıcı:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../../lib/operations/action-feedback.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const exports = {};
vm.runInNewContext(`(function(exports){${source}})`)(exports);
test('refresh failure preserves a successful action', () => {
  const result = { kind: 'success', title: 'Başvuru başarıyla eklendi', description: 'Onay bekliyor' };
  const notice = exports.refreshFailureAfterAction(result);
  assert.equal(result.kind, 'success');
  assert.match(notice, /^İşlem tamamlandı;/);
});
test('an uncertain action is never described as complete', () => {
  const notice = exports.refreshFailureAfterAction({ kind: 'uncertain' });
  assert.doesNotMatch(notice, /İşlem tamamlandı/);
});
```

## Görev 2 — Başvuru ve dekont işlemlerinin sonuç ekranları (P1)

**Dosyalar:** Modify `components/panel/ApplicationsClient.tsx`, `components/panel/PaymentsClient.tsx`, `lib/content.ts`; Create `tests/unit/panel-action-feedback.test.mjs`; Extend `tests/unit/participant-client.test.mjs` yalnız mevcut kapsamla çakışmayan kontroller için.

- [x] Başvuru POST'u doğrulandıktan sonra isim/e-postalı “Başvuru başarıyla eklendi” kartını göster. Form temizliği kartı silmesin. “Yeni başvuru ekle” kontrollü olarak kartı kapatsın. Başarısız POST'ta form değerlerini koru.
- [x] Başvuru yüklemesini açık parametrelerle (`page`, `q`, `status`) çalıştır; yaratma sonrası yeni filtreye tek tutarlı yenileme yap. Request generation veya AbortController ile eski arama/filtre yanıtlarını yok say. `load()` sonuç kartını temizlemesin.
- [x] Dekont POST'u öncesi kişi özeti ve mevcut idempotency anahtarını koru. Başarıdan sonra önizleme aynı yerde isimli sonuç kartına dönüşsün. “Bekleyenler listesinden çıkarıldı” açıklaması ve kesin kabuller bağlantısı bulunsun. Kabul butonu işlem boyunca “Dekont kabul ediliyor…” olsun.
- [x] Dekont boş durumunu `loadError` üzerinden belirle; `message` varlığına bağlama. Son dekontta başarı kartı + normal “İnceleme bekleyen dekont yok” durumu göster.
- [x] Ödeme ayarlarını listeden bağımsız yükle; dekont yenilemesi kaydedilmemiş IBAN/tutar/tarih alanlarını ezmesin. Ayar hata/başarısı yalnız ilgili bölümü etkilesin.
- [x] Testler: başarılı ekleme + GET hatası; form değerlerinin POST hatasında korunması; son dekont; yavaş eski filtre yanıtı; başarılı kabul sonrası aynı POST'un yeniden gönderilmemesi; ayar GET hatasında dekontların gösterilmesi; ayar taslağının liste yenilemesinde korunması.
- [x] Çalıştır: `node --test tests/unit/panel-action-feedback.test.mjs tests/unit/participant-client.test.mjs tests/integration/participant-payment-meals.test.mjs`.

POST başarısı sonrası GET hatasını kapsayan bileşen regresyonu (`panel-action-feedback.test.mjs`):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { component } from '../helpers/client-component.mjs';
test('saved applicant remains visible in the result when refresh fails', async () => {
  let writes = 0;
  const c = component('../../components/panel/ApplicationsClient.tsx', 'ApplicationsClient', {
    moduleStubs: { '@/components/operations/ActionFeedback': { ActionFeedback: 'feedback' } },
    fetch: async (_url, init) => {
      if (init?.method === 'POST') {
        writes++;
        return new Response(JSON.stringify({ id: 'new-app' }), { status: 200 });
      }
      return new Response('{}', { status: 503 });
    },
  });
  for (const [index, value] of [[0, 'Test'], [1, 'Aday'], [2, 'test@example.com']]) {
    c.nodes(c.render(), 'input')[index].props.onChange({ target: { value } });
  }
  await c.submit();
  const result = c.nodes(c.render(), 'feedback')[0].props.feedback;
  assert.equal(result.kind, 'success');
  assert.equal(result.subject.name, 'Test Aday');
  assert.equal(result.subject.email, 'test@example.com');
  assert.equal(writes, 1);
});
```

Bu test kartın DOM erişilebilirliğini kanıtlamaz; yalnız sonuç state'inin korunmasını sınar. Diğer regresyonlarda aynı yardımcıyla gecikmeli GET promise'larını ters sırada çözerek son filtre verisinin kaldığını kontrol et.

## Görev 3 — Diğer panel işlemlerinde tutarlı geri bildirim (P2)

**Dosyalar:** Modify `components/panel/ApprovalClient.tsx`, `components/panel/SendingClient.tsx`, `components/panel/ApprovedClient.tsx`, `components/panel/useApproved.ts`, `components/panel/SettingsClient.tsx`, `components/panel/MealsClient.tsx`; Create `tests/unit/panel-secondary-feedback.test.mjs`; Extend `tests/unit/approval-client-recovery.test.mjs`.

- [x] Toplu kabul işleminde komite ve aday sayısını sonuç özeti için yakala. Taslak temizlense bile sonuç kartı kalsın. Tamamlanan, kısmi ve belirsiz sonuçlar ayrı gösterilsin; mevcut attempt/batch kurtarma akışı korunarak “E-postalarda durumu izle” sunulsun.
- [x] Komite değişimindeki “önceki seçim temizlendi” bilgisi GET tarafından silinmesin. Komiteler yüklenirken “Aktif komite yok” gösterilmesin.
- [x] E-posta sayfasında ilk yükleme, polling hatası ve gerçek boş durum ayrılsın. Dispatch/reopen sonrası hemen salt okunur refresh yap; refresh yeni gönderim tetiklemesin. Yeniden gönder etiketlerini gerçek davranışa göre “Daveti yeniden kuyruğa al” / “Hesap bağlantısını yeniden kuyruğa al” yap.
- [x] Kesin kabulde kişi bazında pending/catch/finally ekle. İptal/QR yenilemenin isimli sonucu görünsün; mevcut sonuçları olan onay uyarıları korunur. `useApproved` tüketicilerinde ilk yükleme/yenileme ayrımını uygula, eski isteklerin geç sonucu ezmesini engelle.
- [x] Ayarlar alt bölümlerinin yükleme/hata durumlarını ayır. Yüklenmemiş ayarı değiştirilemez tut; kayıt sırasında yalnız ilgili eylemi kilitle, ağ hatasını görünür göster. Personel daveti ve erişim değişimi sonuçları birbirine karışmasın.
- [x] Öğün eklemede tarih doğrulamasını yakalanan işlem içine al; başarılı eklemede formu temizle, isimli kart göster. Başarısız eklemede değerleri koru. Sonuç kartı liste GET'i tarafından değiştirilmesin.
- [x] Testler: kısmi toplu gönderim tam başarı sayılmaz; seçim temizlense sonuç özeti kalır; dispatch sonrası GET ve ikinci POST yok; reopen ağ hatası görünürdür; ilk yüklemede sahte boş durum yok; iptal/QR işlemi beklerken tekrar tıklama kilitlidir; geçersiz tarih yakalanır.
- [x] Çalıştır: `node --test tests/unit/panel-secondary-feedback.test.mjs tests/unit/approval-client-recovery.test.mjs tests/unit/approval-dispatch.test.mjs tests/unit/panel-mail-routes.test.mjs`.

## Görev 4 — Katılımcı yükleme, giriş ve aktivasyon deneyimi (P2)

**Dosyalar:** Modify `components/participant/ParticipantClient.tsx`, `components/participant/AuthClient.tsx`, `lib/content.ts`, `tests/unit/participant-client.test.mjs`.

- [x] Dekont finalize doğrulandığında formun yerinde “Dekont incelemeye gönderildi” kartı oluştur; komite incelemesi/QR sonraki adımını anlat. `pendingFinalize` aynı dosyayla tekrar deneme davranışı korunsun.
- [x] `/me` GET hatasında sonsuz yükleme yerine açık hata ve yeniden dene göster. Refresh beklerken mevcut kişi ve QR durumu görünür kalsın. Çıkış hatası yakalansın, başarısız çıkışta girişe yönlendirilmesin.
- [x] Girişte “Giriş yap” ana eylem; “Şifremi unuttum” ve “Davet bağlantım yok / süresi doldu” açıklamalı ikincil yollar olsun. Kurtarma aynı API/purpose değerlerini kullanır. Mail başarı metni API'nin kanıtını aşmasın; gerçek teslimat iddiası üretmesin.
- [x] Şifreyi göster/gizle ve ana sayfaya dönüş ekle; mevcut şifre politikası değişmesin. Hata alert'i, başarılı link isteği ve işleniyor durumu ayrışsın.
- [x] Tokensız aktivasyonda önce mevcut doğrulanmış şifre oturumunu kontrol et. Böyle bir oturum yoksa etkinleştir düğmesi yerine “Geçerli bir aktivasyon bağlantısı gerekli” ve davet/giriş yollarını göster. Ağ hatasını geçersiz bağlantıdan ayır; davet token'ını otomatik tüketme.
- [x] Testler: tokensız/no-session, geçerli resumable session, resume GET ağ hatası, finalize başarılı + `/me` hatası, başarısız logout, kurtarma isteğinde önceki hatanın temizlenmesi. Mevcut invite/session conflict testleri geçmeli.
- [x] Çalıştır: `node --test tests/unit/participant-client.test.mjs tests/unit/participant-auth-link.test.mjs tests/unit/participant-input.test.mjs tests/unit/participant-staff.test.mjs`.

## Görev 5 — Gezinme ve yanlış adreslerden kurtarma (P2)

**Dosyalar:** Create `components/operations/PanelNav.tsx`, `app/(operations)/giris/katilimci/page.tsx`, `app/not-found.tsx`; Modify `app/(operations)/panel/layout.tsx`, `components/nav/StickyNav.tsx`, `lib/content.ts`, `app/(operations)/operations.css`.

- [x] PanelNav içinde pathname'e göre tek etkin bağlantı ve `aria-current="page"` ekle. Mobilde yatay gezinmenin devamı anlaşılır olsun; gerekirse açılır menü kullan. Header erişim kontrolü Server Component'te kalsın.
- [x] Ana sayfa masaüstü/mobil menüye `/katilimci/giris` bağlantısı ekle. Ekip başvuru kapanışını katılımcı girişinden açıkça ayır. `StickyNav.go()` yalnız hash bağlantılarını scroll etsin; yeni route bağlantısını yanlışlıkla engellemesin.
- [x] `/giris/katilimci` için kanonik `/katilimci/giris` yönlendirmesi ekle. Genel 404'te ana sayfa ve katılımcı girişine görünür dönüş sun; oturum/yetki kontrolünü atlatma.
- [x] Yerel tarayıcı kontrolü: menüden gerçek route'a geçiş, mobil menü kapanışı/odak, panelde etkin sekme, yanlış yol yönlendirmesi, bilinmeyen sayfada kurtarma bağlantısı.

## Görev 6 — Mobil tablolar ve çark erişilebilirliği (P2/P3)

**Dosyalar:** Modify `components/panel/ApprovedClient.tsx`, `components/panel/SendingClient.tsx`, `components/ui/DisciplineWheel.tsx`, `app/(operations)/operations.css`; P3 için `components/sections/TeamGallery.tsx`, `components/ui/PhotoSlot.tsx`, `lib/content.ts`.

- [x] 600 px altında kesin kabuller ve e-posta satırlarını etiketli kişi kartları olarak göster; desktop tablosunu koru. Aynı veri kaynağını kullan; gizlenen düzenin kontrolleri klavye/ekran okuyucuya ikinci kez açılmasın. E-posta/komite adı sarılsın, işlemler dar ekranda okunabilir olsun.
- [x] QR indirme eylemlerini kullanıcı dilinde adlandır; mevcut SVG/PNG indirme formatlarını koru. Tablo içi işlem hedeflerini mobilde en az 44 × 44 px tasarım hedefine getir.
- [x] Çarka görünen disiplin seçim düğmeleri ekle. Tab/Enter/Space ile bütün notlara erişilsin; seçili düğme `aria-pressed` veya uygun tab semantiği kullansın. Dokunmatik kaydırma ve mevcut tasarım korunur, doğrudan seçim yolu da bulunur.
- [x] İsteğe bağlı P3: gerçek görseli olmayan galeriyi gizle veya bilinçli metin bölümüyle değiştir. Başka kişilerin fotoğrafı/görseli temin edilmeden eklenmez.
- [ ] 390/768/1440 px, 200% yakınlaştırma, uzun isim/e-posta, klavye ve reduced-motion kontrolü yap. Kontrastı ölç; ancak ölçüm sonrası gerçek başarısızlıkları düzelt.

Çarkın doğrudan seçim yolu, mevcut `sel` ve `setSel` state'ini paylaşsın:

```tsx
<div role="group" aria-label="Disiplin seçimi">
  {disciplines.map((discipline, index) => (
    <button key={discipline.name} type="button"
      aria-pressed={sel === index}
      onClick={() => setSel(index)}>
      {discipline.name}
    </button>
  ))}
</div>
```

Dokunmatik scroll listener'ının hemen bu seçimi ezmemesi için doğrudan seçimden sonra ilgili scroll konumuna ilerle veya manuel seçimi bir sonraki kullanıcı kaydırmasına kadar koru; programatik scroll'u kullanıcı girişi sayma. Reduced-motion'da anlık konum değişimi kullan.

## Görev 7 — Kabul doğrulaması ve kontrollü canlı test

**Dosyalar:** Create `docs/reviews/2026-10-04-ui-iyilestirme-dogrulama.md`; gerektiğinde yalnız test helper'ında eksik React zamanlaması desteğini genişlet, saf render testini gerçek browser kanıtı diye sunma.

- [x] Sırayla çalıştır: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `git diff --check`. Hata yoksa aynı kontrolleri sebepsiz tekrarlama. Mevcut build uyarılarını yeni regresyondan ayır.
- [ ] Yerel uygulamada başarı, HTTP hatası, yanıt kaybı ve başarılı POST sonrası GET hatası senaryolarını doğrula. Ağ hata enjeksiyonu canlı ortamda yapılmaz. Chrome açılmaz.
- [x] Kanıt raporuna her UI-ID için düzeldi/ertelendi, otomatik test adı, tarayıcı ekranı ve kalan sınırı yaz. 404/ana sayfa için canlı okuma; admin için oturum açılmadıysa yalnız kaynak/yerel kanıt olduğunu belirt.
- [ ] Üretim yayını istenirse doğrulanmış commit'i yayımla; deployment READY ve doğru domain alias'ını doğrula. Bu UI planı için migration çalıştırma.
- [ ] Yetkili tek test hesabıyla bir tam canlı akış: başvuru ekle → isimli başarı kartı → bir komite/tek aday kabulü → mail durumunu doğrula → kullanıcı tarafından giriş/şifre adımları → bir test dekontu yükle → inceleme kartı → admin tek düğmeyle kabul → isimli başarı kartı → kesin kabul listesi ve katılımcı QR görünümü. Önceden hazır dekontla yalnız kabulden başlayan kontrol, tam akış diye raporlanmaz.
- [ ] Aynı dekonta tek kabul işlemi uygula; sonra salt okunur doğrulama yap. Başarılı yanıtın ardından ikinci bir mutation test amacıyla gönderilmez. Gerçek mail yalnız yetkilendirilmiş test alıcısına; test verisi temizliği ayrıca yetkilendirilmeden yapılmaz. Yeni şifre girişini kullanıcı tamamlar.
- [ ] Canlı veri kanıtı: seçilen test başvurusu confirmed, dekont approved/review_source=receipt, etkin QR var, mükerrer mail işi yok. Mail teslimatını gerçek webhook kaydıyla ayrı doğrula; servis kabulünü teslim edildi diye raporlama. Gizli URL/token ve şifreyi rapora yazma.
- [x] Sonuç kartlarının screenshot'larını sakla. Kullanıcı işlem sonucunu bulunduğu konumda ve klavye odağında görebilmeli; sayfanın tepesine kendi başına çıkması gerekmemeli.

## Tamamlanma ölçütleri

- Başvuru ekleme ve dekont kabulünde kişinin adıyla görünür, kalıcı başarı kartı vardır.
- Son kayıt üzerinde başarı ve “Liste alınamadı” aynı anda görünmez.
- Yenileme sırasında isimler gereksiz yere kaybolmaz; eski filtre yanıtı yeni filtreyi ezmez.
- Başarılı mutation sonrası GET hatası kullanıcıyı tekrar kabul/kayıt/gönderim yapmaya yönlendirmez.
- Toplu kabulde komite, sayı ve kısmi/belirsiz sonuç korunur; gerçek teslimat kanıtı doğru sunulur.
- Ana sayfadan katılımcı girişine ulaşılır; yanlış giriş yolu doğru yere yönlenir.
- Tokensız aktivasyon ve yükleme hatası, açıklamalı kurtarma adımı sunar.
- Mobil ana işlemler taşmaz; klavye odağı ve sonuç duyuruları doğrulanır.
- Yerel doğrulama ve canlı doğrulama raporda birbirinden açıkça ayrılır.

## Plan öz incelemesi

P1 işleri Görev 1–2'de önce çözülür. Görev 3–6 aynı ortak kart/state yaklaşımını kullanır; ayrı bir bildirim altyapısı veya yeni servis kurulmaz. Sunucu güvenliği ve e-posta/ödeme durumları değiştirilmez. Kaynak bulguları tarayıcı gözlemi diye sunulmaz. Mevcut idempotency/kurtarma testleri korunur. Canlı kabul ve tam canlı test sonucu ancak Görev 7'nin kanıtıyla tamamlandı sayılır.

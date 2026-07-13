# PLAN-A — "AKINTI OMURGASI" · Sıfırdan Sinematik Redesign

> **Durum:** Onaylı tasarım planı (14 Temmuz 2026). Kod henüz yazılmadı.
> **Kapsam:** Bölüm tasarımları ve etkileşimler sıfırdan; marka kimliği değişmez
> (teal→cyan Akıntı gradyanı, Fraunces / Hanken Grotesk / IBM Plex Mono, katmanlı
> near-black, tek easing `cubic-bezier(0.16,1,0.3,1)`).
> **Not:** Bu plan uygulanırsa PLAN-B'nin 1, 2, 4, 12 ve 23. maddeleri zaten
> kapsanır; iki plan birbirinden bağımsızdır, B bu planın ön koşulu değildir.

## Ana fikir

Teal akıntı artık arka plan değil, **sayfanın kendisi**: hero'daki partikül alanından doğan tek, kesintisiz, ışıklı bir **omurga (nehir)** sayfayı fiziksel olarak baştan sona kat eder. Her bölüm bu nehir üzerinde bir olaydır — daralır (Boğaz), 9 kola ayrılır (Delta), durulur (Havuz), çağlayanlarla düşer (Süreç), girdaplanır (Anafor) ve denize kavuşur (Mansap = başvuru CTA'sı). Sayfa üst üste dizilmiş bölümler değil, tek bir organizma gibi okunur. Işık dramaturjisi yolculuğa gerilim verir: parlak kaynak → kararan delta → sayfanın en parlak noktası olan mansap. Telefonda (ziyaretçi çoğunluğu) omurga sol kenar rayına katlanır — konsept ucuz bir fallback'e değil, aynı fikrin kompakt haline iner.

## Global sistemler

1. **Omurga** — `components/flow/Spine.tsx` + `lib/spine.ts`. Bölüm başına server-rendered inline SVG segmenti: `viewBox="0 0 1000 H"`, `preserveAspectRatio="none"`, `vector-effect="non-scaling-stroke"`, 1.5–2px stroke, marka gradyanı (`gradientUnits="userSpaceOnUse"`, dikey). **Dikiş sözleşmesi** `lib/spine.ts`'te: her segment sabit viewBox x'inde çıkar/girer, küçük bir kümeye oturur (80 / 300 / 500 / 700) — hizalama genişlikten bağımsız; stroke'lar son/ilk ~60 birimde şeffafa söner ve dikişler SectionAtmosphere'in mevcut feathered `seam` bandının içine düşer. Parıltı SADECE stroke'un arkasındaki önceden-blurlanmış gradyan div'lerden gelir — **SVG filtresi (drop-shadow/feGaussianBlur) yasak**. Çizilme animasyonu: bölüm girişinde tek seferlik 0.8s `stroke-dashoffset`, yalnızca `prefers-reduced-motion: no-preference` altında eklenir; CSS varsayılanı dashoffset 0 — **tamamen çizili nehir base katmandır**. `pointer:coarse` altında her segment x≈80'de sol raya katlanır.
2. **SpinePulse** — `components/flow/SpinePulse.tsx` + `lib/useInViewPause.ts` (paylaşılan tek IntersectionObserver + `visibilitychange` hook'u). CSS `offset-path`/`offset-distance` keyframe'iyle omurgada süzülen radyal parıltılı bir `<span>` kuyrukluyıldız (compositor transform, rAF yok). Sayfa genelinde aynı anda en fazla 1–2 tane; ekran dışında duraklar; reduced-motion'da yok.
3. **Işık skoru** — `SectionAtmosphere`'e `intensity` prop'u (mevcut pool/aurora alfalarını çarpar; tonlar cool→deep→flux→calm→warm→rise kalır). Skor: Hero **0.85** → Vizyon **0.45** → Ekipler **0.25** (taban — tüm ışık omurga ve kollarda) → Ekibimiz **0.4** → Süreç **0.55** → SSS **0.3** → İletişim **1.0** (zirve) → Footer **0.6**.
4. **Başlık sistemi** — `SectionHeader.tsx` üç varyanta ayrılır (tekdüze başlık emekli): `variant="numeral"` (sol kenardan taşan hairline-outline Fraunces numara `clamp(8rem,18vw,16rem)`, başlık üzerine biner — Ekiplerimiz, İletişim), `variant="titlecard"` (full-bleed Fraunces italik satır + mono slug — Vizyon/Temamız), `variant="slug"` (yalnızca mono `04 / SSS — 17 SORU` + 1px çizgi — Ekibimiz, Süreç, SSS).
5. **Şekil kuralı** (tek cümle, her yerde): *akıntıya değen kenar keskin (0 radius), serbest kenar yumuşak (1.25rem)*. Saf "baskı" öğeleri (ledger satırları, çerçeveler, sluglar) tamamen keskin; etkileşimli kontroller (buton, pill, toggle) pill/1.25rem kalır.
6. **Tipografi disiplini** — Display-XL `clamp(4rem,11vw,10rem)` sayfada tam iki kez görünür (hero başlığı, İletişim linki); iki XL anı asla aynı anda ekranda olmaz; mono etiketler 10–11px `tracking-[0.22em]`.
7. **FlowRail** — `components/nav/FlowRail.tsx`, `ScrollProgress` + `SideRails`'in yerine: sağ kenarda gradyan mini-omurga, mono istasyon işaretleri (KAYNAK · BOĞAZ · DELTA · HAVUZ · ÇAĞLAYAN · ANAFOR · MANSAP), konum noktası, tık → `window.__lenis?.scrollTo()`. Sadece `lg:`+; rAF-throttle scroll okuması `scaleY` + `textContent` sürer. Reduced-motion: statik işaretler.
8. **Reveal** tek reveal imzası kalır; ama *yönü* artık omurgadan dışa doğru akar (vektör değişir, easing asla).

## Bölüm bölüm

### Nav (StickyNav — korunur, rötuşlanır)
Yapı aynı (AeroMark, `nav.links`, CTA pill). Aktif linke 2px gradyan alt çizgi (`scaleX`, origin-left). Mobil sheet: FlowRail istasyon adlarıyla eşleşen mono etiketler + büyük CTA.

### Hero — "Kaynak"
- **Yerleşim (asimetrik, sola demirli):** durum pill'i sol üst; başlık `SİRKÜLASYON` Fraunces Display-XL roman + altında `Çalıştayı '26` italik ~%40 boyda sağa girintili — roman/italik çarpışması kompozisyonun kendisi. CTA (MagneticButton) + `ctaNote` sol altta. Countdown sağ kenarda dikey IBM Plex Mono kolonu (`writing-mode: vertical-rl`, `lg:`+; mobilde CTA altında yatay).
- **Sinematik an:** jenerik girişi — her display satırı `overflow-hidden` sarmalayıcıda `translateY(110%)→0`, 90ms stagger, tek easing; FlowField opaklığı yazı oturduktan +0.4s SONRA açılır (H1 tartışmasız text-LCP kalır). Sonra devir teslim: FlowField'a yakınsama bias'ı — partiküller alt-ortada dar parlak bir banda toplanır, ilk Spine segmentinin ışıklı ucu hero'ya ~120px sokulur ve **scroll göstergesinin kendisi olur** (geleneksel "↓ KEŞFET" silinir).
- **Scroll çıkışı (pin yok):** tek `useScroll` hero ilerlemesini canvas karartma overlay'ine (0→0.6) ve başlık `translateY(-6%)`/opacity'ye bağlar. Sticky sarmalayıcı yok, sıfır CLS.
- **Disiplinler:** `MarqueeStrip` — hairline'lar arasında full-bleed mono caps şeridi, CSS keyframe `translateX` döngüsü (~45s), bir kez duplike, ekran dışında + `visibilitychange`'de duraklar.
- **Dokunmatik/reduced-motion base:** statik mesh (FlowField'in mevcut base'i), satırlar 0.3s opacity ile hemen görünür, statik şerit, omurga ucu baştan yanık.

### Vizyon & Misyon — "Boğaz"
- Omurga masaüstünde x≈300'de dikey akar. Vizyon sağ yakada (kolon ~5–12, Fraunces drop-cap), Misyon ~16vh aşağıda sol yakaya geçer (kolon 1–7) — çapraz okuma yolu, kart yok. 30px "dere kolu" çizgileri her ifadeyi omurgaya bağlar; reveal'lar omurgadan dışa kayar (yaka başına yön değişir).
- **Temamız:** ilk `DisplayLine` — full-bleed Fraunces italik `clamp(2.5rem,7vw,6rem)`, tek gradyan-clip kelime, scroll'da `scale(0.96→1)` + opacity; omurga arkasından geçer (2px near-black text halosu).
- **Sinematik an:** omurganın çıkışı içe kıvrılıp DisciplineWheel göbeğinde sonlanır; bir SpinePulse gelip göbekte kaybolur. Çark girişte −40°→0° döner + 0.85→1 ölçeklenir (tek `useTransform`, ilk 60vh). **Çarkın içi dokunulmaz** — masaüstünde cursor-açısı, dokunmatikte mevcut scroll-scrub sticky.
- **Base:** sol ray omurga, ifadeler sağında dikili; çark 0°'de statik, ilk not açık.

### Ekiplerimiz — "Delta · Dokuz Kol" — SET PIECE
- **Atmosfer:** intensity 0.25 taban; `swirl` kapalı; **`CurrentField.tsx` silinir** (yerini alan var).
- **Yerleşim (masaüstü):** bölüm başında omurga 9 ince kola yelpazelenir (`DeltaBranches`, tek SVG). 3×3 grid ölür: komiteler merkez omurganın **soluna/sağına dönüşümlü**, dikey ofsetli iki kolonda kıyıya yanaşır. Kartın omurgaya değen kenarı keskin, dış kenarı 1.25rem (şekil kuralı); ghost numara filigranı, Fraunces isim, blurb, 3 görev pill'i, mono başkan satırı mevcut kart anatomisinden korunur. Başlık `variant="numeral"` — outline "02" negatif margin'le önceki bölümün alt boşluğuna bindirilir.
- **Sinematik an 1 (scroll):** pin'siz "ışığa yakalanma" — merkez bantlı tek IntersectionObserver viewport ortasına en yakın komiteyi "yanık" işaretler: kolu parlar, kartı tam mürekkebe geçer, kardeşleri ~%60'a söner (class toggle, sadece opacity geçişleri). Akıntı scroll ettikçe komiteleri tek tek sahneye alır.
- **Sinematik an 2 (tez):** 9. karttan sonra kollar **tek parlak korda yeniden birleşir** ve CTA bandına akar — keskin hairline baskı bandı, Fraunces italik "Sen de aramıza katıl." Display-L + MagneticButton. Kordun parıltısı hero'dan beri en parlak nesne: dokuz ekip, tek akıntı, sen de katıl.
- **Hover (`pointer:fine`):** accent yanaşma noktasından dışa tutuşur (`scaleX`, dock tarafından) + koldan karta bir nabız koşar. Tekdüze üst-çizgi büyümesi emekli.
- **Dokunmatik base (çoğunluk):** sol ray omurganın sağında tek kolon; her komite kompakt bir "yanaşık satır" (isim + başkan hep görünür), dokun → `grid-template-rows 0fr→1fr` genişletici (blurb + pill'ler), aynı anda tek açık, +→× dönüşü. 9'u da dokunmadan taranabilir; sayfa kısa kalır. Kollar sırayla tek yavaş ambient nabız taşır (IO-duraklı). `teams.modalHint` emekli — satırın kendisi detay görünümü.
- **Reduced-motion:** tüm kollar çizili, tüm kartlar tam mürekkep, genişleticiler anlık, nabız yok.

### Ekibimiz — "Durgun Havuz"
- **Tempo vadisi:** sayfanın en kısa padding'i (`py-16/20`), başlık `variant="slug"` (`03 / YÜZLER — FOTOĞRAFLAR YAKINDA`). Numara yok, display başlık yok — nefes.
- **Yerleşim:** omurga galerinin arkasında sakin yatay sinüs bandına genişler. Masaüstü: 10 çerçeve (1 geniş grup + 9 komite) bandın eğrisini izleyen iki kademeli sıra (statik ofsetler), ±10–12px scroll paralaksı (`pointer:fine` + motion-ok). Dokunmatik: bandın üstünde native `overflow-x` scroll-snap kontak şeridi, kenar-fade maskeleri, pasif `scrollLeft` dinleyicisinden ince `scaleX` ilerleme çizgisi.
- **Sinematik an:** **biyolüminesan çerçeveler** — keskin 0-radius PhotoSlot'lar duruşta neredeyse görünmez (hairline %6), viewport'a girince 0.8s'de bir kez ışıldar (sadece opacity, IO tetikli). İçlerinde soluk AeroMark filigranı + mono metadata `KARE 04/10 · MEDYA · 2026`; ortak altyazı mevcut `teamGallery.note`. Dürüst, premium boş-durum.
- **Base:** çerçeveler baştan ışıldamış, paralaks/parlama yok — yine kurulu bir sahne.

### Süreç — "Dört Çağlayan"
- Tek serpantin S-yolu bölümü zikzaklar (`ProcessSerpentine`); 4 adım kıvrımlara oturur, numaralı düğümler yolun ÜSTÜNDE, masaüstünde taraf değiştirir. Başlık `variant="slug"`, ilk kıvrımın içine yuvalanır. Numaralara "tutuşma": outline + gradyan dolgulu kopya üst üste, adım aktifleşince dolgu crossfade.
- **Sinematik an:** bölüm `useScroll`'u ilerlemeyi bir nabzın `offset-distance`'ına bağlar; nabız adımlara 1→2→3→4 *varır*; aktif adım tam mürekkep, diğerleri %55 (sadece opacity). 04'te nabız parlar (önceden render radyal, opacity 0→1) ve satır içi mono "Ekibe Katıl →" linki belirir — sayfa ortasının sessiz CTA'sı.
- **Dokunmatik base:** yol sol raya yapışır, adımlar sağda dikili, nabız yine scrub'lı (tek transform — ucuz). **Reduced-motion:** yol tam çizili, tüm düğümler dolu, tüm adımlar tam mürekkep, link hep görünür.

### SSS — "Anafor"
- **Masaüstü split:** solda sticky `Eddy` — omurganın kıvrıldığı statik SVG spirali, arkasında tek yavaş dönen yumuşak parıltı div'i (transform rotate, IO-duraklı), slug başlık spiralin içinde; artı 17 soruyu yeniden gruplayan üç mono etiket — **ÇALIŞTAY HAKKINDA / BAŞVURU & EKİPLER / SÜREÇ & PRATİK** (`content.ts`'e `group` alanı; asla hardcode değil); etikete tık `window.__lenis` ile kaydırır. Sağda **ledger**: keskin hairline satırlar, mono `S.01–S.17` cetveli, sorular **Fraunces 1.5rem**, cevaplar Hanken muted. Listenin sol kenarını dikey gradyan hairline diker ve **açık maddede kabarır** (madde başına `::before`, opacity/`scaleY` — dikkatin olduğu yerde akıntı şişer). Sol-keskin/sağ-yumuşak (şekil kuralı); + 45° dönerek ×; `0fr→1fr` açılış; aynı anda tek açık.
- **Sinematik (ucuz, `pointer:fine`):** açılan satırda tek maskeli gradyan süpürme, `translateX(-100%→100%)`, 0.7s.
- **Dokunmatik base:** tek kolon, grup etiketleri sticky mono mini-başlıklar, anafor listenin üstünde küçük süse iner. **Reduced-motion:** anlık aç/kapa, süpürme yok, statik anafor.

### İletişim — "Mansap" (doruk)
- Girişte ikinci `DisplayLine` ara sözü (yeni tek `content.ts` satırı). Atmosfer intensity **1.0** — sayfanın en parlak noktası; omurganın son segmenti merkez-altta geniş radyal **ışık havzasına** iner.
- **Yerleşim:** başlık `variant="numeral"` ("05"). Sayfanın ikinci Display-XL'i: **"Ekibe Katıl" dev Fraunces italik satır olarak Google Form linkinin TA KENDİSİ** — havzanın ışıklı merkezinde; hover'da gradyan dolgu crossfade (önceden render kopya, opacity), `pointer:fine`'da MagneticButton, dokunmatikte ≥48px sade dokunma hedefi. **Sayfanın en parlak pikseli = link.** PersonCard'lar havzanın kıyılarında (tilt + cursor-glow korunur, `pointer:fine`); altta mono sosyal listesi, KVKK küçük baskı ve countdown'ın **ikinci ve son** görünüşü tek mono satır — çıkışta aciliyet.
- **Sinematik an:** havza girişte bir kez açar — opacity 0→1, 1.2s; 0.8s'den yavaş tek istisna (final ayrıcalığı).
- **Base:** aynı yerleşim; havza baştan açık; italik kelimede statik gradyan; tilt/mıknatıs yok.

### Footer — "Ufuk"
Omurganın stroke'u 3–4 statik parıltılı ince full-width gradyan ufuk çizgisine çözülür; küçük AeroMark, `footer.rights` + nav yankısı 10px mono, `py-10`. Display-XL'den sonra sessizlik doğru son kare. `Footer.tsx` korunur, yeniden giydirilir.

## Bileşen envanteri

- **Aynen korunur:** FlowField (+bias/fade parametreleri), DisciplineWheel, PersonCard'lar, MagneticButton, Countdown, Reveal, Starfield, SiteBackground, Preloader, SmoothScroll, MotionProvider, Cursor, Cta, AeroMark, TikTokIcon.
- **Retune:** SectionAtmosphere (+`intensity`), SectionHeader (3 varyant), PhotoSlot (biyolüm/keskin), StickyNav (alt çizgi + istasyon sheet), Footer (ufuk).
- **Yeniden yazılır:** Teams, Process, Faq (sunum katmanı), TeamGallery, Contact, VisionMission, Hero.
- **Yeni:** `lib/spine.ts`, `lib/useInViewPause.ts`, `components/flow/Spine.tsx`, `components/flow/SpinePulse.tsx`, `components/flow/DeltaBranches.tsx`, `components/flow/ProcessSerpentine.tsx`, `components/flow/Eddy.tsx`, `components/ui/DisplayLine.tsx`, `components/ui/MarqueeStrip.tsx`, `components/nav/FlowRail.tsx`.
- **Silinir:** `components/ui/CurrentField.tsx`, eski `ScrollProgress` + `SideRails` (FlowRail'e katılır), `teams.modalHint` kullanımı, geleneksel scroll işareti.
- **`content.ts` eklemeleri:** 1–2 ara söz/tema satırı, SSS `group` işaretleri, galeri kare etiketleri, FlowRail istasyon adları (veya `nav.links`'ten türetilir). Metin her zaman content.ts'te.

**Tahmini JS farkı: ~8–12KB gzip, sıfır yeni bağımlılık** — omurgalar server-rendered SVG + CSS; yeni client JS iki `useScroll` scrub'ı (hero çıkışı, Süreç nabzı), bir paylaşılan IO hook'u, genişletici/ledger state'i ve FlowRail'den ibaret. 150KB'ın rahat içinde.

## Build sırası

1. **Temeller:** `intensity` prop'u + ışık skoru tüm bölümlere; SectionHeader varyantları; şekil-kuralı utility'leri. Anında sayfa geneli ritim düzelmesi, sıfır risk.
2. **Omurga, önce statik:** `lib/spine.ts` + Spine + SpinePulse + useInViewPause; tamamen çizili nehir tüm bölümlerden + mobil sol raydan geçirilir. Reduced-motion base'i uçtan uca, herhangi bir animasyondan ÖNCE var olur (CLAUDE.md kuralı).
3. **Ekiplerimiz rebuild** (DeltaBranches, yanaşma düzeni, dokunmatik genişleticiler, birleşme CTA'sı; CurrentField silinir) — çekirdek bölüm, en büyük getiri.
4. **Hero rekompozisyonu** (jenerik girişi, MarqueeStrip, omurga devri, scroll çıkış solması).
5. **Süreç** serpantin + scrub nabız + satır içi CTA.
6. **SSS** anafor + ledger + gruplar.
7. **Ekibimiz** havuz + biyolüm + kontak şeridi metadata'sı.
8. **İletişim** havza + Display-XL link + ara söz; Footer ufku.
9. **FlowRail + nav cilası; perf denetimi:** `npm run build` first-load JS, Lighthouse LCP/CLS, gerçek orta-segment Android'de scroll testi.

## İlk 3 performans riski + önlem

1. **Uzun stroke'larda SVG glow filtreleri** (düşük-uç Android'de GPU ölümü). Önlem: `filter: drop-shadow`/`feGaussianBlur` kesin yasak; tüm parıltı stroke arkasındaki önceden-blurlanmış gradyan div'lerden (SectionAtmosphere'in ev tekniği); stroke'lar 1.5–2px non-scaling.
2. **Sürekli path animasyonundan paint fırtınası.** Önlem: `stroke-dashoffset` yalnızca tek seferlik 0.8s çizilme, motion-ok kapılı; tüm sürekli hareket `offset-path` (compositor) veya düz translate; bölüm başına tek kısa path, asla sayfa boyu tek path değil; en fazla 1–2 görünür nabız, paylaşılan IO + `visibilitychange` duraklatması. Eski Safari `offset-path` düşerse statik çizili omurgaya iner — görünmez bir bozulma.
3. **Ekiplerimiz scroll yükü** (9 yarı saydam kart + merkez spotlight + kol tutuşması). Önlem: komite kartlarında `backdrop-filter` yok — katmanlı yarı saydam gradyanlar; merkez vurgusu 9 düğümde kare-başı `useScroll` matematiği değil, tek IntersectionObserver class toggle'ı; satırlar lokal aktif state ile memoize; hover nabızları yalnız `pointer:fine`.

İzleme listesi: Fraunces display boylarında (H1 text-LCP kalmalı, FlowField geç açılır); CLS (galeri karelerinde açık `aspect-ratio`; tüm omurga katmanları absolute + `aria-hidden`; genişleticiler kullanıcı tetikli); marquee'nin ekran dışı duraklaması zorunlu.

## Kabul kriterleri

- `npm run build`: first-load JS < 150KB gzip; Lighthouse mobil: LCP < 2.5s, CLS < 0.1.
- DevTools "Emulate CSS prefers-reduced-motion" + dokunmatik emülasyonda: sayfa eksiksiz, omurga tam çizili, hiçbir içerik animasyona rehin değil.
- 360×640 gerçek/emüle telefonda: hero taşmıyor, 9 komite satırı akıcı, tüm dokunma hedefleri ≥44px.
- Tek accent, saf #000/#fff yok, tüm metin `content.ts`'ten, mojibake yok.

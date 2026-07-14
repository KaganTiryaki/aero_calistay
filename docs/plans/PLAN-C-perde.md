# PLAN-C — "PERDE" · Igloo Tarzı Scroll-Yolculuk, Tamamen Yeni Kimlik

> **Durum:** Onaylı yön (14 Temmuz 2026): Igloo tarzı kaydırmalı sahne-sinema +
> **hibrit WebGL** + **yeni koyu dünya**. Bu plan PLAN-A ve PLAN-B'yi tamamen
> geçersiz kılar (o branch'ler referans olarak durabilir, merge edilmez).
> **Eski "Akıntı" kimliği (teal→cyan, Fraunces/Hanken, near-black mavi-yeşil
> void) KÖKTEN gider.** CLAUDE.md'nin marka bölümü bu planla birlikte yeniden
> yazılır.

## Ana fikir — "Perde"

Site bir **gece tiyatrosu / fikirler müzesinde** tek bir yürüyüş: perde açılır,
ziyaretçi spot ışıklı salonlardan geçer, sahne arkasını görür ve çıkışta eline
**altın bir davetiye** tutuşturulur (başvuru CTA'sı). Scroll = kamera. Her bölüm
bir sahne ("perde"); bölümler kaydıkça biri diğerine sinematik biçimde devreder
(Igloo mantığı: sayfa değil, yolculuk). Sirkülasyon teması korunur ama su değil
**ışık dolaşır**: tek bir spot ışığı huzmesi sayfa boyunca sahneden sahneye
devredilir.

## Yeni kimlik (eski kurallar geçersiz)

### Palet — "Gece Sahnesi" (bordo-siyah + amber sahne ışığı)
- Zemin katmanları (asla saf siyah): `--stage-0 #120609` · `--stage-1 #1A0A0F`
  · `--stage-2 #251016` · `--stage-3 #331722` (kadife bordo-siyah aile)
- Accent — **sahne ışığı**: `--light: linear-gradient(115deg,#E89B3D,#F2C879 55%,#FFE3B3)`
  (amber→altın; teal'in yerini alan TEK accent)
- Derin vurgu: `--velvet #7A2338` (kadife bordo — yüzey/çizgi vurgusu, ikinci accent değil, zemin ailesinin parlak ucu)
- Metin: `--ink #F7EFE3` (sıcak fildişi) · `--muted #B39A93` · `--dim #7E625F`
- Kural: ışık her zaman TEK kaynaktan gelir (spot mantığı) — her sahnede bir
  parlaklık odağı, gerisi karanlıkta. Vignette + hafif film grain kalır (teknik
  olarak iyiydi), renk sıcaklığı amber'e döner.

### Tipografi — tamamen yeni üçlü (hepsi `next/font`, subset `["latin","latin-ext"]`)
- Display: **Bodoni Moda** (yüksek kontrast didone — tiyatro afişi; italik varyantı dahil)
- Gövde/UI: **Instrument Sans**
- Etiket/kicker: **Space Mono** (bilet/koltuk numarası estetiği: `PERDE I · SIRA 07`)
- Fraunces / Hanken Grotesk / IBM Plex Mono tamamen kaldırılır.

### Hareket
- Tek easing kalır ama yenilenir: `cubic-bezier(0.22, 1, 0.36, 1)`; scrub'lı
  sahnelerde easing yok (scroll = zaman çizgisi).
- Sadece `transform`/`opacity`; reduced-motion BASE katman; `pointer:coarse`
  için her sahnenin dokunmatik karşılığı tanımlı (aşağıda sahne sahne).

## Teknik mimari

### Sahne sistemi (yeni çekirdek)
- `components/stage/Scene.tsx` — pinli sahne primitifi: dış sarmalayıcı
  `height: N*100vh`, içte `position: sticky; top:0; height:100svh` kart; motion
  `useScroll({target})` → `useTransform` ile sahne-içi koreografi scrub'lanır.
  GSAP YOK — mevcut `motion` + Lenis yeterli.
- `components/stage/SceneScript.ts` deseni — her sahnenin koreografisi
  (hangi progress aralığında ne transform olur) bileşen içinde tek "script"
  objesinde durur; okunabilirlik için zorunlu desen.
- `lib/useCapability.ts` — cihaz sınıflandırma hook'u: `fine-pointer` +
  `!prefers-reduced-motion` + (`deviceMemory ≥ 4` veya bilinmiyorsa viewport ≥
  1024) → `"webgl"`, değilse `"flat"`. Tek yerden tüm gating.
- Lenis kalır (touch'ta kapalı), `window.__lenis` sözleşmesi ve
  `scrollToId` aynı kalır.

### Hibrit WebGL (sadece kilit anlar)
- Bağımlılık: `three` (sade, R3F'siz — tek sahne için gereksiz soyutlama yok).
  `next/dynamic` + `useCapability()==="webgl"` + IntersectionObserver ile SADECE
  görünürken lazy mount; `requestIdleCallback` sonrası yüklenir; First Load
  JS'e GİRMEZ (ayrı chunk).
- **WebGL Anı 1 — Hero "Avize":** 7 disiplinin sembolünü taşıyan, yavaşça dönen
  düşük-poly bir avize/orbit halkası; tek amber spot + hafif toz partikülü;
  scroll hero'dan çıkarken kamera hafif yukarı kayar (scrub). Malzeme: matcap →
  ışık hesabı ucuz.
- **WebGL Anı 2 — Final "Davetiye":** başvuru sahnesinde havada asılı, yavaşça
  dönen altın bilet (tek mesh + normal map); hover'da (fine) hafif tilt.
- **Flat fallback (telefon çoğunluğu + reduced-motion):** aynı sahnelerin önceden
  hazırlanmış katmanlı 2D versiyonu — radial spot gradyanları + CSS parallax +
  statik avize/bilet illüstrasyonu (SVG). Fallback "eksik sürüm" değil, kendi
  başına kurulu bir sahne olarak tasarlanır ve ÖNCE o yapılır (base katman kuralı).
- Canvas kuralları aynen: DPR cap 1.5 · IO + visibilitychange pause · reduced
  motion'da hiç mount edilmez.

### Performans sözleşmesi (CLAUDE.md'ye yazılacak yeni hali)
- **Base First Load JS < 170KB** (three hariç; three ayrı lazy chunk, yalnızca
  "webgl" sınıfı cihazlarda iner).
- LCP < 2.5s (hero başlığı HTML-first; WebGL geç mount olur, LCP'yi bekletemez)
  · CLS < 0.1 (tüm sticky sarmalayıcılar sabit yükseklik; WebGL yerine geçtiği
  fallback ile aynı kutuda).
- Scrub'lar yalnızca transform/opacity üretir; pinli sahnelerde `will-change`
  disiplinli kullanılır (aktif sahnede var, çıkınca kalkar).

## Sahne sahne (içerik `lib/content.ts`'ten aynen; yeni metin gerekirse önce content.ts'e)

### Perde I — Hero "Açılış"
Tam ekran karanlık; tek amber spot yanar (radial, 0→1). Bodoni Moda dev başlık
`SİRKÜLASYON` satır satır spot içinde belirir; altında italik `Çalıştayı '26`.
WebGL avize başlığın arkasında derinlikte döner (flat: SVG avize + parallax).
Countdown "gişe" bandında: `SON BİLET: 02.08.2026 — 18G 04S 22D` Space Mono
tek satır. CTA: `Ekibe Katıl` — bilet biçimli buton (zımba delikli kenar,
amber dolgu). Scroll başlarken spot daralır ve aşağı "devredilir" (ışık devri
imzası). Dokunmatik: pin yok, sahne normal akar, spot statik açık.

### Perde II — Vizyon & Misyon "Fuaye"
İki manifesto bloğu; her biri kendi küçük spot havuzunda, sahneye soldan/sağdan
scrub ile girer. Vizyon ve Misyon arasında ışık el değiştirir (birinin havuzu
sönerken diğerininki yanar — opacity crossfade, scrub'lı). Kart yok; saf
tipografi + ince altın cetvel çizgileri.

### Perde III — Disiplinler "Yedi Salon" (SET PIECE 1)
Igloo imzası an: pinli sahnede **yatay pan** — 7 disiplin "salonu" (uzun
yatay şerit, `translateX` scroll'a scrub'lı). Her salon: dev Bodoni numara
(`I.–VII.`), disiplin adı, tek satır not; aktif salon spot altında, komşular
karanlıkta. DisciplineWheel emekli olur — yatay salon geçidi onun yerini alır.
Dokunmatik: pin yok; native yatay scroll-snap şerit (kenar fade + ilerleme
çizgisi). Reduced-motion: dikey sade liste, hepsi aydınlık.

### Perde IV — Ekiplerimiz "Sahne Arkası" (SET PIECE 2)
"Backstage" havası: 9 komite, **cast listesi** gibi — tiyatro programı
estetiğinde iki kolonlu afiş listesi (rol adı büyük Bodoni, başkan adı Space
Mono, görevler ince satır). Scroll'da spot listeyi yukarıdan aşağı tarar
(viewport-ortası IntersectionObserver: aktif satır tam ışık, diğerleri loş).
Satıra hover/tap → sağda (mobilde altında genişleyerek) "soyunma odası kartı"
açılır: blurb + görevler. Bölüm sonunda ışık tüm listeyi bir kez yalar ve CTA
bandına akar: `Kadroda yerini al.` (İtalik Bodoni) + bilet-buton.

### Perde V — Ekibimiz "Kadro Duvarı"
Müze çerçeveleri: boş foto slotları ince altın çerçeveli, altında Space Mono
künye (`KADRO 04/10 — MEDYA`). "Fotoğraflar yakında sergilenecek" notu
(content.ts'teki mevcut not). Girişte çerçeveler tek tek aydınlanır (opacity,
IO). Kısa, nefes sahnesi — pin yok.

### Perde VI — Süreç "Dört Perde"
4 adım = 4 mini perde: dikey ilerlerken her adım bir sahne kartı olarak öne
gelir (scale 0.94→1 + opacity, scrub), önceki geriye söner. Adım numaraları
Bodoni italik dev (`I. II. III. IV.`). Son adımda satır içi `Ekibe Katıl →`.
Dokunmatik/reduced-motion: sade dikey zaman çizgisi, hepsi görünür.

### Perde VII — SSS "Loca"
Tek kolon zarif program-defteri: ince altın ayraçlar, Bodoni sorular,
Instrument Sans cevaplar; `+` yerine küçük tiyatro yelpazesi açılışı (rotate).
3 grup etiketi (content.ts `group` alanı) Space Mono ara başlıklar. Sakin,
karanlık sahne — final öncesi nefes.

### Perde VIII — Başvuru & İletişim "Davetiye" (FİNAL)
Sayfanın en aydınlık anı: sahne ortasında WebGL altın bilet döner (flat: SVG
bilet + parıltı). Üstünde dev italik Bodoni: `Ekibe Katıl` — linkin ta kendisi
(Google Form). Bilet altında: koordinatör kartları (sade, çerçeve estetiği),
sosyal linkler, KVKK, countdown'ın son görünüşü. Işık huzmesi burada biter —
hikâye: yolculuğun sonunda davetiye senin.

### Son Perde — Footer
İnce altın ufuk çizgisi, AeroMark (fildişi tek renk versiyonu), telif satırı,
`SON PERDE` Space Mono etiketi. Sessiz kapanış.

### Nav
Üstte minimal bar: AeroMark + `PERDE I–VIII` ilerleme noktaları (aktif sahne
amber). Mobil: tam ekran kadife overlay, Bodoni linkler. Sağ kenar FlowRail
kaldırılır — perde noktaları nav'a taşınır.

## Silinecekler / değişecekler (eski kimlik tasfiyesi)

- **Silinir:** FlowField, Starfield, SectionAtmosphere (renk yolculuğu),
  CurrentField, DisciplineWheel, aurora/seam/swirl/flowlines CSS sistemleri,
  teal token seti, Cursor'ın teal glow'u (yenisi: küçük amber spot imleç).
- **Kimliği değişip kalır:** Preloader (perde açılışı: kadife kapak yukarı
  kalkar), MagneticButton (bilet-butona bağlanır), Reveal (yeni easing),
  SmoothScroll/MotionProvider/Countdown (görsel yenilenir), PhotoSlot (müze
  çerçevesi), AeroMark (fildişi/amber tek renk varyant prop'u).
- **`lib/fonts.ts`** yeni üçlüyle yeniden yazılır.
- **`app/globals.css`** yeni token seti + sahne utility'leriyle büyük ölçüde
  yeniden yazılır.
- **CLAUDE.md** marka bölümü güncellenir: yeni palet, yeni fontlar, "tek ışık
  kaynağı" kuralı, hibrit WebGL kuralları, base-JS bütçesi. (content.ts ilkesi,
  transform/opacity kuralı, reduced-motion base kuralı aynen kalır.)
- `lib/content.ts` İÇERİK aynen kalır; sahne etiketleri (`PERDE I` vb.) ve
  yeni mikro-metinler content.ts'e eklenir.

## Build sırası

1. **Kimlik temeli:** yeni fontlar + token seti + globals temizliği; eski teal
   sistemleri söküm. Site bu noktada "yeni dünyada ama sade" — her şey okunur.
2. **Flat sahneler uçtan uca:** Scene primitifi + tüm 8 perde pin'siz/scrub'sız
   statik hali (reduced-motion base'i = bu). Mobil düzenler burada biter.
3. **Scrub koreografisi:** Perde I spot devri, III yatay pan, IV spot tarama,
   VI kart geçişleri — masaüstü pinleri.
4. **WebGL:** useCapability + avize + davetiye (lazy chunk), flat fallback'lerin
   üstüne.
5. **Nav/perde noktaları + Preloader perde açılışı + imleç.**
6. **Perf denetimi:** build (base < 170KB, three ayrı chunk doğrula), Lighthouse
   LCP/CLS, gerçek telefonda yatay şerit + scroll akıcılığı, reduced-motion tam
   tur.

## Riskler + önlem

1. **Pinli sahneler telefonda kırılgan** → telefonda HİÇ pin yok (tasarım
   gereği); her sahnenin native-akış hali birinci sınıf tasarlanır.
2. **three chunk'ı yanlışlıkla First Load'a girer** → `next/dynamic` +
   `ssr:false` + import'un yalnızca capability check SONRASI tetiklenmesi;
   build çıktısında chunk ayrımı denetlenir.
3. **Didone (Bodoni) küçük boyda kırılgan** → Bodoni yalnız display (≥28px);
   gövde/etiket her zaman Instrument Sans / Space Mono.
4. **Bordo-siyah kontrast tuzağı** → tüm metin fildişi ailesinden; muted
   tonlar AA'ya göre seçilir (koyu bordo üstünde test edilir).

## Kabul kriterleri

- Sayfa "kaydırılan yolculuk" gibi hissettiriyor: en az 3 gerçek scrub sahnesi
  (spot devri, yatay salonlar, süreç kartları) masaüstünde çalışıyor.
- Teal/Fraunces/eski sistemlerden TEK piksel iz yok (grep: `#06c3a9`, `#2ec5af`,
  `#43cbf1`, `fraunces`, `hanken` → 0 eşleşme).
- Base First Load < 170KB; three ayrı lazy chunk; telefonda WebGL hiç inmiyor.
- Reduced-motion + dokunmatik: eksiksiz, pin'siz, kendi başına güzel.
- LCP < 2.5s · CLS < 0.1 · tüm metin content.ts'ten · mojibake yok.

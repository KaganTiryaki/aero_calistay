# AERO — Sirkülasyon Çalıştayı '26 · Majestic Landing Page Planı

> **GÜNCELLEME (güncel):** Kurum kimliği **AERO**'dur (`site.school = "AERO"`). Önceki **okul ibaresi** tamamen kaldırıldı. Başlık "Sirkülasyon Çalıştayı '26 — AERO" formatında; birincil iş ekip başvurularını toplamak. Aşağıdaki bölümlerde geçen eski okul/FRC referansları tarihseldir; **güncel gerçek kaynak `lib/content.ts` + `README.md`.** Tasarım yönü (Akıntı, teal→cyan, mouse-reactivity) korunmuştur.

> Tek cümlelik hedef: **Ziyaretçi siteye girer girmez tasarımından çarpılsın.** Landing page'in birincil işi ekip başvurularını toplamak; birincil hissi ise "aşırı majestic" olmak.

Bu dosya; markayı, sanat yönünü, hareket sistemini, bölüm bölüm tasarımı, teknik mimariyi ve yol haritasını tanımlar. Referans kanıt olarak **çalışan, canlı, mouse-reactive hero prototipi** `docs/mockups/hero-prototype/index.html` içinde; ekran görüntüleri `docs/mockups/` altında.

- Masaüstü: [aero-hero-desktop.jpeg](docs/mockups/aero-hero-desktop.jpeg)
- Mobil: [aero-hero-mobile.jpeg](docs/mockups/aero-hero-mobile.jpeg)
- Mouse etkileşimli kare (imleç girdabı + parıltı): [aero-hero-reactive.jpeg](docs/mockups/aero-hero-reactive.jpeg)
- Aşılacak tasarım referansı: [reference-maltepe.jpeg](docs/mockups/reference-maltepe.jpeg)

---

## 0. Özet (TL;DR)

- **Marka:** AERO — bir FRC (FIRST Robotics Competition) takımı. Instagram/TikTok: `@aero_cal`, ayrıca `@aerofrc`. Tek marka; **"Aero Sirkülasyon Çalıştayı '26"** bu takımın etkinliği.
- **Tek büyük fikir:** *Akıntı / Sirkülasyon.* "Aero" (aerodinamik/uçuş = akış) ile çalıştay teması "Sirkülasyon" (fikirlerin dolaşımı = akış) aynı görsel dile çıkıyor. Marka renkleri de zaten bir teal→cyan akıntı. Site bu tek fikri disiplinli biçimde işler.
- **Sanat yönü:** *Akıntı — Sinematik Akış.* Near-black boşlukta canlı teal→cyan parçacık akıntısı, ortada parlayan logo; parçacıklar CTA'ya doğru akar. Film karesi hissi, tek accent, tek easing, film grain. Referansı tam zayıf noktasından geçiyoruz: onlarınki donuk/statik, bizimki *akan* canlı bir sistem.
- **Başvuru yapısı:** Departman **başkanlarının** altına **yardımcı üye** alımı (organizasyon ekibi). Hero CTA → Google Form (link sonradan eklenecek).
- **Teknik:** Next.js 15 (App Router) + Tailwind v4 + `next/font` + `motion` + GSAP/ScrollTrigger + Lenis. Hero: canvas-2D akıntı (mesh-gradient + grain statik fallback). Localhost'ta başlar, sonra Vercel'e deploy.
- **Etkileşim:** Mouse-reactivity birinci sınıf özellik (imleç akıntıyı karıştırır, parıltı bırakır, CTA mıknatıslanır, mesh parallax; FRC kartlarında tilt; bölüm arkalarında imleç-takipli ışık).

---

## 1. Tek Büyük Fikir — "Akıntı / Sirkülasyon"

Majestic siteler tek bir güçlü fikri kusursuz işler; "efekt çorbası" yapmaz. Bizim fikrimiz **sirkülasyon (akış)**:

- **Aero** = aerodinamik, uçuş, hava akımı → akış.
- **Sirkülasyon Çalıştayı** = fikirlerin, bireyin, toplumun ve dünya düzeninin dolaşımı → akış.
- **Robotik ↔ İnsani bilimler köprüsü:** Mühendisin geri-besleme döngüsü (sense → decide → actuate) ile düşünürün "hermeneutik döngüsü" aynı şekildir: başı ve sonu olmayan döngü. Cybernetics (Yun. *kybernetes* = dümenci) kelimesi zaten hem mühendislik hem beşeri bilim kelimesidir; bu, vizyon/misyon metninin dilini besleyebilir.

Bu fikir tüm sitede tek bir görsel motif olarak akar: **teal→cyan bir akıntı.** Hiçbir yerde ikinci bir "büyük efekt" yok.

---

## 2. Marka Sistemi

### 2.1 Renk paleti (logodan ve gönderilerden piksel örneklemesiyle çıkarıldı)

| Rol | Hex | Not |
|---|---|---|
| Void (zemin) | `#05090C` | Neredeyse siyah, hafif teal |
| Void-2 / yüzey | `#070F14` → `#0B1620` | Kart/panel yüzeyleri |
| Hairline / kenarlık | `#16323A` @ %40 | İnce çizgiler |
| **Teal-deep (ana)** | `#06C3A9` | Marka ana teal |
| **Teal** | `#2EC5AF` | Logo teali |
| **Turkuaz** | `#54E3E5` | Parlak vurgu |
| **Cyan (uç)** | `#43CBF1` | Akıntının cyan ucu |
| Metin (birincil) | `#F4F8FA` | Saf beyaz değil |
| Metin (muted) | `#9FB6B4` | Gövde ikincil |
| Metin (label) | `#5E7B78` | Kicker/etiket |

**İmza gradyanı:** `linear-gradient(118deg, #06C3A9, #2EC5AF 45%, #43CBF1)` — CTA, vurgulanan başlık kelimesi, scroll-progress çubuğu, ince ayraçlar ve parçacık tonu bu gradyanı kullanır. Accent tek: teal→cyan. Altın/mor **yok** (markaya yabancı).

**Kural:** Saf `#000`/`#FFF` yok. Zemin katmanlı 3+ near-black + tek ışık kaynağı (logonun arkasında radial glow) + vignette + %4-8 film grain → "flat navy amatör, gradasyonlu karanlık sinematik" görünür.

### 2.2 Tipografi

| Rol | Font | Kullanım |
|---|---|---|
| Display başlık | **Fraunces** (variable serif) | `clamp(3rem, 8.4vw, 7.4rem)`, weight 500, line-height .96, `-0.02em`. Vurgulu kelime italik + gradyan (`background-clip:text`). |
| Gövde / UI | **Inter** | 16–20px, line-height 1.6, max 60–66ch. |
| Kicker / etiket / mono | **IBM Plex Mono** | ALL-CAPS, `letter-spacing .3–.42em` — "SİRKÜLASYON ÇALIŞTAYI · 2026", FRC etiketleri, SSS numaralandırma. |

`next/font` ile **latin + latin-ext subset zorunlu** (İ ı ş ğ ç ö ü için). Türkçe metin İngilizce'den ~%15-20 uzun → başlık/buton genişliklerinde pay bırak.

### 2.3 Logo

- Kaynak: `@aero_cal` profil görseli — teal çizgisel "A" (aerodinamik ok/pusula). Şu an sadece 320×320 raster elimizde; **beyaz zemin şeffaflaştırıldı** → `docs/mockups/hero-prototype/assets/aero-logo.png`.
- **İhtiyaç:** Prodüksiyon için **vektör (SVG) veya yüksek çözünürlüklü şeffaf PNG** logo. (Bkz. §12.)
- Kullanım: Koyu zeminde teal parıltı (`drop-shadow`), yanında `A E R O` wordmark (Inter, letter-spacing .5em).

### 2.4 Ses & ton (Türkçe kopya)

- **Hero/tema:** vakur, aforistik ("Fikirler dolaştıkça hayat bulur.").
- **CTA / SSS / iletişim:** sıcak, samimi "sen" ("Ekibe Katıl", "Aramıza Katıl"). Akranlara resmî "siz" katı/eski durur.
- **Vizyon/Misyon:** kurumsal, kişisel olmayan (`-maktır/-mektir`).
- Tek enerjik `!` idiomatik; üç tanesi amatör. Bölüm etiketleri iyelikli: "Vizyonumuz", "FRC Takımımız", "Bize Ulaşın".

---

## 3. Sanat Yönetimi & "Majestic" İlkeleri

Bunlar tasarımın anayasası; her ekranda uygulanır:

1. **Cesur, editoryal, dev tipografi + acımasız beyaz alan** — en ucuz, en yüksek etkili majestic kaldıracı.
2. **Tek hero motoru** (akıntı) — asla efekt çorbası değil. Bir zor fikir, temiz uygulama.
3. **Katmanlı karanlık** — 3+ near-black + tek ışık kaynağı + vignette + film grain (banding'i öldürür).
4. **Tek accent (teal→cyan) mücevher gibi** — kısıtlama oyunun kendisi. (Referansın flat tek-mavisi tam da ucuz gösteren şey.)
5. **Tek hareket imzası** — her yerde `cubic-bezier(0.16,1,0.3,1)`, 0.6–1.0s reveal, 0.3s micro.
6. **Sinematik açılış** — 1.2s: alan tutuşur → başlık kelime kelime gelir (GSAP SplitText, blur+y-offset) → CTA en son parlar.
7. **Disiplinli parallax (≤%12) + tek imza pin-scrub anı** — over-pinning "takıldı" hissi verir.
8. **Premium boş-durumlar** — gri img kutusu yok; markalı gradyan dolgu + kilitli en-boy oranı + tek shimmer.
9. **prefers-reduced-motion = temel katman** — statik hali BASE olarak kur, hareketi üstüne serp.

### Tasarım referansının tekrarlanmayacak "amatör tell"leri

Donmuş `0+`/`00` sayaç & geri sayım · statik "yıldızları birleştir" takımyıldızı · birbirinin aynı tekdüze kartlar · zıplayan chevron · flat tek-mavi. Her birini bilinçli olarak aşıyoruz (canlı sayaçlar, sürekli akış, ritim çeşitliliği, çizilen scroll çizgisi).

---

## 4. Hareket & Etkileşim Sistemi

**Kütüphane iş bölümü:** GSAP + ScrollTrigger = scroll-konumlu hareket (pin, parallax, SplitText); `motion` (Framer, LazyMotion+`m`) = bileşen-durumu hareketi (reveal, hover, accordion); Lenis = ağırlıklı inertial scroll (GSAP ticker'a bağlı). Aynı transform'a asla iki kütüphane dokunmaz.

### 4.1 Mouse-reactivity (birinci sınıf — senin özel isteğin) ✅

Prototipte çalışan ve build'e taşınacaklar (hepsi `pointer:fine` + reduced-motion kapalı iken):

- **Akıntıyı karıştırma:** İmleç etrafındaki parçacıklara teğetsel girdap + hafif itme kuvveti → suyu karıştırma hissi.
- **Comet parıltısı:** İmleç, hızına göre parlayan teal bir iz bırakır.
- **Mıknatıslı CTA:** İmleç yaklaşınca buton imlece doğru kayar (0.2 kuvvet), yumuşak geri döner.
- **Mesh parallax:** Arka plan ışık meshi imleçle hafifçe kayar (derinlik).

Build'de eklenecekler:
- **FRC foto slotlarında 3D tilt** — imleç takipli hafif eğim + parıltı.
- **Bölüm arkası imleç-takipli ışık** (Vizyon/Misyon'da radial glow imleci izler).
- **Disiplin şeridi:** üstüne gelince ilgili disiplin aydınlanır.
- **İsteğe bağlı özel imleç:** akıntıda "kuvvet" gibi davranan yumuşak teal nokta.

### 4.2 Diğer hareket

- **Lenis** inertial scroll (lerp ~0.08); nav + CTA `lenis.scrollTo()` üzerinden (native #anchor'ı bozar).
- Bölüm girişlerinde **mask/clip-path reveal**; satır satır serif reveal.
- İnce **scroll-progress çubuğu** (imza gradyanı).
- Tek imza **pin-scrub**: "Sirkülasyon" kelimesi/torus motifi.
- **Erişilebilirlik:** reduced-motion → Lenis kapa, scrub'ları dondur, parçacık döngüsünü durdur, sadece opacity; statik mesh+grain hero göster.

---

## 5. Bilgi Mimarisi

Sticky, glass (backdrop-blur) tek yüzey nav — Türk çalıştay siteleri için idiomatik:

```
[AERO logo]      Vizyon · FRC Takımı · SSS · İletişim        [ Ekibe Katıl → ]
```

Sayfa akışı (tek route, tek uzun sayfa):

1. **Hero** — logo + "ekip başvurularımız açıldı!" + Google Form CTA
2. **Vizyon + Misyon**
3. **FRC Takımımız** (foto slot placeholder'ları)
4. **Sıkça Sorulan Sorular**
5. **Bize Ulaşın** (genel koordinatörler — placeholder)
6. **Footer**

---

## 6. Bölüm Bölüm Tasarım Spesifikasyonu

### Nav
Glass sticky bar; scroll'da hafif koyulaşır + üst hairline. Mobilde CTA sabit alt bar ("Ekibe Katıl") opsiyonu.

### 1) Hero  ✅ (prototip hazır)
- Ortada parlayan logo + `AERO` wordmark.
- Mono kicker: `SİRKÜLASYON ÇALIŞTAYI · 2026`.
- Dev serif başlık: *"Fikirler **dolaştıkça** hayat bulur."* (vurgu kelime teal→cyan gradyan italik).
- Alt cümle: disiplinler akıntısı çerçevesi.
- Pill: `● Ekip başvurularımız açıldı`. CTA: `Ekibe Katıl →` (mıknatıslı, parlayan). Altında dürüst not: "Google Formlar üzerinden".
- Alt disiplin şeridi: Sanat · Tarih · Felsefe · Psikoloji · Sosyoloji · Hukuk · İlahiyat.
- Arka plan: canvas akıntı + mesh + grain + vignette. **Geri sayım YOK.**

### 2) Vizyon + Misyon
- Yan yana (masaüstü) / alt alta (mobil), iyelikli etiketli: **Vizyonumuz / Misyonumuz**. 2–4 cümle, kurumsal register.
- Altında **anlamlı sayaç satırı** (0'da donuk değil): `1 FRC Takımı · 7 Disiplin · ∞ Merak`.
- Sakin merkez motifi: dev, şeffaf-outline "sirkülasyon" kelimesi veya torus/yörünge, parallax'ta süzülür. Arka plan tonu navy→hafif teal kayar. İmleç-takipli ışık.

### 3) FRC Takımımız
Robotik-accentli beat (aynı kabuk, aynı teal accent — "iki poster" hissi vermez):
- Eyebrow: `FIRST® ROBOTICS COMPETITION` + tek cümle "FRC nedir?" (çoğu Türk ziyaretçi bilmez).
- Money-shot 21:9 hero slot + alt scrim + caption "Takımımız · 2026 Sezonu".
- Robot/sezon satırı + rol kutucukları: **Mekanik & Tasarım · Yazılım & Kontrol · Medya & Tasarım · Strateji & Sponsorluk**.
- Mono brag-bar: `FRC #____ · 2026 Sezonu · [ödül]` (placeholder).
- Mini-CTA: "Sen de takımda yer al →".
- **Foto slotları:** markalı gradyan dolgu `#0d1b3e→#10275c`, kilitli en-boy (swap'ta CLS yok), soluk mono "Görsel yakında" + köşe-braket motifi, en fazla tek shimmer. Blueprint/izometrik hairline substrat. İmleçle 3D tilt.

### 4) Sıkça Sorulan Sorular
- Başlık tam: "Sıkça Sorulan Sorular".
- Erişilebilir accordion (`<details>`/aria-expanded, grid-rows 0fr→1fr). Cevaplar samimi "sen", kısa/net.
- Açılan öğede sol teal border + mono numaralandırma + teal hairline ayraç. Açılışta "spine" çizgisinde nabız.
- İçerik: bkz. §7.3 (başvuru odaklı set).

### 5) Bize Ulaşın
- Sıcak kapanış — akıntı yavaşlar ve başa döner (sirkülasyon kapanır).
- **Instagram `@aero_cal` / `@aerofrc` belirgin** (Türk öğrenci toplulukları için e-postadan güçlü kanal), e-posta kabul.
- 1–2 isimli **Genel Koordinatör** kartı (placeholder: "Genel Koordinatör: [Ad Soyad] — [e-posta]"). **Danışman Öğretmen** slotu (placeholder) — yokluğu "gayriresmî öğrenci işi" gibi durur; konvansiyonel olarak önce gelir.
- Kişisel telefon numarası yok. Form linki yanında tek satır KVKK/aydınlatma notu.

### Footer
Logo + dev son cümle + `© 2026 AERO. Tüm hakları saklıdır.` + sosyal ikonlar.

---

## 7. İçerik & Metinler (Türkçe kopya taslakları)

### 7.1 Misyonumuz (senin verdiğin metin, düzeltilmiş)
> Misyonumuz, temamız olan sirkülasyonu farklı disiplinlerin ışığında ele alarak katılımcılara derinlikli bir düşünme ve tartışma ortamı sunmaktır. Sanat, Tarih, Felsefe, Psikoloji, Sosyoloji, Hukuk ve İlahiyat gibi alanların sağladığı perspektiflerle; gençlerin bireyin kendisiyle, toplumla ve dünya düzeniyle kurduğu ilişkiyi sorgulamalarını teşvik etmeyi amaçlıyoruz. Bu doğrultuda katılımcıların disiplinler arası düşünme becerilerini geliştirmelerine, farklı bakış açılarıyla karşılaşmalarına ve sirkülasyonu çok boyutlu biçimde değerlendirmelerine olanak sağlarken; muhakeme, müzakere ve eleştirel düşünme becerilerinin gelişimine katkı hedefliyoruz.

### 7.2 Vizyonumuz (senin verdiğin metin, düzeltilmiş)
> Vizyonumuz; gençleri fikir üretmeye teşvik eden, onları kalıpların dışına çıkmaya iten ve farklı bakış açılarını bir araya getirerek zengin bir düşünce ve tartışma ortamı sağlayan bir çalıştay düzenlemektir. Yenilikçi ve ilham verici bir etkinlikle, katılımcıların yalnızca bugünlerine değil geleceklerine de yön veren bir deneyim sunmayı hedefliyoruz. Amacımız; bu çalıştaydan geçen her öğrencinin kendine yeni şeyler katması, sorgulayan, bilinçli, cesur ve üretken bir birey olarak kendi yolunu çizebilmesi ve fark yaratabilmesidir.

### 7.3 SSS taslağı (başvuru odaklı — cevaplar sonra netleşecek)
1. **Kimler başvurabilir?** — [lise/üniversite? yaş aralığı?]
2. **Ön deneyimim yok, yine de başvurabilir miyim?** — Evet; öğrenmeye açık olman yeterli. (STEM'de en çok sorulan; güven verici cevap.)
3. **Hangi ekiplere/birimlere başvurabilirim?** — Başkanların altındaki yardımcı üyelikler: [Organizasyon, Medya & Tasarım, Sponsorluk, ...].
4. **Başvuru ücretli mi?** — [Ücretsiz].
5. **Nasıl başvururum?** — Google Form üzerinden ([süre], birkaç dakika).
6. **Mülakat var mı, süreç nasıl işliyor?** — [Form → mülakat → sonuç].
7. **Sonuçlar nasıl açıklanıyor?** — [E-posta/Instagram].
8. **Ne kadar zaman ayırmam gerekiyor?** — [Haftalık taahhüt].
9. **AERO ve çalıştay tam olarak ne? Ne zaman/nerede?** — [Kısa tanım + tarih/yer].
10. **Katılım belgesi / sertifika var mı?** — [Evet/Hayır].

> `[…]` alanları senden gelecek bilgilerle doldurulacak (bkz. §12).

### 7.4 Konfig / sabitler (tek dosyada — `lib/content.ts`)
`googleFormUrl`, `disciplines[]`, `faqs[]`, `coordinators[]`, `socials{instagram, tiktok, aerofrc, email}`, `frc{teamNumber, season, awards[]}`, `stats[]`. Böylece sonradan tek yerden güncellenir.

---

## 8. Teknik Mimari

### 8.1 Stack
**Next.js 15 (App Router, tek statik route) + Tailwind CSS v4 (@theme, CSS-first) + `next/font` + `next/image`.** Deploy: Vercel.

Minimal bağımlılıklar:
```
next react react-dom
tailwindcss @tailwindcss/postcss
motion            # Framer — LazyMotion + m
gsap              # ScrollTrigger + SplitText (artık tamamen ücretsiz)
lenis
clsx tailwind-merge lucide-react
```
Fontlar `next/font` ile (Fraunces + Inter + IBM Plex Mono, `subsets:['latin','latin-ext']`). Hero **WebGL'siz başlar**: canvas-2D akıntı + CSS mesh-gradient hedefi tutturur ve fallback'tir. R3F/OGL yalnız ileride, hero-only, lazy, opsiyonel upgrade.

### 8.2 Klasör yapısı (öneri)
```
app/
  layout.tsx            # fonts, <html lang="tr">, metadata/OG
  page.tsx              # bölümleri dizer
  globals.css           # Tailwind v4 @theme tokenları (renk/tip/spacing)
components/
  nav/StickyNav.tsx
  hero/Hero.tsx  FlowField.tsx(canvas)  HeroFallback.tsx(mesh+grain)
  sections/VisionMission.tsx  FrcTeam.tsx  Faq.tsx  Contact.tsx
  ui/Cta.tsx  MagneticButton.tsx  Pill.tsx  DisciplineRibbon.tsx
     SectionLabel.tsx  PhotoSlot.tsx  StatCounter.tsx  Accordion.tsx
  motion/SmoothScroll.tsx(Lenis)  Reveal.tsx  useReducedMotion.ts  usePointer.ts
lib/
  content.ts            # tüm Türkçe kopya + konfig
  fonts.ts  cn.ts
public/
  aero-logo.svg (sonra)  og.jpg  frc/*.jpg (sonra)
```
Her bileşen tek sorumluluk, iyi tanımlı arayüz, bağımsız test edilebilir.

### 8.3 Performans bütçeleri
LCP < 2.5s (hero metni HTML-first; canvas/font LCP'yi bloklamaz) · CLS < 0.1 · initial JS < 150KB gzip · sadece `transform`/`opacity` animasyonu · canvas DPR ≤ 1.5, offscreen'de RAF durur (IntersectionObserver/visibilitychange).

---

## 9. Non-Negotiables (Türkçe-UX, Erişilebilirlik, Performans)

- `<meta charset="utf-8">` + her yerde UTF-8. Herhangi bir mojibake (Ã§, ÅŸ, Ä±) = anında güvenilirlik kaybı.
- `<html lang="tr">` — yoksa `text-transform:uppercase` "istanbul"→"ISTANBUL" yapar (doğrusu "İSTANBUL").
- Her font subset'inde **latin-ext** (ı İ ş ğ ç ö ü); yoksa tofu.
- **Mobil-first sert kural:** Türkiye web'inin ~%72'si, lise kitlesinin ~%80+'ı mobil; çoğu Instagram bio/story in-app tarayıcıdan (WKWebView) gelir. 390×844 hero vuruşunu fold üstünde yapmalı, CTA başparmak erişiminde. Başvuru `<a target=_blank>` Instagram in-app tarayıcıda test edilmeli. Yatay scroll asla.
- reduced-motion, keyboard focus, skip-to-content çalışır.

---

## 10. Placeholder Stratejisi (şimdi ne, sonra ne)

| Öğe | Şimdi | Sonra |
|---|---|---|
| Google Form linki | CTA görünür, `#` / "yakında" | Gerçek URL `content.ts`'e |
| FRC fotoğrafları | Markalı gradyan slotlar + "Görsel yakında" | `public/frc/*` |
| Koordinatör bilgisi | "[Ad Soyad] — [e-posta]" kartları | Gerçek isim/e-posta |
| SSS cevapları | Taslak + `[…]` | Netleşen bilgiler |
| Logo | Şeffaflaştırılmış 320px PNG | Vektör SVG |
| FRC takım no/ödüller | `#____` placeholder | Gerçek değerler |

Tüm placeholder'lar **premium** görünür (gri kutu/kırık img yok).

---

## 11. Yol Haritası / Build Fazları

- **Faz 0 — İskele:** Next.js + Tailwind v4 + fontlar + tokenlar + `content.ts` + Lenis provider + reduced-motion altyapısı. (`npm run dev` → localhost)
- **Faz 1 — Hero:** Statik mesh+grain hero (BASE) → canvas akıntı + mouse-reactivity → sinematik açılış (SplitText). *En yüksek "majestic" getirisi burada.*
- **Faz 2 — Nav + Vizyon/Misyon:** Sticky glass nav, iyelikli bölüm, sayaçlar, imleç-takipli ışık.
- **Faz 3 — FRC Takımımız:** Foto slotları (tilt), rol kutucukları, brag-bar, blueprint substrat.
- **Faz 4 — SSS + İletişim + Footer:** Accordion, koordinatör kartları, KVKK notu.
- **Faz 5 — Cila & QA:** Performans (LCP/CLS), a11y, reduced-motion, Türkçe imla geçişi, mobil/Instagram in-app testi.
- **Faz 6 — Deploy:** Vercel (linkler/görseller geldikçe içerik güncellemesi).

---

## 12. Senden İhtiyacım Olan Varlıklar (bloklamaz — placeholder'la ilerleriz)

1. **Vektör/HD şeffaf logo** (SVG tercih).
2. **Google Form URL'i** (hazır olunca).
3. **FRC fotoğrafları** (robot, takım, sezon) — geldikçe slotlara.
4. **Genel Koordinatör isim(ler)i + e-posta**, varsa **Danışman Öğretmen**.
5. **FRC takım numarası**, sezon, ödüller.
6. **SSS gerçek cevapları** (ücret, kimler, süreç, tarih/yer, sertifika).
7. Onay: hero başlık aforizması ("Fikirler dolaştıkça hayat bulur.") böyle mi kalsın?

---

## 13. Açık Kararlar (varsayılanlarla ilerliyorum, itiraz edersen dönerim)

- Tek uzun sayfa (ayrı route yok) — ✅ varsayılan.
- Başlık fontu Fraunces (serif) — istersen geometrik grotesk (Space Grotesk) ile "daha mühendis" varyant deneriz.
- Dil: yalnız Türkçe (İngilizce toggle yok) — ✅ varsayılan.
- Hero aforizması + "dolaştıkça" vurgusu — ✅ varsayılan (onayınla sabitlenir).

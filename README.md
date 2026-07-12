# AERO · Sirkülasyon Çalıştayı '26 — Landing Page

Majestic, tek sayfalık **ekip başvuru** landing page'i. Tasarım yönü: **"Akıntı"** — near-black bir boşlukta teal→cyan canlı bir parçacık akıntısı, mouse-reactive. Tema: **sirkülasyon** (fikirlerin dolaşımı). Tam planlama dokümanı: [`PLAN.md`](PLAN.md).

Landing dışı bölümler tek bir **"derin akıntı"** arka plan sistemi üzerine kurulu: sayfa boyunca yayılan parlayan **yıldız alanı** (canvas), sürüklenen **aurora** ışık şeritleri ve bölüme özel renk **bantları** (aşağı indikçe bir renk yolculuğu).

### Öne çıkan özellikler

- **Preloader** — açılışta wordmark + akıntı-bar dolum animasyonu.
- **Hero geri sayımı** — son başvuru tarihine (`site.applyDeadline`) canlı sayaç.
- **Mobil menü** — hamburger → tam ekran overlay (masaüstünde gizli).
- **Ekip kartları** — Ekiplerimiz'de her ekibin ne yaptığı + görev etiketleri + başkanı görünür kartlar (`Teams`).
- **Disiplin çarkı** — Vizyon & Misyon'da GTA tarzı çark, 7 disiplin dilime bölünmüş (`DisciplineWheel`). İmleçli cihazlarda **tıklama yok**: imleç hangi dilime yakınsa o disiplin yan "notepad"te açılır. Dokunmatik/imleçsiz cihazlarda çark **sabitlenir (sticky)** ve kaydırdıkça aynı yerde 01→07 disiplinleri sırayla gösterip açıklar (scroll-scrub). NB: bu yüzden Vizyon bölümünde `overflow-hidden` yok (sticky'yi bozardı) ve çark `Reveal` ile sarılmaz (transform sticky'yi bozardı).
- **Başvuru Süreci** — Başvur → Değerlendirme → Tanışma → Katılım zaman çizelgesi (`#surec`).
- Scroll progress bar, custom cursor glow, kenar rayları, prefers-reduced-motion desteği.

## Çalıştırma

```bash
npm install
npm run dev      # http://localhost:3000
```

Prodüksiyon:

```bash
npm run build && npm start
```

> Windows'ta "port 3000 in use" derse, eski `next dev` süreçlerini kapat:
> `Get-NetTCPConnection -LocalPort 3000 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }`

## Teknoloji

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS v4** (CSS-first `@theme` tokenları → `app/globals.css`)
- **motion** (Framer) — reveal / intro animasyonları
- **Lenis** — inertial smooth scroll (touch & reduced-motion'da kapalı)
- **next/font** — Fraunces + Hanken Grotesk + IBM Plex Mono (`latin-ext` = Türkçe glifler)
- Hero akıntısı: bağımsız **canvas-2D** (WebGL yok) — mesh-gradient + grain statik fallback

## İçeriği güncelleme (tek dosya)

Tüm metinler ve ayarlar **[`lib/content.ts`](lib/content.ts)** içinde. Bileşenlere dokunmadan:

| Ne | Nerede (`lib/content.ts`) |
|---|---|
| **Okul / çalıştay adı, yıl** | `site.school`, `site.event`, `site.year`, `site.navMark` |
| **Google Form linki** | `site.applyUrl` (boşken CTA'lar pasif placeholder) |
| **Son başvuru tarihi (geri sayım)** | `site.applyDeadline` (ISO; geçerli & gelecekteyse hero'da sayaç, boş/geçmişse gizli) |
| **Sosyal (Instagram · TikTok · e-posta)** | `site.socials` (IG + TikTok bağlı; e-posta boşsa satırı gizli) |
| Vizyon / Misyon metni | `vision.body` / `mission.body` |
| **Ekipler + başkanlar** | `teams.committees` (`lead` = başkan · `blurb` + `tasks[]` = explorer detayında) |
| **Başvuru süreci adımları** | `process.steps[]` (`#surec` zaman çizelgesi) |
| SSS soru-cevapları | `faqs[]` (`[…]` yerlerini doldur) |
| Koordinatör / danışman | `contact.coordinators`, `contact.advisor` |
| Disiplinler (çark + notlar) | `disciplines[]` (`name` = dilim etiketi · `note` = seçilince çıkan açıklama) |
| Navigasyon linkleri | `nav.links[]` |

**Ekip / grup fotoğrafı:** Ekiplerimiz artık fotoğrafsız, içerik odaklı **explorer** (boş foto kutuları yok). Görseller geldiğinde `PhotoSlot` (`components/ui/PhotoSlot.tsx`) explorer detay paneline / başkan avatarına eklenebilir — en-boy oranı kilitli, layout kaymaz. (`*` = şu an kullanılmıyor, hazır duruyor.)

**Logo/favicon:** şu an genel bir teal "sirkülasyon halkası" (`app/icon.svg`). Çalıştayın kendi logosu gelince değiştirilir.

## Yapı

```
app/            layout (fontlar, metadata, Preloader), page (bölümleri dizer), globals.css, icon.svg
components/
  hero/         Hero + FlowField (akıntı) + Countdown
  sections/     VisionMission (editorial + çark) · Teams (kart grid) · Process (Süreç) · Faq · Contact
  nav/          StickyNav (+ mobil hamburger menü)
  layout/       Footer · SiteBackground (derin akıntı) · SideRails
  ui/           Cta · MagneticButton · PhotoSlot* · SectionHeader · SectionAtmosphere · DisciplineWheel · CurrentField (Ekiplerimiz akıntı arka planı)
  motion/       SmoothScroll (Lenis) · Reveal · Preloader · Starfield · Cursor · ScrollProgress
lib/            content.ts (tüm kopya) · fonts.ts · scroll.ts · cn.ts · useScrollLock.ts
docs/           PLAN.md görselleri + build-shots
```

## Bölüm sırası & arka plan bantları

`Hero → Vizyon (01, cool) → Ekiplerimiz (02, deep + swirl) → Süreç (03, flux) → SSS (04, calm) → İletişim (05, warm) → Footer (rise)`. Her bölümün tonu `SectionAtmosphere`'de tanımlı; `SiteBackground` global yıldız alanı + aurora'yı sağlar.

## Deploy (Vercel)

`vercel` veya GitHub'a push + Vercel bağla. Ek yapılandırma gerekmez.

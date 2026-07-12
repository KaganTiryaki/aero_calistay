# AERO · Sirkülasyon Çalıştayı '26 — Landing

Tek sayfalık, Türkçe, "ekip başvurusu" toplayan majestic landing. Tasarım yönü
**"Akıntı"** (teal→cyan sirkülasyon). Tam planlama: `PLAN.md`. Bu dosya = Claude
Code'un her oturumda uyması gereken kurallar.

## İçerik & metin

- **Tüm metin ve ayar `lib/content.ts` içinde.** Bileşenlere ASLA hardcode metin,
  isim, tarih, link yazma — hepsi `content.ts`'ten prop/import ile gelir.
- Yeni bölüm/alan gerekirse önce `content.ts`'e ekle, sonra bileşende kullan.
- Türkçe imla: mojibake yok (Ã§/ÅŸ/Ä± = anında güvensizlik). Enerjik tek `!` yeter.

## Marka & tasarım (değişmez)

- **Tek accent: teal→cyan gradyan** `linear-gradient(118deg,#06C3A9,#2EC5AF 45%,#43CBF1)`.
  Altın/mor YOK. İkinci bir "büyük efekt" YOK.
- **Saf `#000` / `#fff` YOK.** Zemin katmanlı near-black + tek ışık kaynağı + vignette + film grain.
- Tek hareket imzası: `cubic-bezier(0.16,1,0.3,1)`, ~0.6–0.8s reveal.
- Tipografi: Fraunces (display) · Hanken Grotesk (gövde/UI) · IBM Plex Mono (kicker/etiket).

## Hareket & performans (sıkı)

- **Sadece `transform` ve `opacity` animasyonu.** Layout/`top`/`left` animasyonu yok
  (Cursor gibi istisnalar zaten `pointer:fine` kapılı).
- Yeni canvas / `requestAnimationFrame` eklersen ZORUNLU: DPR cap · ekran dışında
  `IntersectionObserver` + `visibilitychange` ile duraklat · `prefers-reduced-motion`
  ve `pointer:coarse` (dokunmatik) altında statik/kapalı base katman.
- reduced-motion **base katmandır**, sonradan eklenen değil: önce statik hali kur.
- Aynı transform'a iki kütüphane dokunmaz (motion vs Lenis vs canvas ayrı işler).

## Fontlar (Türkçe)

- Her `next/font` çağrısında subset **`["latin","latin-ext"]`** (İ ı ş ğ ç ö ü). Yoksa tofu.

## Teknik

- Next.js 15 App Router + TypeScript + Tailwind CSS v4 (`@theme`, CSS-first → `app/globals.css`).
- Framer: `motion/react`. Tek reveal imzası `components/motion/Reveal.tsx` üzerinden.
- Smooth scroll: Lenis (`SmoothScroll`), touch & reduced-motion'da kapalı. Nav/CTA
  scroll'u `window.__lenis?.scrollTo()` ile (native #anchor Lenis'i bozar).
- Performans bütçesi: LCP < 2.5s · CLS < 0.1 · initial JS < 150KB gzip.

## Bölüm sistemi

Sıra: `Hero → Vizyon(01) → Ekiplerimiz(02) → Ekibimiz → Süreç(03) → SSS(04) → İletişim(05) → Footer`.
Her bölümün tonu `components/ui/SectionAtmosphere.tsx`'te; global yıldız/aurora `SiteBackground`.
Yeni bölüm eklerken sırayı, atmosfer tonunu ve `nav.links`'i birlikte güncelle.

## Çalıştırma

```bash
npm run dev      # http://localhost:3000
npm run build    # prod build — First Load JS'i kontrol et (<150KB hedefi)
```

## İş akışı

- Görsel ince ayar → ekran görüntüsü yapıştır + "bunu düzelt" (en verimli döngü).
- Çok dosyaya dokunan yapısal değişiklik → önce plan modu.
- Değişiklikleri otomatik commit + push (main → GitHub → Vercel). Ayrı "pushla" bekleme.

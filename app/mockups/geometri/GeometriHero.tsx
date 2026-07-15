"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { site, hero, nav } from "@/lib/content";
import s from "./geometri.module.css";

/* Türkçe için latin-ext şart (İ ı ş ğ ç ö ü). display:"block" → devasa tipografi
   fallback fontla ölçülüp textLength ile sıkışmasın; yüklenince tek karede gelir. */
const display = Archivo({
  subsets: ["latin", "latin-ext"],
  display: "block",
  variable: "--geo-display",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--geo-mono",
});

/** Deterministik Türkçe büyütme. toLocaleUpperCase("tr") ICU'ya bağlı → server/client
 *  ayrışabilir; bu saf string dönüşümü hydration'da asla kaymaz. */
function trUpper(input: string): string {
  return input.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}

/* --- içerik: hepsi lib/content.ts'ten türetilir --------------------------- */
const eventWords = site.event.split(" ");
const WORD_TOP = trUpper(eventWords[0] ?? site.event); // SİRKÜLASYON
const WORD_BOTTOM = trUpper(eventWords.slice(1).join(" ")); // ÇALIŞTAYI

/* --- poster koordinat sistemi (viewBox birimi, 1024 geniş) ----------------
   Her bant, aynı kelimenin farklı bir y-penceresi. textLength kelimeyi her
   viewport'ta tam olarak kenardan kenara oturtur → "Swiss" hizası şansa kalmaz.

   Sabitler TAHMİN DEĞİL: Archivo 900 tarayıcıda canvas'a çizilip piksel
   satırları taranarak ölçüldü (getBBox satır kutusunu verir, mürekkebi değil).
   Baseline = 0. Ölçülen mürekkep segmentleri:
     SİRKÜLASYON @132 → genişlik 1002.4 · [-117,-99] noktalar · [-93,+1] gövde
     ÇALIŞTAYI   @113 → genişlik  621.6 · [-79,+23]  (Ç/Ş sedilleri)
     '26         @113 → genişlik  172.0 · [-79,+1]
   size'lar textLength'in düzeltmesi <%0.3 kalacak şekilde seçildi → glif
   bozulması yok. Font veya metin değişirse bu sabitler YENİDEN ÖLÇÜLMELİ.

   cuts = bant sınırları (eşit dilim DEĞİL, bilinçli):
   ROW1'in ilk kesiği -96 → noktaların bittiği (-99) ve kapitallerin başladığı
   (-93) boşluğun tam ortası. Yani 1. bant sadece Türkçe aksanları taşır:
   beyaz bir "nokta rafı". İmleçle bu bant en çok kayan bant → noktalar
   harflerinden ayrılıp sirküle eder, dururken tam yerine oturur. */
const VB = 1024;
const EDGE = 12;

/** Satır 1: SİRKÜLASYON — tam genişlik (1000/1024). */
const ROW1 = { size: 132, track: -0.042, len: 1000, cuts: [-124, -96, -43, 10] };
/** Satır 2: '26 (sola dayalı) + ÇALIŞTAYI (sağa dayalı, %60 genişlik). */
const ROW2 = { size: 113, track: -0.03, len: 620, cuts: [-90, -51, -12, 30] };

type Band = {
  row: 1 | 2;
  slice: number;
  bg: string;
  ink: string;
  from: -1 | 1;
  amp: string;
  k: string;
  dur: string;
};

/* Renk merdiveni: beyaz → nane → koyu teal · nane → cyan → koyu teal.
   Her kelimenin "ayağı" koyu teal → gradyan değil, ritim.

   amp = ambient sürüklenme (nefes), k = imleç katsayısı.
   Kural: DURGUN HALDE POSTER KESKİN OKUNMALI. Ambient birkaç px'i geçmez;
   asıl kayma (sirkülasyon) imleçle gelir. Süreler asal-benzeri → bantlar
   birbirine asla senkron olmaz. */
const BANDS: Band[] = [
  { row: 1, slice: 0, bg: "#ffffff", ink: "#0e4a46", from: -1, amp: "0.26vw", k: "1.15", dur: "11s" },
  { row: 1, slice: 1, bg: "#5fe0bc", ink: "#0e4a46", from: 1, amp: "-0.17vw", k: "-0.62", dur: "13s" },
  { row: 1, slice: 2, bg: "#0e4a46", ink: "#ffffff", from: -1, amp: "0.09vw", k: "0.34", dur: "9s" },
  { row: 2, slice: 0, bg: "#43d6a8", ink: "#0e4a46", from: 1, amp: "-0.22vw", k: "-0.85", dur: "12s" },
  { row: 2, slice: 1, bg: "#22b8dc", ink: "#0e4a46", from: -1, amp: "0.15vw", k: "0.5", dur: "10s" },
  { row: 2, slice: 2, bg: "#0e4a46", ink: "#5fe0bc", from: 1, amp: "-0.07vw", k: "-0.3", dur: "14s" },
];

/* Hız çizgileri kanadın KENDİ koordinat sisteminde (viewBox -120 0 240 120).
   Üçgenin hipotenüsü x + y = 120 doğrusu; her çizginin sağ ucu 117 - y'de,
   yani hipotenüsün 3 birim solunda bitiyor → çizgiler kanadın hücum kenarından
   sıyrılıyor gibi duruyor. Ayrı ayrı yüzen yatay çizgiler "ikon" gibi
   okunuyordu; hipotenüse kenetlenince iz oluyor. [y, x1, x2] */
const SPEED_LINES: Array<[number, number, number]> = [
  [16, -100, 101],
  [32, -30, 85],
  [48, -115, 69],
  [64, -70, 53],
  [80, -15, 37],
];

function BandSlice({ band }: { band: Band }) {
  const cfg = band.row === 1 ? ROW1 : ROW2;
  const y = cfg.cuts[band.slice];
  const sliceH = cfg.cuts[band.slice + 1] - y;

  return (
    <svg
      className={s.svg}
      viewBox={`0 ${y} ${VB} ${sliceH}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {band.row === 1 ? (
        <text
          className={s.glyph}
          x={VB / 2}
          y={0}
          textAnchor="middle"
          textLength={ROW1.len}
          lengthAdjust="spacingAndGlyphs"
          fontSize={ROW1.size}
          letterSpacing={ROW1.size * ROW1.track}
          fill={band.ink}
        >
          {WORD_TOP}
        </text>
      ) : (
        <>
          <text
            className={s.glyph}
            x={EDGE}
            y={0}
            textAnchor="start"
            fontSize={ROW2.size}
            letterSpacing={ROW2.size * ROW2.track}
            fill={band.ink}
          >
            {site.year}
          </text>
          <text
            className={s.glyph}
            x={VB - EDGE}
            y={0}
            textAnchor="end"
            textLength={ROW2.len}
            lengthAdjust="spacingAndGlyphs"
            fontSize={ROW2.size}
            letterSpacing={ROW2.size * ROW2.track}
            fill={band.ink}
          >
            {WORD_BOTTOM}
          </text>
        </>
      )}
    </svg>
  );
}

export function GeometriHero() {
  const rootRef = useRef<HTMLElement>(null);

  /* Pointer shear: bantlar imlece farklı katsayılarla kayar → kelime "sirküle"
     eder. Sadece --mx/--my custom property yazılır; layout okuması yok. */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const fine = window.matchMedia("(pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduce.matches) return;

    let rect = el.getBoundingClientRect();
    let raf = 0;
    let running = false;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    const tick = () => {
      current.x += (target.x - current.x) * 0.09;
      current.y += (target.y - current.y) * 0.09;
      el.style.setProperty("--mx", `${current.x.toFixed(2)}px`);
      el.style.setProperty("--my", `${current.y.toFixed(2)}px`);

      if (
        Math.abs(target.x - current.x) > 0.05 ||
        Math.abs(target.y - current.y) > 0.05
      ) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
        raf = 0;
      }
    };

    const start = () => {
      if (running || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      // ±17px: bant 1 (k=1.15) en çok ~20px kayar, bant 2 ters yönde ~-10px →
      // noktalar harflerinden en fazla ~30px ayrılır. Daha fazlası "bozuk"
      // görünüyor: nokta kendi harfini terk edip yandakinin üstüne çıkıyor.
      target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 34;
      target.y = ((e.clientY - rect.top) / rect.height - 0.5) * 28; // ±14px
      start();
    };

    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      start();
    };

    const onResize = () => {
      rect = el.getBoundingClientRect();
    };

    const onVisibility = () => {
      if (!document.hidden) return;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      running = false;
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* Ekran dışına çıkınca ambient CSS animasyonlarını duraklat. */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry) el.classList.toggle(s.paused, !entry.isIntersecting);
      },
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const navItems = nav.links.map((link, i) => (
    <a key={link.href} className={s.navLink} href={link.href}>
      <span className={s.navNum}>{String(i + 1).padStart(2, "0")}</span>
      <span className={s.navLabel}>{link.label}</span>
    </a>
  ));

  return (
    <main
      ref={rootRef}
      className={`${s.hero} ${display.variable} ${mono.variable}`}
    >
      <h1 className={s.srOnly}>{`${site.school} ${site.event} ${site.year} — ${hero.status}`}</h1>

      <div className={s.grid} aria-hidden="true" />

      <header className={s.header}>
        <a className={s.brand} href="#">
          <svg className={s.mark} viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="16" fill="#ffffff" />
            <path
              fillRule="evenodd"
              d="M16 6.5 L27 26 L5 26 Z M16 14.2 L21.4 23.4 L10.6 23.4 Z"
              fill="#0e4a46"
            />
          </svg>
          <span className={s.brandName}>{site.school}</span>
        </a>

        <nav className={s.nav} aria-label="Bölümler">
          {navItems}
        </nav>
      </header>

      <div className={s.mid}>
        <div className={s.geo} aria-hidden="true">
          <div className={s.circleWrap}>
            <svg className={s.circle} viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="99" fill="none" stroke="#0e4a46" strokeWidth="1.1" />
              <circle
                cx="100"
                cy="100"
                r="61"
                fill="none"
                stroke="#0e4a46"
                strokeWidth="1.1"
                strokeDasharray="2 7"
              />
            </svg>
            <div className={s.orbit}>
              <span className={s.orbitSq} />
            </div>
          </div>

          <svg className={s.wing} viewBox="-120 0 240 120">
            <polygon points="120,0 120,120 0,120" fill="#43d6a8" />
            <g fill="#0a1a1c">
              {SPEED_LINES.map(([y, x1, x2]) => (
                <rect key={y} x={x1} y={y} width={x2 - x1} height="1.2" />
              ))}
            </g>
          </svg>
        </div>

        <div className={s.midRow}>
          <p className={s.status}>
            <span className={s.statusSq} />
            {trUpper(hero.status)}
          </p>

          <nav className={s.navMobile} aria-label="Bölümler">
            {navItems}
          </nav>
        </div>
      </div>

      <div className={s.type}>
        {BANDS.map((band, i) => (
          <div
            key={`${band.row}-${band.slice}`}
            className={s.band}
            style={
              {
                background: band.bg,
                "--i": String(i),
                "--from": String(band.from),
              } as CSSProperties
            }
          >
            <div className={s.bandInner}>
              <div
                className={s.drift}
                style={
                  {
                    "--a": band.amp,
                    "--dur": band.dur,
                    "--i": String(i),
                    "--k": band.k,
                  } as CSSProperties
                }
              >
                <BandSlice band={band} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <footer className={s.footer}>
        <span className={s.handle}>{site.socials.instagramHandle}</span>
        <div className={s.footerRight}>
          <span className={s.note}>{hero.ctaNote}</span>
          <a
            className={s.cta}
            href={site.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={s.ctaFill} aria-hidden="true" />
            <span className={s.ctaText}>{hero.cta}</span>
            <svg className={s.ctaArrow} viewBox="0 0 10 12" aria-hidden="true">
              <polygon points="0,0 10,6 0,12" fill="currentColor" />
            </svg>
          </a>
        </div>
      </footer>
    </main>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { site, hero, nav } from "@/lib/content";
import s from "./pop.module.css";

/* ==========================================================================
   POP ŞOK — 3D Pop Kinetik hero.
   Dev kelime, DOM'da üst üste yığılmış N kopyadan oluşan GERÇEK bir 3B
   nesnedir (preserve-3d + translateZ). Ön yüz beyaz, derinlik nane→teal.
   Pointer nesneyi döndürür; tüm hareket transform/opacity.
   ========================================================================== */

/* ---------------------------------------------------- Türkçe büyük harf
   `text-transform: uppercase` ve `toLocaleUpperCase` ICU/lang'a bağlıdır;
   sunucu ile istemci ayrışırsa hydration patlar. Sabit tablo = deterministik. */
const TR_UPPER: Record<string, string> = {
  i: "İ",
  ı: "I",
  ş: "Ş",
  ğ: "Ğ",
  ç: "Ç",
  ö: "Ö",
  ü: "Ü",
};

function trUpper(input: string): string {
  return Array.from(input)
    .map((ch) => TR_UPPER[ch] ?? ch.toUpperCase())
    .join("");
}

/* ------------------------------------------------- extrude renk rampası */

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const ch = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`;
}

const DEPTH = 26;

/** Katman 0 = ön yüze en yakın (nane ışığı) → katman N = dip (koyu teal). */
const EXTRUDE_COLORS: string[] = Array.from({ length: DEPTH }, (_, i) => {
  const t = i / (DEPTH - 1);
  if (t < 0.1) return "#5FE0BC"; // ön yüzün hemen altındaki ışıklı kenar
  return lerpHex("#43D6A8", "#0E4A46", (t - 0.1) / 0.9);
});

/* ------------------------------------------------------ speed-line burst
   Açı/yarıçap indeksten türetilir → Math.random yok, koordinatlar
   yuvarlanır → sunucu/istemci birebir aynı markup. */

const round2 = (n: number) => Math.round(n * 100) / 100;

type Ray = { d: string; o: number };

function buildRays(count: number, outer: number, offset: number): Ray[] {
  return Array.from({ length: count }, (_, i) => {
    const a = ((i + offset) / count) * Math.PI * 2;
    const spread = (0.009 + ((i * 7) % 5) * 0.0044) * Math.PI;
    const r0 = 30 + ((i * 13) % 9) * 2.4;
    const p = (r: number, ang: number) =>
      `${round2(Math.cos(ang) * r)} ${round2(Math.sin(ang) * r)}`;
    return {
      d: `M ${p(r0, a)} L ${p(outer, a - spread)} L ${p(outer, a + spread)} Z`,
      o: round2(0.05 + ((i * 17) % 6) * 0.019),
    };
  });
}

const INK_RAYS = buildRays(40, 168, 0);
const LIGHT_RAYS = buildRays(24, 168, 0.5);

/* --------------------------------------------------- dekoratif nesneler */

/** `sm: false` → dar ekranda gizlenir (kalabalık kelimeyi eziyor). */
type Shard = {
  x: string;
  y: string;
  size: number;
  rot: number;
  dur: number;
  delay: number;
  fill: string;
  sm?: boolean;
};

const SHARDS: Shard[] = [
  { x: "5%", y: "24%", size: 64, rot: -16, dur: 11, delay: 0, fill: "#43D6A8", sm: true },
  { x: "89%", y: "18%", size: 46, rot: 24, dur: 13, delay: 1.4, fill: "#5FE0BC", sm: true },
  { x: "12%", y: "70%", size: 40, rot: 8, dur: 9.5, delay: 2.1, fill: "#5FE0BC" },
  { x: "84%", y: "66%", size: 58, rot: -30, dur: 12.5, delay: 0.7, fill: "#43D6A8" },
  { x: "22%", y: "12%", size: 28, rot: 44, dur: 10, delay: 3, fill: "#5FE0BC", sm: true },
  { x: "74%", y: "80%", size: 32, rot: -8, dur: 14, delay: 1.9, fill: "#43D6A8", sm: true },
  { x: "3%", y: "54%", size: 24, rot: 62, dur: 8.5, delay: 2.6, fill: "#43D6A8" },
];

type Sparkle = {
  x: string;
  y: string;
  size: number;
  dur: number;
  delay: number;
  fill: string;
  sm?: boolean;
};

const SPARKLES: Sparkle[] = [
  { x: "17%", y: "32%", size: 34, dur: 4.2, delay: 0, fill: "#FFFFFF", sm: true },
  { x: "82%", y: "38%", size: 46, dur: 5, delay: 0.9, fill: "#FFFFFF", sm: true },
  { x: "29%", y: "74%", size: 26, dur: 3.6, delay: 1.8, fill: "#FFFFFF" },
  { x: "70%", y: "26%", size: 22, dur: 4.6, delay: 2.4, fill: "#0E4A46" },
  { x: "45%", y: "13%", size: 24, dur: 5.4, delay: 1.3, fill: "#FFFFFF", sm: true },
  { x: "60%", y: "82%", size: 30, dur: 4, delay: 0.4, fill: "#FFFFFF", sm: true },
  { x: "8%", y: "42%", size: 18, dur: 3.4, delay: 3.1, fill: "#0E4A46" },
];

/** Klasik 4 uçlu pop ışıltısı. */
const SPARKLE_PATH =
  "M50 4 C56 34 66 44 96 50 C66 56 56 66 50 96 C44 66 34 56 4 50 C34 44 44 34 50 4 Z";

/* ------------------------------------------------------------- içerik */

const [EVENT_A, EVENT_B] = site.event.split(" ");
const BIG = trUpper(EVENT_A); // SİRKÜLASYON
const SUB = trUpper(EVENT_B); // ÇALIŞTAYI
const MARQUEE_ITEMS = [
  `${site.event} ${site.year}`,
  site.school,
  hero.status,
  site.socials.instagramHandle,
];

export function PopHero() {
  const tiltRef = useRef<HTMLDivElement>(null);

  /* Pointer parallax: 3B nesneyi fareyle döndür.
     - pointer:fine + reduced-motion kapalı değilse HİÇ bağlanmaz (base = statik)
     - rAF yalnızca hareket varken döner, yakınsayınca kendini durdurur
     - sekme gizlenince durur */
  useEffect(() => {
    const el = tiltRef.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const tick = () => {
      raf = 0;
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      el.style.setProperty("--mx", cx.toFixed(4));
      el.style.setProperty("--my", cy.toFixed(4));
      if (Math.abs(tx - cx) > 0.0008 || Math.abs(ty - cy) > 0.0008) start();
    };

    const start = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      start();
    };

    const onLeave = () => {
      tx = 0;
      ty = 0;
      start();
    };

    const onVisibility = () => {
      if (document.hidden && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        start();
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <section className={s.stage} aria-label={`${site.school} ${site.event} ${site.year}`}>
      {/* ---------------------------------------------------- atmosfer */}
      <div className={s.bg} aria-hidden>
        <div className={s.burst}>
          <svg
            className={`${s.burstSpin} ${s.burstSpinAlt}`}
            viewBox="-168 -168 336 336"
            style={{ position: "absolute", inset: 0 }}
          >
            {LIGHT_RAYS.map((r, i) => (
              <path key={i} className={s.burstLight} d={r.d} opacity={round2(r.o * 1.4)} />
            ))}
          </svg>
          <svg className={s.burstSpin} viewBox="-168 -168 336 336">
            {INK_RAYS.map((r, i) => (
              <path key={i} className={s.burstInk} d={r.d} opacity={r.o} />
            ))}
          </svg>
        </div>

        <div className={s.glow} />
        <div className={s.halftone} />

        {SHARDS.map((sh, i) => (
          <svg
            key={i}
            className={`${s.shard} ${sh.sm ? "" : s.hideSm}`}
            viewBox="0 0 100 100"
            style={
              {
                left: sh.x,
                top: sh.y,
                "--sz": sh.size,
                "--rot": `${sh.rot}deg`,
                "--dur": `${sh.dur}s`,
                "--delay": `${sh.delay}s`,
                transform: `rotate(${sh.rot}deg)`,
              } as React.CSSProperties
            }
          >
            <polygon
              points="50,6 95,90 5,90"
              fill={sh.fill}
              stroke="#0A1A1C"
              strokeWidth="7"
              strokeLinejoin="round"
            />
          </svg>
        ))}

        {SPARKLES.map((sp, i) => (
          <div
            key={i}
            className={`${s.sparkle} ${sp.sm ? "" : s.hideSm}`}
            style={
              {
                left: sp.x,
                top: sp.y,
                "--sz": sp.size,
                "--dur": `${sp.dur}s`,
                "--delay": `${sp.delay}s`,
              } as React.CSSProperties
            }
          >
            <svg className={s.sparkleStar} viewBox="0 0 100 100">
              <path d={SPARKLE_PATH} fill={sp.fill} />
            </svg>
          </div>
        ))}

        <div className={s.vignette} />
        <div className={s.grain} />
      </div>

      {/* -------------------------------------------------------- nav */}
      <header className={s.nav}>
        <a className={`${s.mark} ${s.reveal}`} href="#" aria-label={site.school}>
          <span className={s.markDisc}>{site.school}</span>
          <span className={s.markText}>{site.navMark}</span>
        </a>

        <nav
          className={`${s.navLinks} ${s.reveal}`}
          style={{ "--rd": "0.06s" } as React.CSSProperties}
          aria-label="Bölümler"
        >
          {nav.links.map((l) => (
            <a key={l.href} className={s.navLink} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <a
          className={`${s.cta} ${s.reveal}`}
          href={nav.cta.href}
          style={{ "--rd": "0.12s" } as React.CSSProperties}
        >
          <span className={s.ctaShadow} aria-hidden />
          <span className={s.ctaFace} style={{ fontSize: "clamp(0.8rem, 1vw, 1rem)" }}>
            {nav.cta.label}
          </span>
        </a>
      </header>

      {/* ------------------------------------------------------ merkez */}
      <main className={s.center}>
        <p className={`${s.status} ${s.reveal}`}>
          <span className={s.statusDot} aria-hidden />
          {hero.status}
        </p>

        <div className={`${s.wordScene} ${s.revealWord}`}>
          <div className={s.wordSway}>
            <div className={s.wordTilt} ref={tiltRef}>
              <h1 className={s.word}>
                {/* derinlik: aynı kelimenin Z'de geriye kaymış kopyaları */}
                {EXTRUDE_COLORS.map((c, i) => (
                  <span
                    key={i}
                    className={s.layer}
                    aria-hidden
                    style={
                      { "--i": i + 1, "--layerColor": c } as React.CSSProperties
                    }
                  >
                    {BIG}
                  </span>
                ))}
                {/* ön yüz — erişilebilir metin yalnızca burada */}
                <span className={s.face}>{BIG}</span>
              </h1>
            </div>
          </div>
        </div>

        <p
          className={`${s.band} ${s.reveal}`}
          style={{ "--rd": "0.3s" } as React.CSSProperties}
        >
          <span>{SUB}</span>
          <span className={s.bandYear}>{site.year}</span>
        </p>

        <div
          className={`${s.actions} ${s.reveal}`}
          style={{ "--rd": "0.4s" } as React.CSSProperties}
        >
          <a
            className={s.cta}
            href={site.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={s.ctaShadow} aria-hidden />
            <span className={s.ctaFace}>
              {hero.cta}
              <svg
                className={s.ctaArrow}
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M4 12h15M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </a>
          <span className={s.note}>{hero.ctaNote}</span>
        </div>
      </main>

      {/* ----------------------------------------------------- marquee */}
      <footer className={s.marquee} aria-hidden>
        <div className={s.marqueeTrack}>
          {[0, 1].map((dup) => (
            <div className={s.marqueeGroup} key={dup}>
              {Array.from({ length: 6 }, (_, k) =>
                MARQUEE_ITEMS.map((t) => (
                  <span className={s.marqueeItem} key={`${dup}-${k}-${t}`}>
                    {t}
                    <i className={s.marqueeDiamond} />
                  </span>
                )),
              )}
            </div>
          ))}
        </div>
      </footer>
    </section>
  );
}

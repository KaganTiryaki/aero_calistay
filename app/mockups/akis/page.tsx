import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Archivo, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

import { hero, nav, site } from "@/lib/content";
import FlowField from "./FlowField";
import s from "./akis.module.css";

/* Türkçe için latin-ext şart: İ ı ş ğ ç ö ü */
const display = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  display: "swap",
  variable: "--akis-display",
});

const body = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--akis-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--akis-mono",
});

export const metadata: Metadata = {
  title: `${site.event} ${site.year} — Akış`,
};

/**
 * Türkçe büyük harf. toLocaleUpperCase("tr") ICU'ya bağımlı olduğu için
 * sunucu/istemci arasında ayrışıp hydration mismatch üretebilir; eşleme
 * elle yapılıyor: i -> İ, ı -> I. Sonuç her ortamda birebir aynı.
 */
const trUpper = (value: string) => value.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();

const [eventLead, ...eventRest] = site.event.split(" ");
const headline = trUpper(eventLead); // SİRKÜLASYON
const subline = trUpper(eventRest.join(" ")); // ÇALIŞTAYI

type GlyphsProps = {
  text: string;
  className: string;
  glyphClassName: string;
  step: number;
};

function Glyphs({ text, className, glyphClassName, step }: GlyphsProps) {
  return (
    <span className={className} aria-hidden="true">
      {Array.from(text).map((char, i) => {
        const isSpace = char === " ";
        return (
          <span
            key={`${char}-${i}`}
            className={glyphClassName}
            data-flow={isSpace ? undefined : "glyph"}
            style={{ "--i": i * step } as CSSProperties}
          >
            {isSpace ? " " : char}
          </span>
        );
      })}
    </span>
  );
}

function AeroMark() {
  /* Sirkülasyon işareti: iki eş merkezli, kesikli halka.
     dasharray = çevre / 2 pay ile bölünmüş (r=11 -> 69.115, r=5.4 -> 33.929) */
  return (
    <svg className={s.discMark} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle
        cx="20"
        cy="20"
        r="11"
        stroke="#0E4A46"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="24.3 10.257"
        transform="rotate(-32 20 20)"
      />
      <circle
        cx="20"
        cy="20"
        r="5.4"
        stroke="#0E4A46"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="11.9 5.065"
        transform="rotate(58 20 20)"
      />
    </svg>
  );
}

export default function AkisPage() {
  return (
    <main className={`${s.page} ${display.variable} ${body.variable} ${mono.variable}`}>
      <section className={s.root}>
        <div className={s.bg} aria-hidden="true" />

        {/* akıntı: harfleri ve UI'ı katı cisim olarak okuyup etrafından dolaşır */}
        <FlowField />

        <div className={s.speedLeft} aria-hidden="true" />
        <div className={s.speedRight} aria-hidden="true" />
        <div className={s.vignette} aria-hidden="true" />
        <div className={s.grain} aria-hidden="true" />

        <div className={s.content}>
          <header className={s.nav}>
            <div className={`${s.brand} ${s.rise}`} style={{ "--i": 0 } as CSSProperties}>
              <span className={s.disc} data-flow="box">
                <AeroMark />
              </span>
              <span className={s.brandName}>{site.school}</span>
            </div>

            <nav
              className={`${s.navLinks} ${s.rise}`}
              style={{ "--i": 1 } as CSSProperties}
              data-flow="box"
              aria-label={site.navMark}
            >
              {nav.links.map((link) => (
                <a key={link.href} className={s.navLink} href={link.href}>
                  {link.label}
                </a>
              ))}
            </nav>

            <a
              className={`${s.navCta} ${s.rise}`}
              style={{ "--i": 2 } as CSSProperties}
              href={site.applyUrl}
              target="_blank"
              rel="noreferrer"
              data-flow="box"
            >
              {nav.cta.label}
            </a>
          </header>

          <div className={s.stage}>
            <span className={`${s.status} ${s.rise}`} style={{ "--i": 1 } as CSSProperties} data-flow="box">
              <span className={s.dot} aria-hidden="true" />
              {hero.status}
            </span>

            <h1 className={s.title}>
              <span className={s.srOnly}>{`${site.school} ${site.event} ${site.year}`}</span>

              <Glyphs text={headline} className={s.line1} glyphClassName={s.glyph} step={1} />

              <span className={s.line2Row}>
                <Glyphs text={subline} className={s.line2} glyphClassName={s.glyphInk} step={1} />
                <span className={`${s.rule} ${s.rise}`} style={{ "--i": 6 } as CSSProperties} aria-hidden="true" />
                <span className={`${s.year} ${s.rise}`} style={{ "--i": 6 } as CSSProperties} aria-hidden="true">
                  {site.year}
                </span>
              </span>
            </h1>

            <div className={`${s.ctaRow} ${s.rise}`} style={{ "--i": 7 } as CSSProperties}>
              <a className={s.cta} href={site.applyUrl} target="_blank" rel="noreferrer" data-flow="box">
                {hero.cta}
                <svg
                  className={s.ctaArrow}
                  width="17"
                  height="12"
                  viewBox="0 0 17 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M1 6h14M10.5 1.5 15.5 6l-5 4.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
              <p className={s.ctaNote}>{hero.ctaNote}</p>
            </div>
          </div>

          <footer className={`${s.rail} ${s.rise}`} style={{ "--i": 8 } as CSSProperties}>
            <span>{site.navMark}</span>
            <span className={s.chev} aria-hidden="true">
              <svg width="14" height="9" viewBox="0 0 14 9" fill="none">
                <path
                  d="M1 1l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <a
              className={s.railLink}
              href={site.socials.instagram}
              target="_blank"
              rel="noreferrer"
            >
              {site.socials.instagramHandle}
            </a>
          </footer>
        </div>
      </section>
    </main>
  );
}

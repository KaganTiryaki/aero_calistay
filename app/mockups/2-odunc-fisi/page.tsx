import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { disciplines, hero, nav, site } from "@/lib/content";
import { SATIR_ADIM_VH, SUTUN_YUZDE, satirYuzde } from "./fis";
import { SahneYukleyici } from "./SahneYukleyici";
import styles from "./fis.module.css";

// latin-ext ZORUNLU: İ ı ş ğ ç ö ü. Yoksa tofu.
const display = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `Ödünç Fişi · ${site.event} ${site.year}`,
};

/** Türkçe büyütme: i→İ, ı→I. Düz toUpperCase() bunu bozar. */
const trBuyuk = (s: string) => s.toLocaleUpperCase("tr");

/** Fişin dili tarihtir. Etiket yok — kartta tarihin etikete ihtiyacı olmaz. */
const tarihYaz = (iso: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(new Date(iso));

export default function OduncFisi() {
  // Cetvel ızgarasını CSS'e taşı: sahne ile metin aynı satırları kullansın.
  // --sutun: fişin basılı dikey marj çizgisi. Nav o çizgiye yazılıyor.
  const izgara = {
    "--satir": `${SATIR_ADIM_VH.toFixed(4)}vh`,
    "--r14": `${satirYuzde(14).toFixed(4)}%`,
    "--sutun": `${SUTUN_YUZDE.toFixed(4)}vw`,
  } as CSSProperties;

  return (
    <main
      className={`${styles.root} ${display.variable} ${body.variable} ${mono.variable}`}
      style={izgara}
    >
      <SahneYukleyici />

      <nav className={styles.nav}>
        <div className={styles.marka}>
          <span className={styles.markaAd}>{site.school}</span>
          <span className={styles.markaAlt}>{trBuyuk(site.navMark)}</span>
        </div>
        <div className={styles.navBaglar}>
          {nav.links.map((l) => (
            <a key={l.href} href={l.href}>
              {trBuyuk(l.label)}
            </a>
          ))}
          <a className={styles.navIg} href={site.socials.instagram} target="_blank" rel="noreferrer">
            {site.socials.instagramHandle}
          </a>
        </div>
      </nav>

      {/* Boş satırlar. Kaşeler buraya asla inmiyor — sıra sende. */}
      <div className={styles.metin}>
        <p className={styles.durum}>
          <span className={styles.nokta} aria-hidden="true" />
          {trBuyuk(hero.status)}
          <span className={styles.ayrac} aria-hidden="true">
            ·
          </span>
          {trBuyuk(tarihYaz(site.applyDeadline))}
        </p>

        <h1 className={styles.baslik}>
          {site.event} <span className={styles.yil}>{site.year}</span>
        </h1>

        <p className={styles.alanlar}>
          {disciplines.map((d, i) => (
            <span key={d.name}>
              {i > 0 && (
                <span className={styles.alanNokta} aria-hidden="true">
                  {" · "}
                </span>
              )}
              {trBuyuk(d.name)}
            </span>
          ))}
        </p>

        <div className={styles.ctaSira}>
          <a className={styles.cta} href={site.applyUrl} target="_blank" rel="noreferrer">
            {trBuyuk(hero.cta)}
            <span className={styles.ctaOk} aria-hidden="true">
              →
            </span>
          </a>
        </div>

        <p className={styles.not}>{hero.ctaNote}</p>
      </div>
    </main>
  );
}

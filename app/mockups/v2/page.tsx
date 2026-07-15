import type { Metadata } from "next";
import { Newsreader, Archivo, IBM_Plex_Mono } from "next/font/google";
import { site, hero, nav, disciplines } from "@/lib/content";
import { Sahne } from "./Sahne";
import styles from "./v2.module.css";

// latin-ext ZORUNLU: İ ı ş ğ ç ö ü. Yoksa tofu.
const display = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const body = Archivo({
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
  title: `Mürekkep · ${site.event} ${site.year}`,
};

/** Türkçe büyütme: i→İ, ı→I. Düz toUpperCase() bunu bozar (i→I). */
const TR_BUYUK: Record<string, string> = { i: "İ", ı: "I" };
const trBuyuk = (s: string) =>
  s.replace(/[iı]/g, (c) => TR_BUYUK[c]).toUpperCase();

export default function MurekkepHero() {
  return (
    <main
      className={`${styles.root} ${display.variable} ${body.variable} ${mono.variable}`}
    >
      <div className={styles.isik} aria-hidden="true" />
      <div className={styles.gren} aria-hidden="true" />
      <div className={styles.vinyet} aria-hidden="true" />

      <Sahne
        kicker={trBuyuk(`${site.school} · ${site.event} · 2026`)}
        yil={site.year}
        cta={hero.cta}
        ctaNot={hero.ctaNote}
        ctaHref={site.applyUrl}
        marka={site.school}
        navLinkleri={nav.links}
        disiplinler={disciplines.map((d) => d.name)}
      />
    </main>
  );
}

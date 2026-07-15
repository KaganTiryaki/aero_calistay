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
  weight: ["400", "500", "600"],
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
  title: `Işık Alanı · ${site.event} ${site.year}`,
};

/** Türkçe büyütme: i→İ, ı→I. Düz toUpperCase() bunu bozar (i→I). */
const trBuyuk = (s: string) => s.toLocaleUpperCase("tr");

export default function IsikAlaniHero() {
  return (
    <main
      className={`${styles.root} ${display.variable} ${body.variable} ${mono.variable}`}
    >
      <Sahne
        durum={trBuyuk(hero.status)}
        yil={site.year}
        cta={hero.cta}
        ctaNot={hero.ctaNote}
        ctaHref={site.applyUrl}
        marka={site.school}
        sonTarih={site.applyDeadline}
        instagram={site.socials.instagram}
        instagramEtiket={site.socials.instagramHandle}
        navLinkleri={nav.links}
        disiplinler={disciplines}
      />
    </main>
  );
}

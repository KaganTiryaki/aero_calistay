import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { site, hero, nav, disciplines, mission } from "@/lib/content";
import { Sayfa } from "./Sayfa";

// latin-ext ZORUNLU: İ ı ş ğ ç ö ü. Yoksa tofu.
const display = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--y-display",
  display: "swap",
});

const govde = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--y-govde",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--y-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `Yalayan Işık · ${site.event} ${site.year}`,
};

/** Türkçe büyütme: i→İ, ı→I. Düz toUpperCase() bunu bozar. */
const trBuyuk = (s: string) => s.toLocaleUpperCase("tr");

export default function YalayanIsik() {
  return (
    <div className={`${display.variable} ${govde.variable} ${mono.variable}`}>
      <Sayfa
        marka={site.school}
        navMark={trBuyuk(site.navMark)}
        etkinlik={site.event}
        yil={site.year}
        durum={trBuyuk(hero.status)}
        cta={hero.cta}
        ctaNot={hero.ctaNote}
        ctaHref={site.applyUrl}
        navLinkleri={nav.links}
        navCta={nav.cta.label}
        disiplinler={disciplines}
        strataEtiket={trBuyuk(mission.label)}
      />
    </div>
  );
}

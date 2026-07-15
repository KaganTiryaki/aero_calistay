import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { disciplines, hero, nav, site } from "@/lib/content";
import { Sahne } from "./Sahne";

// latin-ext ZORUNLU: İ ı ş ğ ç ö ü. Yoksa tofu.
const baslik = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-baslik",
  display: "swap",
});

const govde = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-govde",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `Yedi Eşik · ${site.event} ${site.year}`,
};

/** Türkçe büyütme: i→İ, ı→I. Düz toUpperCase() bunu bozar. */
const trBuyuk = (s: string) => s.toLocaleUpperCase("tr");

export default function YediEsik() {
  return (
    <main className={`${baslik.variable} ${govde.variable} ${mono.variable}`}>
      <Sahne
        marka={site.school}
        durum={trBuyuk(hero.status)}
        etkinlik={site.event}
        yil={site.year}
        cta={hero.cta}
        ctaNot={hero.ctaNote}
        ctaHref={site.applyUrl}
        baglar={nav.links}
        disiplinler={disciplines}
        instagram={site.socials.instagram}
        instagramEtiket={site.socials.instagramHandle}
        isaret={trBuyuk(site.navMark)}
      />
    </main>
  );
}

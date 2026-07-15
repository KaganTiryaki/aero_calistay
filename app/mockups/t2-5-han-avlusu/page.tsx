import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { site, hero, nav, disciplines, teams } from "@/lib/content";
import { HanAvlusu } from "./HanAvlusu";

// latin-ext ZORUNLU: İ ı ş ğ ç ö ü. Yoksa tofu.
const baslik = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
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
  title: `Han Avlusu · ${site.event} ${site.year}`,
};

/** Türkçe büyütme: i→İ, ı→I. Düz toUpperCase() bunu bozar. */
const trBuyuk = (s: string) => s.toLocaleUpperCase("tr");

/**
 * content.ts'te hero için bir lede alanı YOK ve mockup lib/'e dokunamıyor.
 * teams.intro'nun son cümlesi tam olarak bu sayfanın işini anlatıyor:
 * başvurunca ne oluyor. Kopya yine content.ts'ten — hardcode yok.
 * KALICI ÇÖZÜM: content.ts'e hero.lede eklemek.
 */
const sonCumle = (s: string) => s.trim().split(/(?<=\.)\s+/).at(-1) ?? s;

export default function HanAvlusuSayfasi() {
  return (
    <div className={`${baslik.variable} ${govde.variable} ${mono.variable}`}>
      <HanAvlusu
        marka={site.school}
        etkinlik={site.event}
        yil={site.year}
        durum={trBuyuk(hero.status)}
        lede={sonCumle(teams.intro)}
        cta={hero.cta}
        ctaNot={hero.ctaNote}
        ctaHref={site.applyUrl}
        navLinkleri={nav.links}
        disiplinler={disciplines.map((d) => trBuyuk(d.name))}
      />
    </div>
  );
}

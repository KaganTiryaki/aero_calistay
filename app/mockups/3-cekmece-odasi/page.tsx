import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { site, hero, nav, disciplines, faqs, vision } from "@/lib/content";
import { Oda } from "./Oda";

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
  title: `Çekmece Odası · ${site.event} ${site.year}`,
};

/** Türkçe büyütme: i→İ, ı→I. Düz toUpperCase() bunu bozar. */
const trBuyuk = (s: string) => s.toLocaleUpperCase("tr");

/** Metin content.ts'ten türetilir — hero'da hardcode kopya yok. */
const ilkCumle = (s: string) => `${s.split(". ")[0]}.`;

export default function CekmeceOdasiMockup() {
  const temaSss = faqs.find((f) => trBuyuk(f.q).includes("TEMA"));
  const ozet = ilkCumle(temaSss?.a ?? vision.body);

  return (
    <main className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <Oda
        marka={site.school}
        durum={trBuyuk(hero.status)}
        yil={site.year}
        ozet={ozet}
        cta={hero.cta}
        ctaNot={hero.ctaNote}
        ctaHref={site.applyUrl}
        instagram={site.socials.instagram}
        instagramEtiket={site.socials.instagramHandle}
        navLinkleri={nav.links}
        disiplinler={disciplines.map((d) => trBuyuk(d.name))}
      />
    </main>
  );
}

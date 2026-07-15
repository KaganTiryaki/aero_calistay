import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { site, hero, nav, disciplines, faqs } from "@/lib/content";
import { AsinmaHero } from "./AsinmaHero";

// latin-ext ZORUNLU: İ ı ş ğ ç ö ü. Yoksa tofu.
const display = Fraunces({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--asn-display",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--asn-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--asn-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `Aşınma · ${site.event} ${site.year}`,
};

/** Türkçe büyütme: i→İ, ı→I. Düz toUpperCase() bunu bozar. */
const trBuyuk = (s: string) => s.toLocaleUpperCase("tr");

/**
 * Hero'nun alt satırı içerikten türetiliyor (hardcode metin yok):
 * temayı anlatan SSS'nin ilk cümlesi.
 */
function temaCumlesi(): string {
  const sss = faqs.find((f) => f.q.toLocaleLowerCase("tr").includes("tema"));
  if (!sss) return "";
  const ilk = sss.a.split(". ")[0];
  return ilk.endsWith(".") ? ilk : `${ilk}.`;
}

export default function AsinmaSayfasi() {
  return (
    <main className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <AsinmaHero
        marka={trBuyuk(site.school)}
        navLinkler={nav.links}
        navCta={nav.cta.label}
        navCtaHref={site.applyUrl}
        durum={trBuyuk(hero.status)}
        baslik={site.event}
        yil={site.year}
        alt={temaCumlesi()}
        cta={hero.cta}
        ctaHref={site.applyUrl}
        ctaNot={hero.ctaNote}
        disiplinler={disciplines.map((d) => trBuyuk(d.name))}
      />
    </main>
  );
}

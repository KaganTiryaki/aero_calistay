import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { site, hero, nav, disciplines } from "@/lib/content";
import { Avlu } from "./Avlu";

// latin-ext ZORUNLU: İ ı ş ğ ç ö ü. Yoksa tofu.
const display = Fraunces({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--f-display",
  display: "swap",
});

const govde = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--f-govde",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--f-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `Asılı Avlu · ${site.event} ${site.year}`,
};

/** Türkçe büyütme: i→İ, ı→I. Düz toUpperCase() bunu bozar. */
const trBuyuk = (s: string) => s.toLocaleUpperCase("tr");

export default function AsiliAvluSayfasi() {
  const sonTarih = new Date(site.applyDeadline).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
  });

  return (
    <div className={`${display.variable} ${govde.variable} ${mono.variable}`}>
      <Avlu
        marka={site.school}
        durum={trBuyuk(hero.status)}
        baslikUst={site.event.split(" ")[0]}
        baslikAlt={site.event.split(" ").slice(1).join(" ")}
        yil={site.year}
        disiplinler={disciplines.map((d) => d.name)}
        cta={hero.cta}
        ctaNot={hero.ctaNote}
        ctaHref={site.applyUrl}
        navLinkleri={nav.links}
        navCta={trBuyuk(nav.cta.label)}
        instagram={site.socials.instagram}
        instagramEtiket={site.socials.instagramHandle}
        sonTarihNot={trBuyuk(`Son başvuru · ${sonTarih}`)}
        // next/font hash'li aile adı: canvas atlası aynı yazıyı kullansın.
        yaziAilesi={display.style.fontFamily}
      />
    </div>
  );
}

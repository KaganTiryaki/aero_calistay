import type { Metadata } from "next";
import { Fraunces, Manrope, IBM_Plex_Mono } from "next/font/google";
import { site, hero, nav, disciplines } from "@/lib/content";
import { Tonoz } from "./Tonoz";

// latin-ext ZORUNLU: İ ı ş ğ ç ö ü. Yoksa tofu.
const display = Fraunces({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--font-mk-display",
  display: "swap",
});

const ui = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mk-ui",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-mk-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `Mukarnas Tavanı · ${site.event} ${site.year}`,
};

/** Türkçe büyütme: i→İ, ı→I. Düz toUpperCase() bunu bozar. */
const trBuyuk = (s: string) => s.toLocaleUpperCase("tr");

export default function MukarnasTavani() {
  // Başlık content.ts'ten türetiliyor: ilk kelime (tema) vurguya, kalanı düz.
  const [ilk, ...kalan] = site.event.split(" ");

  return (
    <main className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <Tonoz
        marka={site.school}
        markaIkinci={site.navMark}
        navLinkleri={nav.links}
        navCta={nav.cta}
        kicker={trBuyuk(hero.status)}
        baslikAna={ilk}
        baslikKalan={kalan.join(" ")}
        yil={site.year}
        disiplinler={disciplines.map((d) => trBuyuk(d.name))}
        cta={hero.cta}
        ctaHref={site.applyUrl}
        ctaNot={hero.ctaNote}
        instagram={site.socials.instagram}
        instagramEtiket={site.socials.instagramHandle}
        ePosta={site.socials.email}
      />
    </main>
  );
}

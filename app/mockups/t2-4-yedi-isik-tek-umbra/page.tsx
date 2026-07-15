import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { site, hero, nav, disciplines, teams } from "@/lib/content";
import { Umbra } from "./Umbra";

// latin-ext ZORUNLU: İ ı ş ğ ç ö ü. Yoksa tofu.
const baslik = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-u-baslik",
  display: "swap",
});

const govde = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-u-govde",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--font-u-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `Yedi Işık, Tek Umbra · ${site.event} ${site.year}`,
};

/** Türkçe büyütme: i→İ, ı→I. Düz toUpperCase() bunu bozar. */
const trBuyuk = (s: string) => s.toLocaleUpperCase("tr");

/**
 * content.ts'te hero için bir lede alanı YOK ve mockup lib/'e dokunamıyor.
 * teams.intro'nun son cümlesi tam olarak bu sayfanın işini anlatıyor:
 * başvurunca ne oluyor. İlk cümle bir BÖLÜM girişi, hero cümlesi değil.
 * Kopya yine content.ts'ten geliyor (hardcode yok), yalnız doğru cümle seçiliyor.
 * KALICI ÇÖZÜM: content.ts'e hero.lede eklemek.
 */
const sonCumle = (s: string) => s.trim().split(/(?<=\.)\s+/).at(-1) ?? s;

export default function YediIsikTekUmbraSayfasi() {
  return (
    <div className={`${baslik.variable} ${govde.variable} ${mono.variable}`}>
      <Umbra
        marka={site.school}
        etkinlik={site.event}
        yil={site.year}
        durum={trBuyuk(hero.status)}
        lede={sonCumle(teams.intro)}
        cta={hero.cta}
        ctaNot={hero.ctaNote}
        ctaHref={site.applyUrl}
        navLinkleri={nav.links}
        // disciplines[] doğrudan ışıkların konum/tint'ini besliyor (bkz. sahne.ts
        // ISIK_DUZENI): yedi disiplin = yedi ışık. Sıra content.ts'in sırası.
        disiplinler={disciplines.map((d) => trBuyuk(d.name))}
      />
    </div>
  );
}

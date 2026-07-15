import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { site, hero, nav, disciplines, teams } from "@/lib/content";
import { Kavsak } from "./Kavsak";

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
  title: `Dört Kollu Kavşak · ${site.event} ${site.year}`,
};

/** Türkçe büyütme: i→İ, ı→I. Düz toUpperCase() bunu bozar. */
const trBuyuk = (s: string) => s.toLocaleUpperCase("tr");

/**
 * content.ts'te hero için bir `lede` alanı YOK ve mockup'lar lib/'e dokunamıyor.
 * teams.intro'nun tamamı hero'ya girmiyor: ilk cümlesi bir BÖLÜM girişi.
 * Son cümle ise tam olarak bu sayfanın işini anlatıyor: başvurunca ne oluyor.
 * Kopya yine content.ts'ten (hardcode yok), yalnız doğru cümle seçiliyor.
 * KALICI ÇÖZÜM: content.ts'e hero.lede eklemek.
 */
const sonCumle = (s: string) => s.trim().split(/(?<=\.)\s+/).at(-1) ?? s;

export default function DortKolluKavsakSayfasi() {
  // Dört kol = dört disiplin (batı, kuzey, doğu, güney); kalan üçü karanlıkta.
  // Kavşakta hepsini aynı anda göremezsin — seçmek zorundasın.
  const hepsi = disciplines.map((d) => ({ ad: trBuyuk(d.name), not: d.note }));

  return (
    <div className={`${baslik.variable} ${govde.variable} ${mono.variable}`}>
      <Kavsak
        marka={site.school}
        etkinlik={site.event}
        yil={site.year}
        durum={trBuyuk(hero.status)}
        lede={sonCumle(teams.intro)}
        cta={hero.cta}
        ctaNot={hero.ctaNote}
        ctaHref={site.applyUrl}
        navLinkleri={nav.links}
        kolDisiplinleri={hepsi.slice(0, 4)}
        karanliktakiler={hepsi.slice(4)}
      />
    </div>
  );
}

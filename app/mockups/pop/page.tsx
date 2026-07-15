import type { Metadata } from "next";
import { Anton, Archivo, IBM_Plex_Mono } from "next/font/google";
import { site } from "@/lib/content";
import { PopHero } from "./PopHero";
import s from "./pop.module.css";

/* --------------------------------------------------------------------------
   Tipografi — latin-ext ZORUNLU (İ ı ş ğ ç ö ü), yoksa tofu.
   Anton     → poster ağırlığında, sıkışık display. Extrude edildiğinde
               harf gövdeleri kalın kaldığı için 3B derinlik okunur kalıyor.
   Archivo   → UI/gövde; nötr değil, hafif mühendislik karakterli grotesk.
   Plex Mono → kicker/etiket/marquee.
   -------------------------------------------------------------------------- */

const display = Anton({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
  variable: "--pop-display",
});

const ui = Archivo({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--pop-ui",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--pop-mono",
});

export const metadata: Metadata = {
  title: `POP ŞOK · ${site.event} ${site.year} — hero mockup`,
  robots: { index: false, follow: false },
};

export default function PopMockupPage() {
  return (
    <div className={`${display.variable} ${ui.variable} ${mono.variable} ${s.root}`}>
      <PopHero />
    </div>
  );
}

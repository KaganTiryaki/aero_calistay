import type { Metadata } from "next";
import { Cormorant_Garamond, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { site, hero, nav, disciplines, teams } from "@/lib/content";
import { SahneKatmani } from "./SahneKatmani";
import styles from "./esik.module.css";

// latin-ext ZORUNLU: İ ı ş ğ ç ö ü. Yoksa tofu.
const basli = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-basli",
  display: "swap",
});

const govde = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-govde",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `Eşik · ${site.event} ${site.year}`,
};

/** Türkçe büyütme: i→İ, ı→I. Düz toUpperCase() bunu bozar. */
const trBuyuk = (s: string) => s.toLocaleUpperCase("tr");

export default function EsikTasi() {
  return (
    <main
      className={`${styles.root} ${basli.variable} ${govde.variable} ${mono.variable}`}
    >
      <SahneKatmani />

      <div className={styles.icerik}>
        <header className={styles.ustBar}>
          <span className={styles.marka}>{trBuyuk(site.navMark)}</span>
          <nav className={styles.baglar}>
            {nav.links.map((l) => (
              <a key={l.href} className={styles.bag} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <a className={styles.ustCta} href={site.applyUrl}>
            {nav.cta.label}
          </a>
        </header>

        <section className={styles.kahraman}>
          <div className={styles.oz}>
            <p className={styles.durum}>
              <span className={styles.nokta} />
              {trBuyuk(hero.status)}
            </p>

            <h1 className={styles.baslik}>
              {site.event} <span className={styles.yil}>{site.year}</span>
            </h1>

            <p className={styles.govde}>{teams.intro}</p>

            <a className={styles.cta} href={site.applyUrl}>
              {hero.cta}
              <span className={styles.ok} aria-hidden="true">
                →
              </span>
            </a>
            <p className={styles.ctaNot}>{hero.ctaNote}</p>
          </div>

          <div className={styles.kitabe}>
            {disciplines.map((d) => (
              <span key={d.name} className={styles.kitabeOge}>
                {trBuyuk(d.name)}
              </span>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

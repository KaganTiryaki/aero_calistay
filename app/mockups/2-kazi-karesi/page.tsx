import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { site, hero, nav, disciplines } from "@/lib/content";
import { SahneYukleyici } from "./SahneYukleyici";
import styles from "./kazi.module.css";

// latin-ext ZORUNLU: İ ı ş ğ ç ö ü. Yoksa tofu.
const display = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--kz-display",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--kz-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--kz-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `Steril Katman · ${site.event} ${site.year}`,
};

/** Türkçe büyütme: i→İ, ı→I. Düz toUpperCase() bunu bozar. */
const trBuyuk = (s: string) => s.toLocaleUpperCase("tr");

export default function SterilKatman() {
  // Başlık iki satıra content'ten bölünür — hiçbir yerde sabit metin yok.
  const kelimeler = site.event.split(" ");
  const ilkSatir = kelimeler[0];
  const ikinciSatir = [...kelimeler.slice(1), site.year].join(" ");

  return (
    <main
      className={`${styles.root} ${display.variable} ${body.variable} ${mono.variable}`}
    >
      <SahneYukleyici className={styles.tuval} />

      <div className={styles.ui}>
        <header className={styles.nav}>
          <div className={styles.marka}>
            <span className={styles.markaAd}>{site.school}</span>
            <span className={styles.markaAyrac} aria-hidden="true" />
            <span className={styles.markaAlt}>{site.navMark}</span>
          </div>

          <nav className={styles.navLinkler}>
            {nav.links.map((l) => (
              <a key={l.href} href={l.href} className={styles.navLink}>
                {l.label}
              </a>
            ))}
          </nav>

          <a
            className={styles.navCta}
            href={site.applyUrl}
            target="_blank"
            rel="noreferrer"
          >
            {nav.cta.label}
          </a>
        </header>

        {/* çukurun içi: steril katmanın üstü */}
        <section className={styles.orta}>
          <p className={styles.durum}>
            <span className={styles.durumIsaret} aria-hidden="true" />
            {trBuyuk(hero.status)}
          </p>

          <h1 className={styles.baslik}>
            {ilkSatir}
            <span className={styles.baslikAlt}>{ikinciSatir}</span>
          </h1>

          <div className={styles.ctaSatir}>
            <a
              className={styles.cta}
              href={site.applyUrl}
              target="_blank"
              rel="noreferrer"
            >
              {hero.cta}
              <span className={styles.ctaOk} aria-hidden="true">
                →
              </span>
            </a>
            <span className={styles.ctaNot}>{hero.ctaNote}</span>
          </div>
        </section>

        {/* disiplinler: düz satır. Çember/yörünge yok. */}
        <footer className={styles.altSerit}>
          {disciplines.map((d, i) => (
            <span key={d.name} className={styles.disiplin}>
              {i > 0 && (
                <span className={styles.disiplinAyrac} aria-hidden="true" />
              )}
              {d.name}
            </span>
          ))}
        </footer>
      </div>
    </main>
  );
}

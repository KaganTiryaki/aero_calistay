"use client";

import dynamic from "next/dynamic";
import { ArrowRight } from "lucide-react";
import styles from "./asinma.module.css";

// three ~150KB gzip. ssr:false + dynamic olmadan projenin <150KB'lık ilk
// bundle bütçesini tek başına yer.
const TasSahnesi = dynamic(
  () => import("./TasSahnesi").then((m) => m.TasSahnesi),
  { ssr: false },
);

type Link = { readonly label: string; readonly href: string };

export function AsinmaHero({
  marka,
  navLinkler,
  navCta,
  navCtaHref,
  durum,
  baslik,
  yil,
  alt,
  cta,
  ctaHref,
  ctaNot,
  disiplinler,
}: {
  marka: string;
  navLinkler: readonly Link[];
  navCta: string;
  navCtaHref: string;
  durum: string;
  baslik: string;
  yil: string;
  alt: string;
  cta: string;
  ctaHref: string;
  ctaNot: string;
  disiplinler: readonly string[];
}) {
  return (
    <div className={styles.root}>
      <TasSahnesi sinif={styles.tuval} />

      <div className={styles.ui}>
        <header className={styles.nav}>
          <span className={styles.marka}>{marka}</span>
          <nav className={styles.navLinkler}>
            {navLinkler.map((l) => (
              <a key={l.href} href={l.href} className={styles.navLink}>
                {l.label}
              </a>
            ))}
          </nav>
          <a
            className={styles.navCta}
            href={navCtaHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            {navCta}
          </a>
        </header>

        <div className={styles.orta}>
          <div className={styles.blok}>
            <span className={styles.durum}>
              <i className={styles.nokta} aria-hidden="true" />
              {durum}
            </span>

            <h1 className={styles.baslik}>
              {baslik} <span className={styles.yil}>{yil}</span>
            </h1>

            <p className={styles.alt}>{alt}</p>

            <div className={styles.ctaSar}>
              <a
                className={styles.cta}
                href={ctaHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {cta}
                <ArrowRight className={styles.ok} size={17} aria-hidden="true" />
              </a>
              <span className={styles.ctaNot}>{ctaNot}</span>
            </div>

            <ul className={styles.disiplinler}>
              {disiplinler.map((d) => (
                <li key={d} className={styles.disiplin}>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import styles from "./tonoz.module.css";

// three ~150KB gzip. İlk bundle'a girerse projenin <150KB bütçesini tek başına
// yer. Ayrı chunk + yalnız istemci.
const MukarnasSahnesi = dynamic(
  () => import("./MukarnasSahnesi").then((m) => m.MukarnasSahnesi),
  { ssr: false },
);

type Props = {
  marka: string;
  markaIkinci: string;
  navLinkleri: readonly { label: string; href: string }[];
  navCta: { label: string; href: string };
  kicker: string;
  baslikAna: string;
  baslikKalan: string;
  yil: string;
  disiplinler: readonly string[];
  cta: string;
  ctaHref: string;
  ctaNot: string;
  instagram: string;
  instagramEtiket: string;
  ePosta: string;
};

export function Tonoz(p: Props) {
  // CTA'ya yaklaşınca tonozdaki ışık göçü hızlanır: buton sahneyi tetikler,
  // sahne butonu değil. UI ile sahne aynı sistemin parçası.
  const [guclu, setGuclu] = useState(false);

  return (
    <div className={styles.root}>
      <MukarnasSahnesi guclu={guclu} sinif={styles.tuval} />

      <div className={styles.alan}>
        {/* Kitabe: gerçek taçkapılarda mukarnas kavsaranın altındaki yazı
            bandı buradadır. Nav'ı oraya oturttuk — sahnenin üstüne değil. */}
        <nav className={styles.kitabe} aria-label={p.marka}>
          <span className={styles.marka}>
            {p.marka} <span className={styles.markaIkinci}>{p.markaIkinci}</span>
          </span>
          <span className={styles.baglar}>
            {p.navLinkleri.map((l) => (
              <a key={l.href} className={styles.bag} href={l.href}>
                {l.label}
              </a>
            ))}
            <a className={`${styles.bag} ${styles.bagCta}`} href={p.navCta.href}>
              {p.navCta.label}
            </a>
          </span>
        </nav>

        <div className={styles.hero}>
          <span className={styles.kicker}>
            <i className={styles.nabiz} aria-hidden="true" />
            {p.kicker}
          </span>

          <h1 className={styles.baslik}>
            <span className={styles.akan}>{p.baslikAna}</span> {p.baslikKalan}
            <span className={styles.yil}>{p.yil}</span>
          </h1>

          <p className={styles.disiplinler}>
            {p.disiplinler.map((d, i) => (
              <span key={d}>
                {i > 0 && (
                  <span className={styles.ayrac} aria-hidden="true">
                    {"  ·  "}
                  </span>
                )}
                {d}
              </span>
            ))}
          </p>

          <div className={styles.eylem}>
            <a
              className={styles.cta}
              href={p.ctaHref}
              target="_blank"
              rel="noreferrer"
              onMouseEnter={() => setGuclu(true)}
              onMouseLeave={() => setGuclu(false)}
              onFocus={() => setGuclu(true)}
              onBlur={() => setGuclu(false)}
            >
              {p.cta}
              <span className={styles.ok} aria-hidden="true">
                →
              </span>
            </a>
            <span className={styles.not}>{p.ctaNot}</span>
          </div>
        </div>

        <div className={styles.dip}>
          <a href={p.instagram} target="_blank" rel="noreferrer">
            {p.instagramEtiket}
          </a>
          <a href={`mailto:${p.ePosta}`}>{p.ePosta}</a>
        </div>
      </div>
    </div>
  );
}

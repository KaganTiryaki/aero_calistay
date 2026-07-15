"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import styles from "./oda.module.css";

// three ~150KB gzip: ilk bundle'a girerse projenin <150KB bütçesini tek başına
// yer. Ayrı chunk + yalnız istemci.
const CekmeceOdasi = dynamic(
  () => import("./CekmeceOdasi").then((m) => m.CekmeceOdasi),
  { ssr: false },
);

type Props = {
  marka: string;
  durum: string;
  yil: string;
  ozet: string;
  cta: string;
  ctaNot: string;
  ctaHref: string;
  instagram: string;
  instagramEtiket: string;
  navLinkleri: readonly { label: string; href: string }[];
  disiplinler: readonly string[];
};

export function Oda({
  marka,
  durum,
  yil,
  ozet,
  cta,
  ctaNot,
  ctaHref,
  instagram,
  instagramEtiket,
  navLinkleri,
  disiplinler,
}: Props) {
  // null = statik base katman (JS yok / reduced-motion): künye sakin durur,
  // hiçbir şey yanıp sönmez.
  const [aktif, setAktif] = useState<number | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setAktif(0);
    let i = 0;
    let duraklat = false;

    const id = window.setInterval(() => {
      if (duraklat) return;
      i = (i + 1) % disiplinler.length;
      setAktif(i);
    }, 2600);

    // Sekme arkadayken kaydı boşuna dolaştırma.
    const gorunurluk = () => {
      duraklat = document.hidden;
    };
    document.addEventListener("visibilitychange", gorunurluk);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", gorunurluk);
    };
  }, [disiplinler.length]);

  return (
    <div className={styles.root}>
      {/* Sahne UI'ın ARKASINDA, tam kanvas. Yarım ekrana sürülmüş değil. */}
      <div className={styles.sahne} aria-hidden="true">
        <CekmeceOdasi />
      </div>
      <div className={styles.gren} aria-hidden="true" />
      <div className={styles.vinyet} aria-hidden="true" />

      <div className={styles.icerik}>
        <header className={`${styles.ust} ${styles.gir}`}>
          <span className={styles.marka}>
            <span className={styles.markaIsaret} aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path
                  d="M6.5 1.2 11.4 11.5 6.5 8.8 1.6 11.5Z"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            {marka}
          </span>

          <nav className={styles.nav}>
            {navLinkleri.map((l) => (
              <a key={l.href} href={l.href} className={styles.navLink}>
                {l.label}
              </a>
            ))}
          </nav>

          <a className={styles.ustCta} href={ctaHref}>
            {cta}
          </a>
        </header>

        <div className={styles.govde}>
          <div className={styles.blok}>
            <span
              className={`${styles.durum} ${styles.gir}`}
              style={{ animationDelay: "0.1s" }}
            >
              <span className={styles.nabiz} aria-hidden="true" />
              {durum}
            </span>

            <h1 className={styles.baslik}>
              <span
                className={`${styles.satir} ${styles.gir}`}
                style={{ animationDelay: "0.2s" }}
              >
                Sirkülasyon
              </span>
              <span
                className={`${styles.satir} ${styles.gir}`}
                style={{ animationDelay: "0.32s" }}
              >
                <span className={styles.italik}>Çalıştayı</span>
                <span className={styles.yil}>{yil}</span>
              </span>
            </h1>

            <p
              className={`${styles.ozet} ${styles.gir}`}
              style={{ animationDelay: "0.44s" }}
            >
              {ozet}
            </p>

            <div
              className={`${styles.disiplinler} ${styles.gir}`}
              style={{ animationDelay: "0.54s" }}
            >
              {disiplinler.map((d, i) => (
                <span
                  key={d}
                  className={`${styles.disiplin} ${
                    i === aktif ? styles.disiplinAktif : ""
                  }`}
                >
                  {d}
                </span>
              ))}
            </div>

            <div
              className={`${styles.alt} ${styles.gir}`}
              style={{ animationDelay: "0.64s" }}
            >
              <a className={styles.cta} href={ctaHref}>
                {cta}
                <span className={styles.ctaOk} aria-hidden="true">
                  →
                </span>
              </a>
              <span className={styles.ctaNot}>{ctaNot}</span>
            </div>
          </div>
        </div>

        <footer className={`${styles.altSerit} ${styles.gir}`}>
          <a
            className={styles.altLink}
            href={instagram}
            target="_blank"
            rel="noreferrer"
          >
            {instagramEtiket}
          </a>
          <span className={styles.kaydir}>
            <span className={styles.kaydirCizgi} aria-hidden="true" />
            KEŞFET
          </span>
        </footer>
      </div>
    </div>
  );
}

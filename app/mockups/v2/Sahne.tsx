"use client";

import { useEffect, useState } from "react";
import styles from "./v2.module.css";

type Props = {
  kicker: string;
  yil: string;
  cta: string;
  ctaNot: string;
  ctaHref: string;
  marka: string;
  navLinkleri: readonly { label: string; href: string }[];
  disiplinler: readonly string[];
};

/** Yörünge düğümleri: 7 disiplin, tepeden başlayıp saat yönünde.
 *  Koordinatlar modül kapsamında bir kez ve YUVARLANARAK hesaplanır —
 *  ham Math.cos/sin çıktısı SSR ile istemcide farklı basılıp
 *  hydration mismatch üretebiliyor. */
const R = 300;
const MERKEZ = 400;
const dugumler = Array.from({ length: 7 }, (_, i) => {
  const rad = ((-90 + (i * 360) / 7) * Math.PI) / 180;
  return {
    cx: Math.round((MERKEZ + R * Math.cos(rad)) * 100) / 100,
    cy: Math.round((MERKEZ + R * Math.sin(rad)) * 100) / 100,
  };
});

export function Sahne({
  kicker,
  yil,
  cta,
  ctaNot,
  ctaHref,
  marka,
  navLinkleri,
  disiplinler,
}: Props) {
  // null = statik base katman (JS yok / reduced-motion): her şey okunur durur.
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
    }, 2200);

    // Sekme arkadayken fikri boşuna dolaştırma.
    const gorunurluk = () => {
      duraklat = document.hidden;
    };
    document.addEventListener("visibilitychange", gorunurluk);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", gorunurluk);
    };
  }, [disiplinler.length]);

  const statik = aktif === null;

  return (
    <>
      {/* --- Sirkülasyon yörüngesi: temanın kendisi, sağ kenardan taşıyor --- */}
      <svg
        className={styles.yorunge}
        viewBox="0 0 800 800"
        fill="none"
        aria-hidden="true"
      >
        <g className={styles.yorungeDon}>
          <circle
            cx={MERKEZ}
            cy={MERKEZ}
            r="382"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="1"
            strokeDasharray="1 9"
          />
        </g>

        {/* Fikrin dolaştığı hat */}
        <circle
          cx={MERKEZ}
          cy={MERKEZ}
          r={R}
          stroke="currentColor"
          strokeOpacity="0.16"
          strokeWidth="1"
        />
        <circle
          cx={MERKEZ}
          cy={MERKEZ}
          r="196"
          stroke="currentColor"
          strokeOpacity="0.07"
          strokeWidth="1"
          strokeDasharray="2 12"
        />

        {/* Aktif düğüme uzanan ince kiriş */}
        {!statik && (
          <line
            className={styles.kiris}
            x1={MERKEZ}
            y1={MERKEZ}
            x2={dugumler[aktif].cx}
            y2={dugumler[aktif].cy}
          />
        )}

        {dugumler.map((d, i) => (
          <g key={i}>
            {i === aktif && (
              <circle className={styles.hale} cx={d.cx} cy={d.cy} r="26" />
            )}
            <circle
              className={`${styles.dugum} ${
                i === aktif ? styles.dugumAktif : ""
              } ${statik ? styles.dugumStatik : ""}`}
              cx={d.cx}
              cy={d.cy}
              r="5.5"
            />
          </g>
        ))}

        <circle
          className={styles.cekirdek}
          cx={MERKEZ}
          cy={MERKEZ}
          r="3"
        />
      </svg>

      <header className={styles.ust}>
        <div className={styles.marka}>
          <span className={styles.markaDisk} aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path
                d="M7.5 1.4 12.4 13.2 7.5 10.1 2.6 13.2Z"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className={styles.markaAd}>{marka}</span>
        </div>

        <nav className={styles.nav}>
          {navLinkleri.map((l) => (
            <a key={l.href} href={l.href} className={styles.navLink}>
              {l.label}
            </a>
          ))}
        </nav>
      </header>

      <div className={styles.govde}>
        <div className={`${styles.kicker} ${styles.gir}`} style={{ animationDelay: "0.1s" }}>
          <span className={styles.nabiz} aria-hidden="true" />
          <span>{kicker}</span>
          <span className={styles.kickerCizgi} aria-hidden="true" />
        </div>

        <h1 className={styles.baslik}>
          <span className={`${styles.satir1} ${styles.gir}`} style={{ animationDelay: "0.2s" }}>
            Sirkülasyon
          </span>
          <span className={`${styles.satir2} ${styles.gir}`} style={{ animationDelay: "0.32s" }}>
            Çalıştayı<span className={styles.yil}>{yil}</span>
          </span>
        </h1>

        <div
          className={`${styles.serit} ${statik ? styles.seritStatik : ""} ${styles.gir}`}
          style={{ animationDelay: "0.46s" }}
          aria-label="Çalıştayın disiplinleri"
        >
          {disiplinler.map((ad, i) => (
            <span key={ad} className={styles.seritOge}>
              <span
                className={`${styles.disiplin} ${
                  i === aktif ? styles.disiplinAktif : ""
                }`}
              >
                {ad}
              </span>
              {i < disiplinler.length - 1 && (
                <span className={styles.ayrac} aria-hidden="true">
                  ◦
                </span>
              )}
            </span>
          ))}
        </div>

        <div className={`${styles.alt} ${styles.gir}`} style={{ animationDelay: "0.58s" }}>
          <a className={styles.cta} href={ctaHref}>
            <span className={styles.ctaMetin}>{cta}</span>
            <span className={styles.ctaOk} aria-hidden="true">
              →
            </span>
          </a>
          <span className={styles.ctaNot}>{ctaNot}</span>
        </div>
      </div>
    </>
  );
}

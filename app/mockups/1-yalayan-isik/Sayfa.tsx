"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import styles from "./yalayan.module.css";

/*
 * three ~150KB gzip. ssr:false + dynamic ZORUNLU, yoksa tek başına
 * projenin <150KB ilk-bundle bütçesini yer.
 */
const Sahne = dynamic(() => import("./Sahne").then((m) => m.Sahne), {
  ssr: false,
});

type Disiplin = { readonly name: string; readonly note: string };
type NavLink = { readonly label: string; readonly href: string };

export function Sayfa({
  marka,
  navMark,
  etkinlik,
  yil,
  durum,
  cta,
  ctaNot,
  ctaHref,
  navLinkleri,
  navCta,
  disiplinler,
  strataEtiket,
}: {
  marka: string;
  navMark: string;
  etkinlik: string;
  yil: string;
  durum: string;
  cta: string;
  ctaNot: string;
  ctaHref: string;
  navLinkleri: readonly NavLink[];
  navCta: string;
  disiplinler: readonly Disiplin[];
  strataEtiket: string;
}) {
  const [aktif, setAktif] = useState(2);
  const onKatman = useCallback((i: number) => setAktif(i), []);

  const toplam = String(disiplinler.length).padStart(2, "0");
  const okunan = disiplinler[aktif] ?? disiplinler[0];

  return (
    <div className={styles.root} data-kaydirma>
      <Sahne sinif={styles.tuval} onKatman={onKatman} />

      {/* Şeridin altı da kazınmamış: parşömenin baş boşluğu. */}
      <header className={styles.serit} data-ada data-ada-pay="0.008" data-ada-yum="0.02" data-ada-yaricap="0">
        <span className={styles.marka}>{navMark}</span>
        <nav className={styles.seritOrta}>
          {navLinkleri.map((l) => (
            <a key={l.href} className={styles.seritLink} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <a className={styles.seritCta} href={ctaHref} target="_blank" rel="noopener noreferrer">
          {navCta}
        </a>
      </header>

      <main className={styles.icerik}>
        <section className={styles.bolum}>
          <div className={styles.ada} data-ada data-ada-pay="0.018" data-ada-yum="0.065">
            <p className={styles.durum}>
              <span className={styles.nokta} aria-hidden="true" />
              {durum}
            </p>

            <h1 className={styles.baslik}>
              {etkinlik}
              <span className={styles.yil}>{yil}</span>
            </h1>

            <span className={styles.cizgi} aria-hidden="true" />

            <div className={styles.katman} aria-live="polite">
              <p key={`b-${aktif}`} className={`${styles.katmanBas} ${styles.katmanGec}`}>
                <span className={styles.katmanNo}>
                  {String(aktif + 1).padStart(2, "0")} / {toplam}
                </span>
                <span className={styles.katmanAd}>{okunan.name}</span>
              </p>
              <p key={`n-${aktif}`} className={`${styles.katmanNot} ${styles.katmanGec}`}>
                {okunan.note}
              </p>
            </div>

            <div className={styles.eylem}>
              <a className={styles.cta} href={ctaHref} target="_blank" rel="noopener noreferrer">
                {cta}
              </a>
              <span className={styles.ctaNot}>{ctaNot}</span>
            </div>
          </div>
        </section>

        <section className={styles.bolum}>
          <div className={`${styles.ada} ${styles.adaGenis}`} data-ada>
            <p className={styles.eyebrow}>
              {strataEtiket} · {marka}
            </p>
            <ol className={styles.strata}>
              {disiplinler.map((d, i) => (
                <li
                  key={d.name}
                  className={`${styles.satir} ${i === aktif ? styles.satirAktif : ""}`}
                >
                  <span className={styles.satirNo}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={styles.satirAd}>{d.name}</span>
                  <p className={styles.satirNot}>{d.note}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}

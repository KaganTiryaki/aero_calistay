"use client";

import dynamic from "next/dynamic";
import styles from "./yedi.module.css";

/**
 * three ~150KB gzip. ssr:false ZORUNLU — ilk bundle'a girerse projenin
 * <150KB bütçesini tek başına yer.
 */
const EnfiladSahnesi = dynamic(
  () => import("./EnfiladSahnesi").then((m) => m.EnfiladSahnesi),
  { ssr: false },
);

export type Bag = { readonly label: string; readonly href: string };
export type Disiplin = { readonly name: string; readonly note: string };

export function Sahne({
  marka,
  durum,
  etkinlik,
  yil,
  cta,
  ctaNot,
  ctaHref,
  baglar,
  disiplinler,
  instagram,
  instagramEtiket,
  isaret,
}: {
  marka: string;
  durum: string;
  etkinlik: string;
  yil: string;
  cta: string;
  ctaNot: string;
  ctaHref: string;
  baglar: readonly Bag[];
  disiplinler: readonly Disiplin[];
  instagram: string;
  instagramEtiket: string;
  isaret: string;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.sahne}>
        <EnfiladSahnesi />
      </div>

      <div className={styles.icerik}>
        <section className={styles.kahraman}>
          <header className={styles.ust}>
            <span className={styles.marka}>{marka}</span>
            <nav className={styles.baglar}>
              {baglar.map((b) => (
                <a key={b.href} className={styles.bag} href={b.href}>
                  {b.label}
                </a>
              ))}
            </nav>
          </header>

          <p className={styles.kicker}>
            <span className={styles.nokta} />
            {durum}
          </p>

          <h1 className={styles.baslik}>
            {etkinlik} <span className={styles.yil}>{yil}</span>
          </h1>

          <p className={styles.lede}>
            {disiplinler.map((d) => d.name).join(" · ")}
          </p>

          <div className={styles.esikBoslugu} />

          <a
            className={styles.cta}
            href={ctaHref}
            target="_blank"
            rel="noreferrer"
          >
            {cta}
            <span className={styles.ok}>→</span>
          </a>
          <p className={styles.ctaNot}>{ctaNot}</p>

          <div className={styles.alt}>
            <span>{isaret}</span>
            <a href={instagram} target="_blank" rel="noreferrer">
              {instagramEtiket}
            </a>
          </div>
        </section>

        <section className={styles.friz}>
          <p className={styles.frizKicker}>{etkinlik}</p>
          <ul className={styles.esikler}>
            {disiplinler.map((d, i) => (
              <li key={d.name} className={styles.esik}>
                <span className={styles.esikNo}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className={styles.esikAd}>{d.name}</h2>
                <p className={styles.esikNot}>{d.note}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

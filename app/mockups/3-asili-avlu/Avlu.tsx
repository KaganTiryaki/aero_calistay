"use client";

import dynamic from "next/dynamic";
import styles from "./avlu.module.css";

// three ~150KB gzip: ilk bundle'a girerse projenin <150KB bütçesini tek başına
// yer. Ayrı chunk + yalnız istemci.
const AvluSahnesi = dynamic(() => import("./AvluSahnesi").then((m) => m.AvluSahnesi), {
  ssr: false,
});

type Props = {
  marka: string;
  durum: string;
  baslikUst: string;
  baslikAlt: string;
  yil: string;
  disiplinler: readonly string[];
  cta: string;
  ctaNot: string;
  ctaHref: string;
  navLinkleri: readonly { label: string; href: string }[];
  navCta: string;
  instagram: string;
  instagramEtiket: string;
  sonTarihNot: string;
  yaziAilesi: string;
};

export function Avlu({
  marka,
  durum,
  baslikUst,
  baslikAlt,
  yil,
  disiplinler,
  cta,
  ctaNot,
  ctaHref,
  navLinkleri,
  navCta,
  instagram,
  instagramEtiket,
  sonTarihNot,
  yaziAilesi,
}: Props) {
  return (
    <div className={styles.kap}>
      {/* Sahne UI'ın ARKASINDA, tam kadraj. Yarıya sürülmüş değil. */}
      <div className={styles.sahne}>
        <AvluSahnesi adlar={disiplinler} yaziAilesi={yaziAilesi} />
      </div>

      <header className={styles.ust}>
        <span className={styles.marka}>{marka}</span>
        <nav className={styles.nav}>
          {navLinkleri.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <a className={styles.ustCta} href={ctaHref} target="_blank" rel="noreferrer">
          {navCta}
        </a>
      </header>

      {/* Avlunun göz hizasındaki boş hacmi: metin burada duruyor. Perde yok. */}
      <main className={styles.orta}>
        <p className={styles.durum}>
          <span className={styles.nokta} aria-hidden="true" />
          {durum}
        </p>
        <h1 className={styles.baslik}>
          {baslikUst}
          <span className={styles.baslikAlt}>
            {baslikAlt} <span className={styles.yil}>{yil}</span>
          </span>
        </h1>
        <p className={styles.disiplinler}>
          {disiplinler.map((d, i) => (
            <span key={d}>
              {i > 0 && <i aria-hidden="true">·</i>}
              {d}
            </span>
          ))}
        </p>
        <div className={styles.eylem}>
          {/* Buton sahnenin malzemesinden: kâğıt + mürekkep. Harman perdeyle değil. */}
          <a className={styles.buton} href={ctaHref} target="_blank" rel="noreferrer">
            {cta}
          </a>
          <span className={styles.not}>{ctaNot}</span>
        </div>
      </main>

      <footer className={styles.alt}>
        <a href={instagram} target="_blank" rel="noreferrer">
          {instagramEtiket}
        </a>
        <span>{sonTarihNot}</span>
      </footer>
    </div>
  );
}

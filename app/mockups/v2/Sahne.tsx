"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import styles from "./v2.module.css";

// three.js ~150KB gzip: ilk bundle'a girerse CLAUDE.md'deki <150KB bütçesini
// tek başına yer. Ayrı chunk + yalnız istemci.
const AkintiSahnesi = dynamic(
  () => import("./AkintiSahnesi").then((m) => m.AkintiSahnesi),
  { ssr: false },
);

type Disiplin = { name: string; note: string };

type Props = {
  durum: string;
  yil: string;
  cta: string;
  ctaNot: string;
  ctaHref: string;
  marka: string;
  sonTarih: string;
  instagram: string;
  instagramEtiket: string;
  navLinkleri: readonly { label: string; href: string }[];
  disiplinler: readonly Disiplin[];
};

/* Zerreler: sabit tohum, Math.random YOK — SSR ile istemci aynı basmalı. */
const zerreler = [
  { sol: 8, ust: 22, sure: 9, gecikme: 0 },
  { sol: 19, ust: 74, sure: 12, gecikme: 1.4 },
  { sol: 31, ust: 14, sure: 10.5, gecikme: 3.1 },
  { sol: 44, ust: 88, sure: 13, gecikme: 0.7 },
  { sol: 58, ust: 31, sure: 11, gecikme: 2.3 },
  { sol: 67, ust: 67, sure: 14, gecikme: 4 },
  { sol: 78, ust: 18, sure: 10, gecikme: 1.1 },
  { sol: 87, ust: 52, sure: 12.5, gecikme: 3.6 },
  { sol: 93, ust: 82, sure: 9.5, gecikme: 2 },
  { sol: 27, ust: 46, sure: 13.5, gecikme: 5 },
];

type Kalan = { gun: number; saat: number; dakika: number };

function kalanHesapla(sonTarih: string): Kalan | null {
  const fark = new Date(sonTarih).getTime() - Date.now();
  if (!Number.isFinite(fark) || fark <= 0) return null;
  return {
    gun: Math.floor(fark / 86400000),
    saat: Math.floor((fark / 3600000) % 24),
    dakika: Math.floor((fark / 60000) % 60),
  };
}

export function Sahne({
  durum,
  yil,
  cta,
  ctaNot,
  ctaHref,
  marka,
  sonTarih,
  instagram,
  instagramEtiket,
  navLinkleri,
  disiplinler,
}: Props) {
  // null = statik base katman (JS yok / reduced-motion): her şey okunur durur.
  const [aktif, setAktif] = useState<number | null>(null);
  // Geri sayım yalnız istemcide: Date.now() sunucuda başka değer basar.
  const [kalan, setKalan] = useState<Kalan | null>(null);

  useEffect(() => {
    setKalan(kalanHesapla(sonTarih));
    const id = window.setInterval(
      () => setKalan(kalanHesapla(sonTarih)),
      30_000,
    );
    return () => window.clearInterval(id);
  }, [sonTarih]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setAktif(0);
    let i = 0;
    let duraklat = false;

    const id = window.setInterval(() => {
      if (duraklat) return;
      i = (i + 1) % disiplinler.length;
      setAktif(i);
    }, 3800);

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
  const gosterilen = disiplinler[aktif ?? 0];

  return (
    <>
      <div className={styles.isik} aria-hidden="true" />

      {/* Akıntı: gerçek WebGL sahnesi — halka, akan zerreler, yedi düğüm.
          Sahne CSS zemininin üstünde, içeriğin altında yaşar. */}
      <div className={styles.kuyu} aria-hidden="true" />
      <div className={styles.sahne3b}>
        <AkintiSahnesi aktif={aktif} toplam={disiplinler.length} />
      </div>
      <div className={styles.perde} aria-hidden="true" />

      <div className={styles.zerreler} aria-hidden="true">
        {zerreler.map((z, i) => (
          <span
            key={i}
            className={styles.zerre}
            style={
              {
                left: `${z.sol}%`,
                top: `${z.ust}%`,
                "--sure": `${z.sure}s`,
                "--gecikme": `${z.gecikme}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className={styles.gren} aria-hidden="true" />
      <div className={styles.vinyet} aria-hidden="true" />

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

        <a className={styles.ustCta} href={ctaHref}>
          {cta}
        </a>
      </header>

      <div className={styles.govde}>
        <div className={styles.sol}>
          <span
            className={`${styles.durum} ${styles.gir}`}
            style={{ animationDelay: "0.08s" }}
          >
            <span className={styles.nabiz} aria-hidden="true" />
            {durum}
          </span>

          <h1 className={styles.baslik}>
            <span
              className={`${styles.satir1} ${styles.gir}`}
              style={{ animationDelay: "0.18s" }}
            >
              Sirkülasyon
            </span>
            <span
              className={`${styles.satir2} ${styles.gir}`}
              style={{ animationDelay: "0.3s" }}
            >
              Çalıştayı<span className={styles.yil}>{yil}</span>
            </span>
          </h1>

          {/* Fikir disiplinler arasında dolaşıyor — yörüngedeki ışıkla senkron. */}
          <div
            className={`${styles.not} ${styles.gir}`}
            style={{ animationDelay: "0.42s" }}
          >
            <span className={styles.notAd}>
              {gosterilen.name.toLocaleUpperCase("tr")}
            </span>
            <p
              key={statik ? "statik" : gosterilen.name}
              className={`${styles.notMetin} ${statik ? "" : styles.notCanli}`}
            >
              {gosterilen.note}
            </p>
          </div>

          <div
            className={`${styles.sayim} ${styles.gir}`}
            style={{ animationDelay: "0.52s" }}
          >
            {[
              { sayi: kalan?.gun, etiket: "GÜN" },
              { sayi: kalan?.saat, etiket: "SAAT" },
              { sayi: kalan?.dakika, etiket: "DAKİKA" },
            ].map((k) => (
              <span key={k.etiket} className={styles.sayimKutu}>
                <span className={styles.sayimSayi}>
                  {k.sayi === undefined ? "—" : String(k.sayi).padStart(2, "0")}
                </span>
                <span className={styles.sayimEtiket}>{k.etiket}</span>
              </span>
            ))}
          </div>

          <div
            className={`${styles.alt} ${styles.gir}`}
            style={{ animationDelay: "0.62s" }}
          >
            <a className={styles.cta} href={ctaHref}>
              <span className={styles.ctaMetin}>{cta}</span>
              <span className={styles.ctaOk} aria-hidden="true">
                →
              </span>
            </a>
            <span className={styles.ctaNot}>{ctaNot}</span>
          </div>
        </div>

      </div>

      <div className={styles.ipucu}>
        <a
          className={styles.ipucuLink}
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
      </div>
    </>
  );
}

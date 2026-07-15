"use client";

import { useEffect, useState } from "react";
import styles from "./v2.module.css";

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

/* Yörünge geometrisi: 7 disiplin, tepeden saat yönünde.
   Koordinatlar modül kapsamında bir kez ve YUVARLANARAK hesaplanır — ham
   Math.cos/sin çıktısı sunucu ile istemcide farklı basılıp hydration
   mismatch üretiyor. */
const VB = 400;
const MERKEZ = VB / 2;
const R_DUGUM = 140;
const R_ETIKET = 0.435; // konteyner yüzdesi

const yuvarla = (n: number) => Math.round(n * 100) / 100;

const geometri = Array.from({ length: 7 }, (_, i) => {
  const rad = ((-90 + (i * 360) / 7) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    cx: yuvarla(MERKEZ + R_DUGUM * cos),
    cy: yuvarla(MERKEZ + R_DUGUM * sin),
    sol: yuvarla(50 + R_ETIKET * 100 * cos),
    ust: yuvarla(50 + R_ETIKET * 100 * sin),
  };
});

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

        {/* --- Sirkülasyon: yedi disiplin bir yörüngede, fikir aralarında --- */}
        <div
          className={`${styles.sag} ${statik ? styles.sagStatik : ""} ${styles.gir}`}
          style={{ animationDelay: "0.5s" }}
          aria-hidden="true"
        >
          <svg className={styles.yorungeSvg} viewBox={`0 0 ${VB} ${VB}`} fill="none">
            <g className={styles.yorungeDon}>
              <circle
                cx={MERKEZ}
                cy={MERKEZ}
                r="188"
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeWidth="1"
                strokeDasharray="1 8"
              />
            </g>

            <circle
              cx={MERKEZ}
              cy={MERKEZ}
              r={R_DUGUM}
              stroke="currentColor"
              strokeOpacity="0.2"
              strokeWidth="1"
            />
            <circle
              cx={MERKEZ}
              cy={MERKEZ}
              r="88"
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeWidth="1"
              strokeDasharray="2 10"
            />

            {!statik && (
              <line
                className={styles.kiris}
                x1={MERKEZ}
                y1={MERKEZ}
                x2={geometri[aktif].cx}
                y2={geometri[aktif].cy}
              />
            )}

            {geometri.map((g, i) => (
              <g key={i}>
                {i === aktif && (
                  <circle className={styles.hale} cx={g.cx} cy={g.cy} r="20" />
                )}
                <circle
                  cx={g.cx}
                  cy={g.cy}
                  r={i === aktif ? 5.5 : 3}
                  fill={i === aktif ? "#43d6a8" : "rgba(255,255,255,0.45)"}
                />
              </g>
            ))}

            <circle
              className={styles.cekirdekDisk}
              cx={MERKEZ}
              cy={MERKEZ}
              r="30"
            />
          </svg>

          {disiplinler.map((d, i) => (
            <span
              key={d.name}
              className={`${styles.etiket} ${i === aktif ? styles.etiketAktif : ""}`}
              style={{ left: `${geometri[i].sol}%`, top: `${geometri[i].ust}%` }}
            >
              {d.name}
            </span>
          ))}

          <span className={styles.merkezMark}>
            <svg width="22" height="22" viewBox="0 0 15 15" fill="none">
              <path
                d="M7.5 1.4 12.4 13.2 7.5 10.1 2.6 13.2Z"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
          </span>
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

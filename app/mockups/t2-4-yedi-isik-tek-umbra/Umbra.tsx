"use client";

import { useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import stil from "./umbra.module.css";

// three ~150KB gzip. İlk bundle'a girerse projenin <150KB bütçesini tek başına
// yer → ayrı chunk + yalnız istemci (WebGL zaten SSR'da yok).
const UmbraSahnesi = dynamic(
  () => import("./UmbraSahnesi").then((m) => m.UmbraSahnesi),
  { ssr: false },
);

type Props = {
  marka: string;
  etkinlik: string;
  yil: string;
  durum: string;
  lede: string;
  cta: string;
  ctaNot: string;
  ctaHref: string;
  navLinkleri: readonly { label: string; href: string }[];
  disiplinler: readonly string[];
};

export function Umbra({
  marka,
  etkinlik,
  yil,
  durum,
  lede,
  cta,
  ctaNot,
  ctaHref,
  navLinkleri,
  disiplinler,
}: Props) {
  // Başlık content.ts'ten türetiliyor: "Sirkülasyon Çalıştayı" → iki satır.
  const [ilkKelime, ...kalanlar] = etkinlik.split(" ");
  const ikinciSatir = kalanlar.join(" ");

  // Hover → o ışık güçlenir, yarıçapı küçülür (yarı-gölgesi keskinleşir).
  // setState YOK: sahne her karede bu ref'i okuyor, React render'ı dönmüyor.
  const vurguRef = useRef(-1);
  const seritRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Ters yön: sahne her karede ışıkların şiddetini buraya yolluyor, etiketler
  // kendi ışıklarıyla birlikte nefes alıyor. Yine setState yok.
  const bildir = useCallback((guc: number[]) => {
    for (let i = 0; i < guc.length; i++) {
      seritRef.current[i]?.style.setProperty("--isik", guc[i].toFixed(3));
    }
  }, []);

  return (
    <main className={stil.kok}>
      <UmbraSahnesi sinif={stil.tuval} vurguRef={vurguRef} bildir={bildir} />
      <div className={stil.gren} aria-hidden="true" />

      <header className={stil.ust}>
        <div className={stil.marka}>
          <span className={stil.markaIsaret} aria-hidden="true" />
          {marka}
        </div>
        <nav className={stil.nav}>
          {navLinkleri.map((l) => (
            <a key={l.href} className={stil.navLink} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <a className={stil.ustCta} href={ctaHref}>
          {cta}
        </a>
      </header>

      <div className={stil.orta}>
        <span className={`${stil.kicker} ${stil.gir}`} style={{ animationDelay: "0.1s" }}>
          <span className={stil.nabiz} aria-hidden="true" />
          {durum}
        </span>

        <h1 className={stil.baslik}>
          <span className={`${stil.baslikSatir} ${stil.gir}`} style={{ animationDelay: "0.2s" }}>
            {ilkKelime}
          </span>
          <span className={`${stil.baslikSatir} ${stil.gir}`} style={{ animationDelay: "0.32s" }}>
            <span className={stil.vurgu}>{ikinciSatir}</span>
            <span className={stil.yil}>{yil}</span>
          </span>
        </h1>

        <p className={`${stil.lede} ${stil.gir}`} style={{ animationDelay: "0.44s" }}>
          {lede}
        </p>

        <div className={`${stil.altBlok} ${stil.gir}`} style={{ animationDelay: "0.56s" }}>
          <a className={stil.cta} href={ctaHref}>
            {cta}
            <span className={stil.ctaOk} aria-hidden="true">
              →
            </span>
          </a>
          <span className={stil.ctaNot}>{ctaNot}</span>
        </div>
      </div>

      <div className={`${stil.serit} ${stil.gir}`} style={{ animationDelay: "0.72s" }}>
        {disiplinler.map((d, i) => (
          <button
            key={d}
            type="button"
            ref={(el) => {
              seritRef.current[i] = el;
            }}
            className={stil.disiplin}
            onPointerEnter={() => {
              vurguRef.current = i;
            }}
            onPointerLeave={() => {
              vurguRef.current = -1;
            }}
            onFocus={() => {
              vurguRef.current = i;
            }}
            onBlur={() => {
              vurguRef.current = -1;
            }}
          >
            {d}
            <span className={stil.disiplinCizgi} aria-hidden="true" />
          </button>
        ))}
      </div>
    </main>
  );
}

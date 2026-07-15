"use client";

import { useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import stil from "./han.module.css";

// three ~150KB gzip: ilk bundle'a girerse projenin bütçesini tek başına yer.
const HanSahnesi = dynamic(() => import("./HanSahnesi").then((m) => m.HanSahnesi), {
  ssr: false,
});

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

export function HanAvlusu({
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
  const [ilkKelime, ...kalan] = etkinlik.split(" ");
  const ikinciSatir = kalan.join(" ");

  const etiketRef = useRef<(HTMLDivElement | null)[]>([]);

  /* Sahne her karede 7 gözün EKRAN konumunu yolluyor. setState YOK: doğrudan
     transform + custom property yazılıyor, React render'ı hiç dönmüyor.
     Yalnız transform ve opacity — layout animasyonu yok. */
  const bildir = useCallback(
    (d: { x: number; y: number; o: number; isik: number; gor: boolean }[]) => {
      for (let i = 0; i < d.length; i++) {
        const el = etiketRef.current[i];
        if (!el) continue;
        const k = d[i];
        el.style.transform = `translate3d(${k.x.toFixed(1)}px, ${k.y.toFixed(1)}px, 0) scale(${k.o.toFixed(3)})`;
        el.style.setProperty("--isik", k.isik.toFixed(3));
        el.style.setProperty("--gor", k.gor ? "1" : "0");
      }
    },
    [],
  );

  return (
    <main className={stil.kok}>
      <HanSahnesi sinif={stil.tuval} bildir={bildir} />
      <div className={stil.gren} aria-hidden="true" />

      {/* Disiplin adları: uzak kanadın üst kat gözlerine izdüşürülüyor, sırayla.
          Avlu çeperine dizilmiş DEĞİL — tek kanat, tek doğru, bir liste. */}
      <div className={stil.gozler} aria-hidden="true">
        {disiplinler.map((d, i) => (
          <div
            key={d}
            ref={(el) => {
              etiketRef.current[i] = el;
            }}
            className={stil.goz}
          >
            <span className={stil.gozIc}>
              {d}
              <span className={stil.gozCizgi} />
            </span>
          </div>
        ))}
      </div>

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

      {/* Metin avlu boşluğunun üstünde: altında 6.9 m karanlık taş, arkasında
          yükseklik sisinin dibi. Panel/scrim yok — gerek de yok. */}
      <div className={stil.orta}>
        <span className={`${stil.kicker} ${stil.gir}`} style={{ animationDelay: "0.1s" }}>
          <span className={stil.nabiz} aria-hidden="true" />
          {durum}
        </span>

        <h1 className={stil.baslik}>
          <span className={`${stil.satir} ${stil.gir}`} style={{ animationDelay: "0.2s" }}>
            {ilkKelime}
          </span>
          <span className={`${stil.satir} ${stil.gir}`} style={{ animationDelay: "0.32s" }}>
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

      {/* Dar ekranda izdüşüm çalışmaz (uzak kanat kadraja sığmaz) → aynı
          adlar, aynı sıra, korkuluğun üstünde şerit olarak. */}
      <div className={stil.serit} aria-hidden="true">
        {disiplinler.map((d) => (
          <span key={d} className={stil.seritAd}>
            {d}
          </span>
        ))}
      </div>
    </main>
  );
}

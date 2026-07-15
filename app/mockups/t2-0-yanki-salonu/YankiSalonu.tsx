"use client";

import { useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import stil from "./salon.module.css";
import { ETIKET } from "./yanki";

// three ~150KB gzip. İlk bundle'a girerse projenin <150KB bütçesini tek başına
// yer → ayrı chunk + yalnız istemci.
const SalonSahnesi = dynamic(
  () => import("./SalonSahnesi").then((m) => m.SalonSahnesi),
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
  disiplinler: readonly { ad: string; not: string }[];
};

export function YankiSalonu({
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

  const etiketRef = useRef<(HTMLElement | null)[]>([]);

  // Sahne her karede vuruşu buraya yolluyor. setState YOK: doğrudan custom
  // property yazılıyor, React render'ı hiç dönmüyor.
  const bildir = useCallback((isik: number[]) => {
    for (let i = 0; i < isik.length; i++) {
      etiketRef.current[i]?.style.setProperty("--isik", isik[i].toFixed(3));
    }
  }, []);

  const sol = disiplinler
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => ETIKET[i].yan === -1);
  const sag = disiplinler
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => ETIKET[i].yan === 1);

  const rung = ({ d, i }: { d: { ad: string; not: string }; i: number }) => (
    <span
      key={d.ad}
      ref={(el) => {
        etiketRef.current[i] = el;
      }}
      className={stil.etiket}
      style={
        {
          "--y": `${ETIKET[i].yuzde}%`,
          "--olcek": ETIKET[i].olcek,
          "--taban": ETIKET[i].taban,
          "--gecikme": `${0.9 + i * 0.07}s`,
        } as React.CSSProperties
      }
    >
      <span className={stil.etiketAd}>{d.ad}</span>
      {/* Vuruşta salona doğru uzayan çentik: yanıtın gelişi. transform-only. */}
      <span className={stil.centik} aria-hidden="true" />
      {/* note: hover/focus'ta. Sahnenin üstünde kalıcı metin yığmıyoruz. */}
      <span className={stil.etiketNot}>{d.not}</span>
    </span>
  );

  return (
    <main className={stil.kok}>
      <SalonSahnesi sinif={stil.tuval} bildir={bildir} />
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
        <a className={stil.ustCta} href={ctaHref} target="_blank" rel="noreferrer">
          {cta}
        </a>
      </header>

      {/* Merdiven: nişin YANI ve DERİNLİK SIRASI korunuyor, aralık/boyut
          perspektifle daralıyor. Merkez sütunun tamamen dışında. */}
      <div className={`${stil.merdiven} ${stil.merdivenSol}`}>{sol.map(rung)}</div>
      <div className={`${stil.merdiven} ${stil.merdivenSag}`}>{sag.map(rung)}</div>

      <div className={stil.orta}>
        <span className={`${stil.kicker} ${stil.gir}`} style={{ animationDelay: "0.1s" }}>
          <span className={stil.nabiz} aria-hidden="true" />
          {durum}
        </span>

        <h1 className={stil.baslik}>
          <span className={`${stil.baslikSatir} ${stil.gir}`} style={{ animationDelay: "0.22s" }}>
            {ilkKelime}
          </span>
          <span className={`${stil.baslikSatir} ${stil.gir}`} style={{ animationDelay: "0.34s" }}>
            <span className={stil.vurgu}>{ikinciSatir}</span>
            <span className={stil.yil}>{yil}</span>
          </span>
        </h1>

        <p className={`${stil.lede} ${stil.gir}`} style={{ animationDelay: "0.46s" }}>
          {lede}
        </p>

        <div className={`${stil.altBlok} ${stil.gir}`} style={{ animationDelay: "0.58s" }}>
          <a className={stil.cta} href={ctaHref} target="_blank" rel="noreferrer">
            {cta}
            <span className={stil.ctaOk} aria-hidden="true">
              →
            </span>
          </a>
          <span className={stil.ctaNot}>{ctaNot}</span>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import stil from "./sesGovdesi.module.css";

// three ~150KB gzip → ayrı chunk + yalnız istemci. ssr:false ZORUNLU.
const SesGovdesiSahnesi = dynamic(
  () => import("./SesGovdesiSahnesi").then((m) => m.SesGovdesiSahnesi),
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

export function SesGovdesi({
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

  const seritRef = useRef<(HTMLSpanElement | null)[]>([]);

  // Sahne her karede 7 telin genliğini buraya yolluyor. setState YOK: doğrudan
  // custom property yazılıyor, React render'ı hiç dönmüyor.
  const bildir = useCallback((genlik: number[]) => {
    for (let i = 0; i < genlik.length; i++) {
      seritRef.current[i]?.style.setProperty("--genlik", genlik[i].toFixed(3));
    }
  }, []);

  return (
    <main className={stil.kok}>
      <SesGovdesiSahnesi sinif={stil.tuval} bildir={bildir} />
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

        {/* Şerit .orta'nın İÇİNDE ve akışta: mutlak konumlandırılıp `calc(top +
            22.4rem)` gibi sihirli bir sayıyla hizalandığında CTA notunun üstüne
            biniyordu (ölçüldü: not %57-59, şerit %59-61). Akışta duran bir
            kardeş hiçbir ekran boyunda, hiçbir font yüklenme sırasında
            çakışamaz — sihirli sayı yok. */}
        <div className={`${stil.serit} ${stil.gir}`} style={{ animationDelay: "0.72s" }}>
          {disiplinler.map((d, i) => (
            <span
              key={d}
              ref={(el) => {
                seritRef.current[i] = el;
              }}
              className={stil.disiplin}
            >
              {d}
              <span className={stil.disiplinCizgi} aria-hidden="true" />
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}

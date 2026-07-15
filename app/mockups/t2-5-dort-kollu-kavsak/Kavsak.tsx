"use client";

import { useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import stil from "./kavsak.module.css";

// three ~150KB gzip → ayrı chunk + yalnız istemci. ssr:false ZORUNLU:
// sahne document/WebGL'e kuruluyor, sunucuda karşılığı yok.
const KavsakSahnesi = dynamic(
  () => import("./KavsakSahnesi").then((m) => m.KavsakSahnesi),
  { ssr: false },
);

type Disiplin = { ad: string; not: string };

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
  kolDisiplinleri: readonly Disiplin[]; // 4 kol: batı, kuzey, doğu, güney
  karanliktakiler: readonly Disiplin[]; // kalan 3
};

/** Kolların dünyadaki yönü — etiketin yanındaki işaret. */
const OK = ["←", "↑", "→", "↓"];

export function Kavsak({
  marka,
  etkinlik,
  yil,
  durum,
  lede,
  cta,
  ctaNot,
  ctaHref,
  navLinkleri,
  kolDisiplinleri,
  karanliktakiler,
}: Props) {
  const [ilkKelime, ...kalanlar] = etkinlik.split(" ");
  const ikinciSatir = kalanlar.join(" ");

  const kolRef = useRef<(HTMLSpanElement | null)[]>([]);

  // Sahne her karede kolların aydınlığını buraya yolluyor. setState YOK:
  // doğrudan custom property → React render'ı hiç dönmüyor.
  const bildir = useCallback((kollar: number[]) => {
    for (let i = 0; i < kollar.length; i++) {
      kolRef.current[i]?.style.setProperty("--isik", kollar[i].toFixed(3));
    }
  }, []);

  return (
    <main className={stil.kok}>
      <KavsakSahnesi sinif={stil.tuval} bildir={bildir} />
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
          <a className={stil.cta} href={ctaHref}>
            {cta}
            <span className={stil.ctaOk} aria-hidden="true">→</span>
          </a>
          <span className={stil.ctaNot}>{ctaNot}</span>
        </div>
      </div>

      {/* Dört kol görünür, üç disiplin karanlıkta: hepsini aynı anda göremezsin.
          Kolların parlaklığı sahnenin ışık denkleminden geliyor — batı ağzı en
          aydınlık, doğu en sönük. Fare bir ağza döndükçe o kol açılıyor. */}
      <div className={`${stil.serit} ${stil.gir}`} style={{ animationDelay: "0.74s" }}>
        <div className={stil.kollar}>
          {kolDisiplinleri.map((d, i) => (
            <span
              key={d.ad}
              ref={(el) => {
                kolRef.current[i] = el;
              }}
              className={stil.kol}
              title={d.not}
            >
              <span className={stil.kolOk} aria-hidden="true">{OK[i]}</span>
              {d.ad}
              <span className={stil.kolCizgi} aria-hidden="true" />
            </span>
          ))}
        </div>
        <span className={stil.ayrac} aria-hidden="true" />
        <div className={stil.karanlik}>
          {karanliktakiler.map((d) => (
            <span key={d.ad} className={stil.sonuk} title={d.not}>
              {d.ad}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}

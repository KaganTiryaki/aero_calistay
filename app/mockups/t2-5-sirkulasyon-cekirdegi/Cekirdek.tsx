"use client";

import dynamic from "next/dynamic";
import stil from "./cekirdek.module.css";

// three ~150KB gzip. İlk bundle'a girerse projenin <150KB bütçesini tek başına
// yer → ayrı chunk + yalnız istemci (ssr:false ZORUNLU: sahne document'e dokunur).
const CekirdekSahnesi = dynamic(
  () => import("./CekirdekSahnesi").then((m) => m.CekirdekSahnesi),
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

export function Cekirdek({
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

  return (
    <main className={stil.kok}>
      {/* Sahne UI'ın ARKASINDA yaşar ve kadrajın tamamını doldurur: metin
          sahnenin yanına kaçmıyor, şaftın dibinde duruyor. */}
      <CekirdekSahnesi sinif={stil.tuval} disiplinler={disiplinler} />
      <div className={stil.vinyet} aria-hidden="true" />
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

      <div className={stil.dip}>
        <span className={`${stil.kicker} ${stil.gir}`} style={{ animationDelay: "0.1s" }}>
          <span className={stil.nabiz} aria-hidden="true" />
          {durum}
        </span>

        <h1 className={stil.baslik}>
          <span
            className={`${stil.baslikSatir} ${stil.gir}`}
            style={{ animationDelay: "0.2s" }}
          >
            {ilkKelime}
          </span>
          <span
            className={`${stil.baslikSatir} ${stil.gir}`}
            style={{ animationDelay: "0.32s" }}
          >
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
    </main>
  );
}

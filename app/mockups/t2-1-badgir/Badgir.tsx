"use client";

import dynamic from "next/dynamic";
import stil from "./badgir.module.css";

// three ~150KB gzip. İlk bundle'a girerse projenin bütçesini tek başına yer
// → ayrı chunk + yalnız istemci (ZORUNLU).
const BadgirSahnesi = dynamic(
  () => import("./BadgirSahnesi").then((m) => m.BadgirSahnesi),
  { ssr: false },
);

type Props = {
  marka: string;
  etkinlik: string;
  yil: string;
  durum: string;
  cta: string;
  ctaNot: string;
  ctaHref: string;
  navLinkleri: readonly { label: string; href: string }[];
  disiplinler: readonly string[];
};

export function Badgir({
  marka,
  etkinlik,
  yil,
  durum,
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
      <BadgirSahnesi sinif={stil.tuval} />
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
        <span className={`${stil.kicker} ${stil.gir}`} style={{ animationDelay: "0.15s" }}>
          <span className={stil.nabiz} aria-hidden="true" />
          {durum}
        </span>

        <h1 className={stil.baslik}>
          <span className={`${stil.baslikSatir} ${stil.gir}`} style={{ animationDelay: "0.26s" }}>
            {ilkKelime}
          </span>
          <span className={`${stil.baslikSatir} ${stil.gir}`} style={{ animationDelay: "0.38s" }}>
            <span className={stil.vurgu}>{ikinciSatir}</span>
            <span className={stil.yil}>{yil}</span>
          </span>
        </h1>

        {/* Yedi disiplin = yukarıdaki yedi kanat aralığı. Hava hepsinden birden
            geçiyor, hiçbirinde durmuyor. */}
        <ul className={`${stil.serit} ${stil.gir}`} style={{ animationDelay: "0.5s" }}>
          {disiplinler.map((d) => (
            <li key={d} className={stil.disiplin}>
              {d}
            </li>
          ))}
        </ul>

        <div className={`${stil.altBlok} ${stil.gir}`} style={{ animationDelay: "0.62s" }}>
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

import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

import { disciplines, hero, nav, site } from "@/lib/content";
import { PerdeKanvas } from "./PerdeKanvas";
import s from "./perde.module.css";

/*
 * PERDE ARKASI
 *
 * Karagöz'ün deri figürleri ile Platon'un mağarası aynı optik olayın iki
 * okuması: ışık bir cismin etrafından geçer, biz cismi değil geçen ışığı
 * görürüz. Beşeri bilimlerin tam merkezi bu — tarihi de, inancı da, başkasının
 * zihnini de yalnızca perdeye düşen izinden okuruz.
 *
 * Sirkülasyon buradan çıkıyor: siluetler perdenin arkasında yatay sürükleniyor,
 * birbirinin İÇİNDEN geçiyor ve iki siluetin örtüştüğü yerde transmisyon
 * çarpımı (T = Π(1−aᵢ)) en derin teal'e iniyor. Yani sentez: iki disiplinin
 * çakışmasından doğan, ikisine de ait olmayan üçüncü bir form. Disiplinler bir
 * çemberin üstüne dizilmiyor; birbirinin içinden geçiyorlar.
 */

// Türkçe için latin-ext ZORUNLU: İ ı ş ğ ç ö ü aksi halde tofu.
const display = Fraunces({
  subsets: ["latin", "latin-ext"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--perde-display",
  display: "swap",
});

const govde = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--perde-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--perde-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `Perde Arkası · ${site.event} ${site.year}`,
};

export default function PerdeArkasiSayfasi() {
  return (
    <div className={`${s.sahne} ${display.variable} ${govde.variable} ${mono.variable}`}>
      <div className={s.kanvas}>
        <PerdeKanvas />
      </div>

      <div className={s.ui}>
        <header className={s.nav}>
          <span className={s.mark}>{site.school}</span>
          <span className={s.markAlt}>{site.navMark}</span>
          <nav className={s.links}>
            {nav.links.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <a className={s.navCta} href={nav.cta.href}>
            {nav.cta.label}
          </a>
        </header>

        <main className={s.orta}>
          <p className={s.kicker}>{hero.status.toLocaleUpperCase("tr")}</p>
          <h1 className={s.baslik}>
            {site.event}
            <span className={s.yil}>{site.year}</span>
          </h1>
          <a className={s.cta} href={site.applyUrl}>
            {hero.cta}
          </a>
          <p className={s.note}>{hero.ctaNote}</p>
        </main>

        <ul className={s.serit}>
          {disciplines.map((d) => (
            <li key={d.name}>{d.name.toLocaleUpperCase("tr")}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

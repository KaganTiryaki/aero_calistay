"use client";

import dynamic from "next/dynamic";
import { disciplines, hero, nav, site } from "@/lib/content";
import s from "./katlanma.module.css";

// three ~150KB gzip: ilk bundle'a girerse projenin <150KB bütçesini tek başına
// yer. ssr:false ZORUNLU — sahne zaten WebGL, sunucuda çizilecek bir şey yok.
const KatlanmaSahnesi = dynamic(() => import("./KatlanmaSahnesi"), { ssr: false });

const buyuk = (t: string) => t.toLocaleUpperCase("tr");

export function KatlanmaHero() {
  return (
    <section className={s.sahne}>
      <KatlanmaSahnesi />

      <header className={s.ust}>
        <span className={s.marka}>{buyuk(site.school)}</span>
        <nav className={s.baglar}>
          {nav.links.map((l) => (
            <a key={l.href} className={s.bag} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
      </header>

      <div className={s.orta}>
        <p className={s.kicker}>
          <span className={s.nokta} aria-hidden="true" />
          {buyuk(hero.status)}
        </p>

        <h1 className={s.baslik}>
          {site.event} <span className={s.yil}>{site.year}</span>
        </h1>

        <a className={s.cta} href={site.applyUrl} target="_blank" rel="noreferrer">
          {hero.cta}
        </a>
        <p className={s.not}>{hero.ctaNote}</p>
      </div>

      <div className={s.serit}>
        {disciplines.map((d, i) => (
          <span key={d.name}>
            {i > 0 && <span className={s.ayrac}>·&nbsp;&nbsp;</span>}
            {buyuk(d.name)}
          </span>
        ))}
      </div>
    </section>
  );
}

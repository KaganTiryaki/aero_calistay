import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/content";

/* --------------------------------------------------------------------------
   Hero konsept seçim ekranı — iç kullanım (indexlenmez).
   Tasarım yarışı değil: sade açık zemin, koyu teal metin, cyan link aksanı.
   Palet tek kaynak: @aero_cal Instagram.

   Not: metinler normalde lib/content.ts'te durur; burası kalıcı bir site
   bölümü değil, seçim yapıldıktan sonra silinecek geçici bir vitrin —
   bu yüzden konsept listesi dosya içinde tutuluyor.
   Tipografi: kök layout'un font değişkenleri (latin + latin-ext) kullanılır.
   -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: `Hero Konseptleri · ${site.event} ${site.year}`,
  robots: { index: false, follow: false },
};

type Concept = {
  slug: string;
  name: string;
  blurb: string;
};

const concepts: Concept[] = [
  {
    slug: "pop",
    name: "POP ŞOK",
    blurb:
      "Parlak cyan gökyüzünde, beyaz yüzlü ve nane→teal derinlikli, DOM'da 26 kopyadan kurulmuş GERÇEK 3B “SİRKÜLASYON” tipografisi — fareyle döndürülebilen, hız çizgileriyle çevrelenmiş bir pop poster.",
  },
  {
    slug: "gokyuzu",
    name: "Hale",
    blurb:
      "Uçağın üstündeki sabah gökyüzü: tek güneş tepeden vurur, dev Didone “SİRKÜLASYON” ışığın önünde koyu bir siluet gibi durur, altında bulut denizi ve yavaşça dönen eşmerkezli bir hale halkası nefes alır.",
  },
  {
    slug: "akis",
    name: "AKIŞ — Sıvı Alan",
    blurb:
      "Parlak cyan bir sıvı alan; sayfadaki her harfi ve her düğmeyi katı bir cisim olarak okuyup etraflarından dolaşıyor, arkalarında iz bırakıyor — tipografi akıntının üstünde durmuyor, akıntının içinde duruyor ve onu yarıyor.",
  },
  {
    slug: "geometri",
    name: "KESİT",
    blurb:
      "SİRKÜLASYON ve ÇALIŞTAYI '26, altı düz renk şeridinden kurulu bir merdivenin içinde yatay dilimlere kesilmiş devasa bir grotesk poster: harfin rengi şerit sınırında ortasından değişiyor, dilimler imleçle birbirinin üstünden kayıp sirküle ediyor, durunca tek bir keskin kelimeye oturuyor.",
  },
];

/* Kök layout koyu; bu sayfa açık zemini kendi üstüne serer.
   SiteBackground z-0, ScrollProgress z-90/91 → z-index 100 hepsini kapatır. */
const css = `
.mx-root {
  --sky: #22b8dc;
  --sky-2: #35c8e6;
  --aqua: #2fd3d0;
  --mint: #43d6a8;
  --teal: #0e4a46;
  --paper: #ffffff;
  --wash: #eff9fc;
  --line: rgba(14, 74, 70, 0.14);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);

  position: relative;
  z-index: 100;
  min-height: 100vh;
  min-height: 100svh;
  background: linear-gradient(180deg, var(--paper) 0%, var(--wash) 100%);
  color: var(--teal);
  font-family: var(--font-hanken), system-ui, sans-serif;
  padding: clamp(3.5rem, 9vw, 7rem) clamp(1.25rem, 5vw, 2.5rem);
}

.mx-shell {
  max-width: 60rem;
  margin: 0 auto;
}

.mx-kicker {
  font-family: var(--font-plex-mono), ui-monospace, monospace;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--sky);
  margin: 0 0 0.9rem;
}

.mx-title {
  font-family: var(--font-fraunces), Georgia, serif;
  font-size: clamp(2rem, 5.5vw, 3.25rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  margin: 0;
}

.mx-lede {
  max-width: 34rem;
  margin: 1rem 0 0;
  font-size: clamp(1rem, 1.6vw, 1.125rem);
  line-height: 1.6;
  color: rgba(14, 74, 70, 0.72);
}

.mx-rule {
  height: 2px;
  margin: clamp(2.25rem, 5vw, 3.25rem) 0 0;
  border: 0;
  background: linear-gradient(90deg, var(--sky), var(--aqua) 55%, var(--mint));
  opacity: 0.8;
}

.mx-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.mx-item + .mx-item {
  border-top: 1px solid var(--line);
}

.mx-card {
  display: grid;
  grid-template-columns: 2.5rem 1fr;
  gap: 0 clamp(0.75rem, 2vw, 1.5rem);
  align-items: start;
  padding: clamp(1.75rem, 3.5vw, 2.5rem) clamp(0.5rem, 1.5vw, 1rem);
  text-decoration: none;
  color: inherit;
  border-radius: 0.75rem;
  transition: background-color 0.6s var(--ease), transform 0.6s var(--ease);
}

.mx-card:hover,
.mx-card:focus-visible {
  background-color: rgba(47, 211, 208, 0.09);
  transform: translateX(4px);
}

.mx-card:focus-visible {
  outline: 2px solid var(--sky);
  outline-offset: 2px;
}

.mx-num {
  font-family: var(--font-plex-mono), ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.9;
  color: rgba(14, 74, 70, 0.4);
  font-variant-numeric: tabular-nums;
}

.mx-name {
  font-family: var(--font-fraunces), Georgia, serif;
  font-size: clamp(1.6rem, 4vw, 2.5rem);
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin: 0;
}

.mx-blurb {
  margin: 0.7rem 0 0;
  max-width: 44rem;
  font-size: clamp(0.95rem, 1.4vw, 1.0625rem);
  line-height: 1.65;
  color: rgba(14, 74, 70, 0.75);
}

.mx-open {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 1.1rem;
  font-family: var(--font-plex-mono), ui-monospace, monospace;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  color: var(--sky);
}

.mx-arrow {
  display: inline-block;
  transition: transform 0.6s var(--ease);
}

.mx-card:hover .mx-arrow,
.mx-card:focus-visible .mx-arrow {
  transform: translateX(5px);
}

@media (prefers-reduced-motion: reduce) {
  .mx-card,
  .mx-arrow {
    transition: none;
  }
  .mx-card:hover,
  .mx-card:focus-visible {
    transform: none;
  }
  .mx-card:hover .mx-arrow,
  .mx-card:focus-visible .mx-arrow {
    transform: none;
  }
}
`;

export default function MockupsIndexPage() {
  return (
    <div className="mx-root">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="mx-shell">
        <header>
          <p className="mx-kicker">Seçim ekranı</p>
          <h1 className="mx-title">AERO ’26 — Hero Konseptleri</h1>
          <p className="mx-lede">
            Dördünü de gez, birini seç. Seçilen yön sitenin tamamı için temel
            olacak.
          </p>
          <hr className="mx-rule" />
        </header>

        <ul className="mx-list">
          {concepts.map((concept, i) => (
            <li key={concept.slug} className="mx-item">
              <Link href={`/mockups/${concept.slug}`} className="mx-card">
                <span className="mx-num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <h2 className="mx-name">{concept.name}</h2>
                  <p className="mx-blurb">{concept.blurb}</p>
                  <span className="mx-open">
                    Aç <span className="mx-arrow">→</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

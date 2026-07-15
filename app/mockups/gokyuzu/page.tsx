import { Jost, Libre_Bodoni } from "next/font/google";

import { hero, nav, site } from "@/lib/content";

import { ParallaxRoot } from "./ParallaxRoot";
import styles from "./gokyuzu.module.css";

/* Didone display + geometrik grotesk: film jeneriği tipografisi.
   latin-ext → İ ı ş ğ ç ö ü (Türkçe şart).
   Libre Bodoni tercih edildi: Bodoni Moda'da büyük harf aksanları (İ noktası,
   Ü umlaut) display boyutunda harften kopuk yüzüyordu — "SİRKÜLASYON" kırılıyordu.
   Libre Bodoni aynı Didone karakterini korur, aksanları doğru oturur. */
const display = Libre_Bodoni({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--gk-display",
});

const ui = Jost({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--gk-ui",
});

/* Türkçe büyük harf (i → İ) sunucu ve istemcide aynı sonucu verir → hydration güvenli. */
const upper = (s: string) => s.toLocaleUpperCase("tr");

const words = site.event.split(" ");
const titleWord = upper(words[0]);
const restWords = words.slice(1).join(" ");
const subtitle = upper(restWords ? `${restWords} ${site.year}` : site.year);

export default function GokyuzuHero() {
  return (
    <ParallaxRoot className={`${styles.root} ${display.variable} ${ui.variable}`}>
      {/* ---------- atmosfer ---------- */}
      <div className={styles.sky} aria-hidden />

      <div className={styles.layerFar} aria-hidden>
        <div className={styles.sun} />
        <div className={styles.raysWide} />
        <div className={styles.rays} />
        <div className={styles.flare} />
      </div>

      <div className={styles.layerGlory} aria-hidden>
        <div className={styles.glory}>
          <svg
            className={styles.glorySvg}
            viewBox="0 0 1000 1000"
            fill="none"
            focusable="false"
          >
            <defs>
              <radialGradient id="gk-glory-glow" cx="50%" cy="50%" r="50%">
                <stop offset="52%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="76%" stopColor="#ffffff" stopOpacity="0.14" />
                <stop offset="90%" stopColor="#ffffff" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>

            <circle cx="500" cy="500" r="500" fill="url(#gk-glory-glow)" />

            {/* sabit halkalar */}
            <g stroke="#ffffff" fill="none">
              <circle cx="500" cy="500" r="232" strokeOpacity="0.22" vectorEffect="non-scaling-stroke" />
              <circle cx="500" cy="500" r="316" strokeOpacity="0.14" vectorEffect="non-scaling-stroke" />
              <circle cx="500" cy="500" r="398" strokeOpacity="0.09" vectorEffect="non-scaling-stroke" />
            </g>

            {/* dolaşan yaylar — sirkülasyon */}
            <g className={styles.spinSlow} stroke="#ffffff" fill="none">
              <circle
                cx="500"
                cy="500"
                r="356"
                strokeOpacity="0.3"
                strokeDasharray="700 1537"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
            <g className={styles.spinMid} stroke="#ffffff" fill="none">
              <circle
                cx="500"
                cy="500"
                r="274"
                strokeOpacity="0.24"
                strokeDasharray="430 1292"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
            {/* ince taksimat halkası */}
            <g className={styles.spinTicks} stroke="#ffffff" fill="none">
              <circle
                cx="500"
                cy="500"
                r="470"
                strokeOpacity="0.3"
                strokeDasharray="2 26"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </svg>
        </div>
      </div>

      <div className={styles.layerMid} aria-hidden>
        <div className={`${styles.band} ${styles.band1}`} />
        <div className={`${styles.band} ${styles.band2}`} />
        <div className={`${styles.band} ${styles.band3}`} />
        <div className={`${styles.band} ${styles.band4}`} />
      </div>

      <div className={styles.layerNear} aria-hidden>
        <div className={styles.seaGlow} />
        <div className={styles.seaFar} />
        <div className={styles.seaNear} />
      </div>

      {/* ---------- içerik ---------- */}
      <header className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles.disc} aria-hidden>
            <span className={styles.discRing} />
            <span className={styles.discDot} />
          </span>
          <span className={styles.brandName}>{site.school}</span>
        </div>

        <nav className={styles.navLinks} aria-label={site.navMark}>
          {nav.links.map((link) => (
            <a key={link.href} className={styles.navLink} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <div className={styles.lockup}>
        <div className={styles.eyebrow}>
          <span className={styles.rule} aria-hidden />
          <span className={styles.status}>
            <span className={styles.dot} aria-hidden />
            {upper(hero.status)}
          </span>
          <span className={`${styles.rule} ${styles.ruleR}`} aria-hidden />
        </div>

        <div className={styles.titleWrap}>
          <h1 className={styles.title} aria-label={`${site.school} ${site.event} ${site.year}`}>
            <span aria-hidden>{titleWord}</span>
          </h1>
          <div className={styles.titleGlare} aria-hidden />
          <div className={styles.subtitle} aria-hidden>
            {subtitle}
          </div>
        </div>

        <div className={styles.ctaRow}>
          <a
            className={styles.cta}
            href={site.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.ctaLabel}>{hero.cta}</span>
            <svg
              className={styles.ctaArrow}
              width="16"
              height="10"
              viewBox="0 0 16 10"
              fill="none"
              aria-hidden
            >
              <path
                d="M0 5h14M10 1l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <span className={styles.ctaNote}>{hero.ctaNote}</span>
        </div>
      </div>

      <div className={styles.footerRow}>
        <a
          className={styles.handle}
          href={site.socials.instagram}
          target="_blank"
          rel="noopener noreferrer"
        >
          {site.socials.instagramHandle}
        </a>
        <span className={styles.scrollHint} aria-hidden>
          <span />
        </span>
        <a
          className={styles.handle}
          href={site.socials.tiktok}
          target="_blank"
          rel="noopener noreferrer"
        >
          {site.socials.tiktokHandle}
        </a>
      </div>

      <div className={styles.vignette} aria-hidden />
      <div className={styles.grain} aria-hidden />
    </ParallaxRoot>
  );
}

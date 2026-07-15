import type { Metadata } from "next";
import Link from "next/link";
import { Newsreader, Archivo, IBM_Plex_Mono } from "next/font/google";
import styles from "./index.module.css";

// latin-ext ZORUNLU: İ ı ş ğ ç ö ü.
const display = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--font-display",
  display: "swap",
});
const body = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AERO '26 — Sahneler",
};

/**
 * Seçim ekranı. Tasarım yarışı değil — sade kalsın, sahneler konuşsun.
 * Değerlendirme notları Claude'un kendi gözlemi: 12 sahnenin hepsi gerçek
 * GPU'da (GTX 1650) açılıp görüldü, hiçbiri bozuk değil.
 */
type Sahne = {
  slug: string;
  isim: string;
  fikir: string;
  not: string;
  kademe: "guclu" | "orta" | "zayif";
};

const SAHNELER: Sahne[] = [
  {
    slug: "3-sarnic-akintisi",
    isim: "Sarnıç Akıntısı",
    fikir:
      "Sudan yükselen sütunlar, sis, yansımalar. Yerebatan'ın altında duruyorsun; sütunlar siste kayboluyor.",
    not: "Gerçek derinlik, doğru palet, UI mekânın tam içinde.",
    kademe: "guclu",
  },
  {
    slug: "3-mukarnas-tavani",
    isim: "Mukarnas Tavanı",
    fikir:
      "Anadolu mukarnas tonozu kareyi dolduruyor; ışık hücrelerin arasından geçiyor, hiçbirinde kalmıyor.",
    not: "Kültürel olarak gerçekten AERO'ya ait. Sanat+Tarih+Teoloji+geometri tek yüzeyde.",
    kademe: "guclu",
  },
  {
    slug: "2-esik-tasi",
    isim: "Eşik",
    fikir:
      "Koyu teal söveler, aralarından ışığa açılan bir eşik. Girmeden önceki an.",
    not: "Mimari derinlik ve tek ışık kaynağı; UI açıklığın içinde duruyor.",
    kademe: "guclu",
  },
  {
    slug: "0-asinma",
    isim: "Aşınma",
    fikir:
      "Ufka uzanan aşınmış taş yüzey. Sirkülasyon bir zaman olayı: tortu, tekrar, iz.",
    not: "Sahne kareyi dolduruyor, UI tam ortasında. Harmanlama en temizlerinden.",
    kademe: "guclu",
  },
  {
    slug: "1-perde-arkasi",
    isim: "Perde Arkası",
    fikir:
      "Arkadan aydınlatılmış bez; arkasında siluetler birbirinin içinden geçiyor, çakıştıklarında üçüncü bir form doğuyor.",
    not: "Metin bezin üstüne basılı (multiply) — perde hilesi yapısal olarak imkânsız. Siluetler figürden çok soyut form gibi okuyor.",
    kademe: "guclu",
  },
  {
    slug: "3-yedi-esik",
    isim: "Yedi Eşik",
    fikir:
      "Birbirinin içinden geçen yedi kapı. Enfilad: her disiplin bir eşik, hepsi aynı bakışta.",
    not: "Fikir güçlü, perspektif gerçek. En dipteki kapı simsiyah — palet dışı, düzeltilmeli.",
    kademe: "orta",
  },
  {
    slug: "1-yalayan-isik",
    isim: "Yalayan Işık",
    fikir:
      "Parşömen üzerinde yalayan ışık; kabartma metin izleri ortaya çıkıp kayboluyor. Palimpsest.",
    not: "Görsel olarak en çarpıcılarından AMA palet bej/kum — AERO'nun teal'i değil. Metnin arkasında düz alan var.",
    kademe: "orta",
  },
  {
    slug: "2-odunc-fisi",
    isim: "Ödünç Fişi",
    fikir:
      "Kütüphane ödünç kartı ve damgalar. Kütüphanecilikte 'sirkülasyon' zaten ödünç verme sisteminin adı.",
    not: "Fikir zekice, isim birebir temayla örtüşüyor. Uygulama dağınık: damgalar üst üste binmiş.",
    kademe: "orta",
  },
  {
    slug: "3-cekmece-odasi",
    isim: "Çekmece Odası",
    fikir:
      "Kart kataloğu çekmeceleriyle kaplı oda. Fikirlerin fişlenip dolaştığı yer.",
    not: "Perspektif doğru ama çok soluk ve steril; kontrast yok.",
    kademe: "orta",
  },
  {
    slug: "0-katlanma",
    isim: "Katlanma",
    fikir: "Katlanmış kağıt yüzeyi; kat izleri ışığı kırıyor.",
    not: "Harmanlama doğru ama sahne neredeyse görünmüyor — sisli ve olaysız.",
    kademe: "zayif",
  },
  {
    slug: "3-asili-avlu",
    isim: "Asılı Avlu",
    fikir: "Asılı kağıtlar, zemine düşen gölgeleri.",
    not: "Atmosfer güzel ama metnin arkasında beyaz perde paneli var — yasaklanan hile. CTA panel kenarında yarım kalıyor.",
    kademe: "zayif",
  },
  {
    slug: "2-kazi-karesi",
    isim: "Kazı Karesi",
    fikir: "Taş blok ızgarası; arkeolojik kazı karesi, katman katman.",
    not: "Metnin arkasında apaçık beyaz dikdörtgen perde. Tam olarak reddedilen desen.",
    kademe: "zayif",
  },
  {
    slug: "v2",
    isim: "Akıntı (önceki)",
    fikir: "Işıktan elips yörünge, üstünde yedi düğüm.",
    not: "Reddedildi: UI solda / sahne sağda ayrışması ve yörünge motifi.",
    kademe: "zayif",
  },
];

const KADEME_ETIKET: Record<Sahne["kademe"], string> = {
  guclu: "GÜÇLÜ",
  orta: "ORTA",
  zayif: "ZAYIF",
};

export default function SahnelerIndex() {
  return (
    <main
      className={`${styles.root} ${display.variable} ${body.variable} ${mono.variable}`}
    >
      <header className={styles.ust}>
        <span className={styles.kicker}>SEÇİM EKRANI</span>
        <h1 className={styles.baslik}>AERO ’26 — Sahneler</h1>
        <p className={styles.alt}>
          Hepsi gerçek three.js. On ikisi de GPU’da açılıp görüldü; hiçbiri
          bozuk değil. Kademeler benim gözlemim, senin kararın değil — gez,
          karşılaştır, problemleri söyle.
        </p>
      </header>

      <ol className={styles.liste}>
        {SAHNELER.map((s, i) => (
          <li key={s.slug} className={styles.oge}>
            <span className={styles.sira}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className={styles.govde}>
              <div className={styles.satir}>
                <h2 className={styles.isim}>{s.isim}</h2>
                <span className={`${styles.rozet} ${styles[s.kademe]}`}>
                  {KADEME_ETIKET[s.kademe]}
                </span>
              </div>
              <p className={styles.fikir}>{s.fikir}</p>
              <p className={styles.not}>{s.not}</p>
              <Link className={styles.link} href={`/mockups/${s.slug}`}>
                Aç →
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}

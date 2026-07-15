import { disciplines } from "@/lib/content";

/*
 * BÂDGİR — kulenin ölçüleri ve DÜŞEY OLUK bölmelerinin modeli.
 * ---------------------------------------------------------------------------
 * Bu dosya TEK doğruluk kaynağı: hem TypeScript (geometri kurulumu) hem GLSL
 * (analitik gölge testi) aynı sayıları buradan alır. Sabitler GLSL'e string
 * olarak basılıyor → ikisi asla birbirinden kayamaz.
 *
 * TUR 2'DE KÖKTEN DEĞİŞEN ŞEY — YATAY KANAT → DÜŞEY BÖLME
 * Önceki kurulumda boğazda YATAY eğik kanatlar vardı ve sahne tartışmasız
 * "ışığa çıkan MERDİVEN" gibi okuyordu: koyu yatay çubuklar + parlak aralıklar,
 * perspektifte geri kaçınca basamak. Kanat inceltmek (0.55→0.44) semptomu
 * kovalamaktı; sebep YATAYLIK'tı. Merdiven yataydır — bıçak düşeyse merdiven
 * kurulamaz.
 *
 * Yerine gerçek bâdgir planı: şaftı boydan boya bölen DÜŞEY bölmeler. Gerçek
 * rüzgâr kuleleri de böyle çalışır; baca düşey bölmelerle ayrı hava
 * kanallarına (oluk) ayrılır. Kazanç üç katlı:
 *   · Düşey çizgi merdiven okuyamaz — yatay tekrar yok.
 *   · OLUK SAYISI = DİSİPLİN SAYISI: hava yedi kanaldan birden iniyor.
 *   · Bölmeler ışığı oluk oluk ayırıyor → karşı duvarda DÜŞEY aydınlık-karanlık
 *     şeritleri = tur 1'de eksik olan ışık-gölge olayı.
 */

// ---- şaft -----------------------------------------------------------------
// Kare profilli, yukarı doğru daralan bir baca.
// Oran ÖNEMLİ ve tur 1'den değişti: 21 boy / 5.6 taban ile gök ağzı kameradan
// 77.5° yukarıdaydı — yani kadrajın DIŞINDA kalıyordu, göğü görmüyordun.
// Taban genişledi (6.5): ağız artık ~75°'de, kadrajın içinde.
export const SAFT_H = 20.5; // gök ağzının yüksekliği
export const YARI_ALT = 6.5; // dipte yarı genişlik (apotem)
export const YARI_UST = 2.4; // ağızda yarı genişlik

/** y yüksekliğinde şaftın yarı genişliği. */
export function yariCap(y: number) {
  const t = Math.min(Math.max(y / SAFT_H, 0), 1);
  return YARI_ALT + (YARI_UST - YARI_ALT) * t;
}

// ---- oluklar (bâdgir'in düşey bölmeleri) ----------------------------------
// OLUK SAYISI = DİSİPLİN SAYISI. Süs değil: kulenin içinden inen hava yedi
// oluğun hepsinden birden geçiyor, hiçbirinde durmuyor. content.ts değişirse
// bölme sayısı da değişir.
export const OLUK_SAYI = disciplines.length;
/** İç bölme sayısı: 7 oluk → 6 bölme. */
export const BOLME_SAYI = OLUK_SAYI - 1;

// Bölmelerin alt ucu. Kameranın (y≈1.8) YUKARISINDA olmalı: kamera bölmelerin
// altında durup yukarı bakınca yedi oluk yelpaze gibi açılıyor. Bölmeler yere
// kadar inseydi kamera tek bir oluğun içinde kalır, yedilik görünmezdi.
// Ayrıca metnin oturduğu dip bölgesi bölme ZONUNUN ALTINDA kalmalı ki oraya
// şerit düşmesin — metin düşey şeritlerin üstünde okunmaz.
export const BOLME_Y = 11.2;

/** i. iç bölmenin normalize x konumu (s = x / yariCap(y) ∈ [-1,1]). */
export function bolmeKesir(i: number) {
  return -1 + (2 * (i + 1)) / OLUK_SAYI;
}

// ---- palet ----------------------------------------------------------------
// TUR 2'NİN İKİNCİ KÖKTEN DÜZELTMESİ — R KANALI SIFIRDI.
// Tur 1'de sıva (#bfe4e8) ve ışık (#6FE0F0) İKİSİ DE cyan'dı ve shader onları
// ÇARPIYORDU. İki cyan'ın çarpımı cyan'ı KARELİYOR: lineer uzayda R/G oranı
// 0.143'e düşüyordu. Sonuç: tepe değerde bile R≈0.22 iken G,B >1'e taşıyordu →
// ACES G,B'yi beyaza yuvarlayıp R'yi 0'da bırakıyordu. Ekrandan okunan piksel
// bunu birebir doğruladı: kadrajın HER yerinde R=0. Yani sahne yapısal olarak
// BEYAZ ÜRETEMİYORDU; üretebildiği tek parlak değer doygun şeker-cyan'dı —
// yani tam olarak paletin reddettiği şey.
//
// Doğrusu fizik: gökten inen ışık BEYAZDIR, sıva da soğuk-beyaz. Teal, ışığın
// rengi değil GÖLGENİN rengi — duvardan duvara sekerken teal'e boyanıyor.
// Böylece parlak uçta beyaz, karanlık uçta teal → tek hue ailesi + beyazın
// onlarca opaklığı, üstelik gerçek bir hue ayrımıyla.
export const DIP = "#073F49"; // dipteki en koyu değer — saf siyah YOK
export const GOVDE = "#0E4A46"; // sis / hava gövdesi
export const SIVA = "#d7e9ec"; // sıvanın albedosu (soğuk, neredeyse beyaz)
export const ISIK = "#f0fbfd"; // gök ağzından inen ışık — BEYAZ
export const SEKME = "#35C8E6"; // duvardan sekip gölgeyi dolduran cyan
export const GOK = "#bff0fa"; // ağızdan görünen gökyüzü
export const NANE = "#43D6A8"; // tozun içindeki tek nane kırıntısı

/** Durgun (reduced-motion) kare için sabit zaman. */
export const DURGUN_T = 12.5;

const f = (n: number) => n.toFixed(5);

/** Değer gürültüsü — sıva greni, toz, hava. Doku dosyası yok.
 *  KULE_GLSL'in İÇİNE giriyor: iki ayrı chunk olarak include edilince kimi
 *  shader'da eksik, kimisinde çift tanımlı kalıyordu. */
export const GURULTU_GLSL = /* glsl */ `
float hash31(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float gurultu3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
                 mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                 mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

/**
 * Şaft + düşey bölmelerin GLSL karşılığı.
 *
 * NORMALIZE KOORDINAT s = x / yariCap(y)
 * Şaft daraldığı için bölmeler de daralıyor: i. bölme SABİT bir s = a_i
 * düzleminde duruyor (dünyada x = a_i·yariCap(y), y'de lineer → hâlâ DÜZLEM).
 * Böylece bölmeler duvarlarla birlikte ağza doğru yakınsıyor: perspektifin
 * bütün işini bu yakınsama yapıyor.
 */
export const KULE_GLSL = /* glsl */ `
${GURULTU_GLSL}
const float SAFT_H = ${f(SAFT_H)};
const float YARI_ALT = ${f(YARI_ALT)};
const float YARI_UST = ${f(YARI_UST)};
const float BOLME_Y = ${f(BOLME_Y)};
const int OLUK_SAYI = ${OLUK_SAYI};
const float OLUK_SAYI_F = ${f(OLUK_SAYI)};

float yariCap(float y) {
  return mix(YARI_ALT, YARI_UST, clamp(y / SAFT_H, 0.0, 1.0));
}

/**
 * Gök ağzının bir yüzeye düşürdüğü ışık — HUZME DEĞİL, ALAN IŞIĞI.
 *
 * GÖLGE TESTİ, ANALİTİK VE TAM — ÖRNEKLEMESİZ:
 * Bölmeler s = a_i düzlemleri ve BOLME_Y'den ağza (SAFT_H) kadar uzanıyor.
 * P'den ağızdaki bir S noktasına giden ışın:
 *   · s(t) monoton (iki lineerin oranı),
 *   · ışın BOLME_Y yüksekliğine vardığında normalize x = sg,
 *   · ağza vardığında normalize x = su.
 * Bölmeler ağza kadar çıktığı için: ışın ENGELSİZ ⟺ sg ile su ARASINDA hiç
 * bölme yok ⟺ ikisi AYNI OLUKTA. Yaklaşıklık değil, tam sonuç.
 *
 * Üstelik sg, su'nun LİNEER fonksiyonu: sg = c0 + c1·su. Yani her oluk için
 * "görünen su aralığı" KAPALI FORMDA çıkıyor → oluk başına tek örnek yetiyor,
 * aralığın UZUNLUĞU integrali taşıyor. Sonuç: ne god-ray veren seyrek örnek,
 * ne kar gürültüsü veren yoğun örnek. Kenarlar ızgaraya hizalı kalıyor →
 * düşey şeritler yaşıyor; aralık uzunluğu sürekli değiştiği için de bant
 * kırılması yok.
 *
 * c1→0 SINIRI BEDAVA: bölme zonunun İÇİNDEKİ bir nokta için tmin=0 → c1=0 →
 * (A-c0)/c1 ıraksıyor ve kesişim kendiliğinden "yalnız kendi oluğu" veriyor.
 * Zonun ALTINDA c1>0 → pencere yumuşak açılıyor. Tek formül iki rejimi de
 * doğru veriyor; eps sadece 0'a bölmeyi engelliyor.
 */
float agizIsigi(vec3 P, vec3 N) {
  float dy = SAFT_H - P.y;
  if (dy <= 1e-3) return 0.0;

  float tmin = clamp((BOLME_Y - P.y) / dy, 0.0, 1.0);
  float sPay = yariCap(max(P.y, BOLME_Y));
  float c0 = P.x * (1.0 - tmin) / sPay;
  float c1 = max(tmin * YARI_UST / sPay, 1e-4);

  float toplam = 0.0;
  for (int j = 0; j < OLUK_SAYI; j++) {
    // j. oluğun ağızdaki normalize x aralığı.
    float A = -1.0 + 2.0 * float(j) / OLUK_SAYI_F;
    float B = A + 2.0 / OLUK_SAYI_F;
    // sg(su) = c0 + c1·su bu oluğun içinde kalsın → su aralığı.
    float lo = max(A, (A - c0) / c1);
    float hi = min(B, (B - c0) / c1);
    float uzun = hi - lo;
    if (uzun <= 0.0) continue; // bu oluk P'den görünmüyor

    float orta = (lo + hi) * 0.5;
    // Bölmeler z'de engel değil (şaftı boydan boya kesiyorlar) → z'de gölge
    // yok, sadece form faktörü var → 3 örnek pürüzsüz sonuç veriyor.
    for (int zi = 0; zi < 3; zi++) {
      float sz = (float(zi) - 1.0) * YARI_UST * 0.6667;
      vec3 S = vec3(orta * YARI_UST, SAFT_H, sz);
      vec3 L = S - P;
      float d2 = max(dot(L, L), 0.5);
      L = normalize(L);
      // cos(yüzey) × cos(ağız). Ağzın normali (0,-1,0) → cos(ağız) = L.y.
      toplam += max(dot(N, L), 0.0) * max(L.y, 0.0) / d2 * uzun;
    }
  }
  // uzun: normalize su ölçüsü → dünya x'i (×YARI_UST); z dilimi 2·YARI_UST/3.
  return toplam * YARI_UST * (2.0 * YARI_UST / 3.0);
}

/**
 * Sekme: duvarlardan yansıyıp dibi dolduran ışık. Dipteki metin bölgesini
 * ölü karanlıktan kurtarıyor ve YUMUŞAK, yani oluk şeridi TAŞIMIYOR.
 * Rengi CYAN (bkz. palet notu): teal bu sahnede ışığın değil GÖLGENİN rengi.
 * Kısık olmak zorunda — sekme dolgu ışığıdır, anahtar ışık değil.
 */
float sekmeIsigi(float y) {
  float t = clamp(y / SAFT_H, 0.0, 1.0);
  return 0.030 + 0.16 * t * t;
}
`;

/** Deterministik gürültü — her yüklemede aynı kadraj. */
export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

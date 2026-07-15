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
export const SAFT_H = 17.5; // gök ağzının yüksekliği
export const YARI_ALT = 6.5; // dipte yarı genişlik (apotem)
export const YARI_UST = 3.3; // ağızda yarı genişlik

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

// Bölme zonu: bölmeler ASILI. Ne yere iniyorlar ne de ağza değiyorlar.
//
// Alt uç kameranın (y≈1.8) YUKARISINDA: kamera bölmelerin altında durup yukarı
// bakınca yedi oluk yelpaze gibi açılıyor. Bölmeler yere inseydi kamera tek bir
// oluğun içinde kalır, yedilik görünmezdi. Metnin oturduğu dip de zonun ALTINDA
// kalmalı ki oraya şerit düşmesin — metin düşey şeritlerin üstünde okunmaz.
//
// ÜST UÇ AĞZA DEĞİYOR (BOLME_UST = SAFT_H) — ve bu, denenip geri alınmış bir
// karar. Bölmeleri ağzın altında kesip "asılı" yapmayı denedim: gök genişliyor
// ama bedeli ağırdı — bölmeler göğe karşı siluet olacağına PARLAK levhalara
// dönüyor, dibe inen dolaysız ışık artıyor, kadraj yıkanıyor ve sahne
// "sarnıç sütunları"na benziyordu (zaten yapılmış listesinde). Bölme ağza
// değince oluk yeniden KOLİMATÖR oluyor: dibe dolaysız ışık inmiyor, metin
// bölgesi sakin ve koyu kalıyor, bölmeler koyu kalıyor.
//
// Kolimatörün iki bilinen yan etkisi VAR ve ikisi de kadrajla çözüldü, geometri
// ile değil (bkz. BadgirSahnesi cerceve()):
//   · "Kapı" okuması: görünen yarığın en-boy oranı 7·cos(yükseliş açısı).
//     Yani dik yukarı baktıkça yarık KARELEŞİYOR. Kamera merkeze çekilip açı
//     72°→80° olunca oran 2.2'den 1.2'ye düşüyor: kapı değil, açıklık.
//   · Dipteki "huzme" yelpazeleri: yan duvarlar sıyırma açısıyla göründüğünde
//     oluşuyorlardı. Kamera duvardan uzaklaşıp merkeze gelince yan duvarlar
//     sıyırma açısından çıkıyor ve yelpazeler kayboluyor.
export const BOLME_ALT = 9.6;
export const BOLME_UST = SAFT_H;

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
const float BOLME_ALT = ${f(BOLME_ALT)};
const float BOLME_UST = ${f(BOLME_UST)};
const int OLUK_SAYI = ${OLUK_SAYI};
const float OLUK_SAYI_F = ${f(OLUK_SAYI)};

float yariCap(float y) {
  return mix(YARI_ALT, YARI_UST, clamp(y / SAFT_H, 0.0, 1.0));
}

/**
 * Gök ağzının bir yüzeye düşürdüğü ışık — HUZME DEĞİL, ALAN IŞIĞI.
 *
 * GÖLGE TESTİ, ANALİTİK VE TAM — ÖRNEKLEMESİZ:
 * Bölmeler s = a_i düzlemleri; BOLME_ALT ile BOLME_UST arasında ASILI.
 * P'den ağızdaki bir S noktasına giden ışın bölme zonuna s0'da girip s1'de
 * çıkıyor (s(t) monoton: iki lineerin oranı). Işın ENGELSİZ ⟺ s0 ile s1
 * ARASINDA hiç bölme yok ⟺ ikisi AYNI OLUKTA. Yaklaşıklık değil, tam sonuç.
 *
 * Üstelik s0 ve s1'in İKİSİ de su'nun LİNEER fonksiyonu (girilen/çıkılan
 * yükseklikler sabit → paydalar sabit). Yani her oluk için "görünen su
 * aralığı" iki lineer kısıtın kesişimi = KAPALI FORM → oluk başına tek örnek
 * yetiyor, aralığın UZUNLUĞU integrali taşıyor. Sonuç: ne god-ray veren seyrek
 * örnek, ne kar gürültüsü veren yoğun örnek. Kenarlar ızgaraya hizalı →
 * bölmeler göğe karşı keskin siluet; aralık uzunluğu sürekli değiştiği için de
 * bant kırılması yok.
 *
 * SINIR DURUMLARI BEDAVA (b→0'da eps):
 *   · P zonun ALTINDA (metin bölgesi): t0,t1 > 0, iki kısıt da dar → pencere
 *     yumuşak açılıyor, penumbra geniş.
 *   · P zonun İÇİNDE: t0=0 → b0=eps → s0 kısıtı "kendi oluğu"na kilitleniyor.
 *   · P zonun ÜSTÜNDE: t0=t1=0 → iki kısıt da aynı oluğa kilitleniyor ve o
 *     oluk TÜM ağzı veriyor → doğru: üstteki nokta ağzı engelsiz görüyor.
 * Tek formül üç rejimi de doğru veriyor; eps sadece 0'a bölmeyi engelliyor.
 */
float agizIsigi(vec3 P, vec3 N) {
  float dy = SAFT_H - P.y;
  if (dy <= 1e-3) return 0.0;

  // Işının bölme zonuna giriş/çıkış parametreleri ve oradaki normalize x'i.
  float t0 = clamp((BOLME_ALT - P.y) / dy, 0.0, 1.0);
  float t1 = clamp((BOLME_UST - P.y) / dy, 0.0, 1.0);
  float w0 = yariCap(P.y + t0 * dy);
  float w1 = yariCap(P.y + t1 * dy);
  float a0 = P.x * (1.0 - t0) / w0;
  float b0 = max(t0 * YARI_UST / w0, 1e-4);
  float a1 = P.x * (1.0 - t1) / w1;
  float b1 = max(t1 * YARI_UST / w1, 1e-4);

  float toplam = 0.0;
  for (int j = 0; j < OLUK_SAYI; j++) {
    // j. oluğun normalize x aralığı.
    float A = -1.0 + 2.0 * float(j) / OLUK_SAYI_F;
    float B = A + 2.0 / OLUK_SAYI_F;
    // Hem giriş (s0) hem çıkış (s1) bu oluğun içinde kalsın → iki lineer kısıt.
    // Ağzın kendi sınırı [-1,1] de üçüncü kısıt.
    float lo = max(max(-1.0, (A - a0) / b0), (A - a1) / b1);
    float hi = min(min(1.0, (B - a0) / b0), (B - a1) / b1);
    float uzun = hi - lo;
    if (uzun <= 0.0) continue; // bu oluktan ağız görünmüyor

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
 * Sekme: duvarlardan yansıyıp dibi dolduran ışık. Rengi CYAN (bkz. palet notu):
 * teal bu sahnede ışığın değil GÖLGENİN rengi.
 *
 * DİPTEKİ TABAN NEDEN YÜKSELTİLDİ (0.030 → 0.085) — ölçülmüş bir karar:
 * Bölmeler ağza kadar çıkınca oluk kolimatör oluyor; dipteki bir duvar noktası
 * ağzın ancak dar bir penceresini görüyor. Dar pencere = KÜÇÜK kaynak = SERT
 * gölge → dipte keskin kenarlı, üçgen, ışın gibi yelpazeler. Ekranda "duvara
 * düşmüş ışık" değil "huzme" okuyorlardı.
 *
 * Yelpazenin kontrastı bir ORAN: pozlama düşürmek onu değiştirmiyor (ikisi de
 * ölçekleniyor). Oranı düşürmenin tek fiziksel yolu dolgu ışığını yükseltmek.
 * Gerçek bir bacada da dip zaten büyük ölçüde iç yansımayla aydınlanır: dolaysız
 * ışık 1/d² ile ölürken sekme ölmüyor. Yani bu düzeltme hile değil, eksik olan
 * fiziğin eklenmesi. Yelpazeler tamamen kaybolmuyor — kaybolmamalı da, "ışık-
 * gölge" isteniyor — ama huzme olmaktan çıkıp duvardaki yumuşak bir aydınlığa
 * dönüyorlar. Tepe hâlâ ağız ışığının: anahtar/dolgu oranı korunuyor.
 */
float sekmeIsigi(float y) {
  float t = clamp(y / SAFT_H, 0.0, 1.0);
  return 0.085 + 0.16 * t * t;
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

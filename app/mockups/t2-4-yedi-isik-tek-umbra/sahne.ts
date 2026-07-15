/*
 * YEDİ IŞIK, TEK UMBRA — sahne verisi + paylaşılan GLSL.
 *
 * Fikir: büyük bir salonun ortasında asılı duran tek bir KIRIK KÜTLE yedi ayrı
 * ışıkla aydınlatılıyor. Yedi yarı-gölge zeminde yelpaze gibi açılıyor; yalnız
 * hepsinin çakıştığı yerde tek bir derin umbra kalıyor. Kamera tam oranın içinde.
 *
 * Yedi disiplin = yedi ışık. Ortak konu = tek cisim. Uzlaşma = gölgelerin
 * çakıştığı yer. Bir disiplin yüksek sesle konuşunca (hover) o ışık güçleniyor,
 * yarıçapı küçülüyor → kendi yarı-gölgesi keskinleşiyor, yelpaze o yana kayıyor,
 * umbra çekirdeği daralıyor ama YOK OLMUYOR.
 *
 * HARMAN (panel testi tersten geçiyor): metin umbranın içinde duruyor. Orası
 * sahnenin fiziğine göre zaten en koyu, en tekdüze, en sakin yer — üstelik
 * kameraya en yakın olduğu için yükseklik sisi de oraya hiç binmiyor. Işıkları
 * kapatırsan zemin AYDINLANIR ve metin okunmaz olur: okunabilirliği bir perde
 * değil, sahnenin ışığı kuruyor.
 */

// ---------------------------------------------------------------------------
// Palet — tek hue ailesi (cyan ↔ nane) + beyazın onlarca opaklığı.
// En koyu değer #073F49 civarı: saf siyah YOK. Sıcak/bej YOK.
// ---------------------------------------------------------------------------
export const PALET = {
  /** Umbranın dibi = ortam ışığı. Sahnenin en koyu değeri: #073F49 civarı. */
  ortam: "#083c47",
  /** Taşın kendi rengi (albedo): soğuk, neredeyse renksiz açık taş. */
  tas: "#cfe4e8",
  /** Kütle KOYU taş: yedi ışığın hepsi arkasında → kameraya bakan yüzleri
   *  zaten ndl<0. Açık albedo onu düz gri bir kütleye çeviriyordu; koyu taş
   *  sisin önünde silüet olarak okuyor, biçimi rim + zemin sekmesi taşıyor.
   *
   *  ÖLÇÜLDÜ: #5d8c97 ile kütle #4b6e77/#628d96 olarak render oluyordu —
   *  doygunluk 0.21, oysa zemin 0.73 / duvar 0.43 / üst salon 0.65. Yani kadrajın
   *  TEK nötr nesnesi kahramanın kendisiydi: "gri kaya". Sebep aydınlatma değil,
   *  albedonun KENDİSİ: #5d8c97 zaten mavi-gri (S≈0.24), ışık kromayı geri
   *  getiremez. Değer aynı aralıkta (silüet korunuyor) ama kroma teal ailesine
   *  çekildi. */
  kutle: "#2b7d8a",
  /** Kütlenin AYRI ortam ışığı — zeminin umbra ortamından (koyu) daha parlak.
   *  Gerekçe: kütle parlak bir hacmin ortasında asılı; duvar, tavan ve yelpazenin
   *  aydınlık zemini ona her yandan ışık geri veriyor. Zeminin ortamıyla
   *  çarpılınca kütle SİYAHA düşüyordu — hem palet dışı (en koyu #073F49) hem de
   *  nötr gri, yani AERO değil. Umbra koyu kalsın diye zemin kendi ortamını
   *  koruyor; iki değer bilinçli olarak ayrı.
   *
   *  #1b6774 YETMEDİ: yedi ışığın hepsi arkada olduğu için kameraya bakan yüzler
   *  ndl<=0 ile eleniyor, yani gövdenin TEK ışık kaynağı bu ortam. albedo ile
   *  çarpılınca (iki koyu değer) gövde ~siyaha iniyordu ve rengin tamamı sisten
   *  geliyordu → GRİ kütle. Ortam artık gövdeye kendi teal'ini verecek kadar
   *  kromatik; değeri hâlâ koyu, silüet korunuyor. */
  kutleOrtam: "#2b8b9b",
  /** Yükseklik sisi. AŞAĞI bakınca KOYU olmalı: yakın zemin (umbra çekirdeği)
   *  metnin yeri; oraya binen açık sis umbrayı yıkıyordu. Yukarı bakınca ışıklı
   *  ama beyaz değil — beyaz sis tavanı patlatıp kadrajın üstünü boşaltıyordu. */
  sisYakin: "#0b3f4a",
  /** Uzak sis. #a9dbe4 fazla SÜTLÜ (nötre yakın açık mavi-gri) idi: kadrajın üst
   *  yarısı ve sisin içinden okunan her cisim ona doğru karıştığı için sahne
   *  soluk, kütle ise GRİ okuyordu. Aynı parlaklık ailesinde kalıp kromayı
   *  yükseltiyoruz — aydınlık yön korunuyor, ama sis artık cyan; nötr değil.
   *  Doygun şeker-cyan DEĞİL: bu bir puslu hava, düz renk duvarı değil. */
  sisUzak: "#84cfe1",
  /** UI tarafı. */
  metin: "#eaf9fb",
  koyu: "#073f49",
} as const;

// ---------------------------------------------------------------------------
// Yedi ışık.
//
// KURAL: eşit aralık YOK. Işıklar bir çembere/yaya dizilmiyor — x, y ve z
// üçü de düzensiz. (Simetrik yelpaze yasaklı "çember üstüne dizme" gibi okur.)
// Hepsi kütlenin üstünde ve arkasında: gölgeler kameraya doğru uzuyor,
// yelpaze kadrajın alt yarısında açılıyor, kamera çakışmanın içinde kalıyor.
//
// tint: cyan #22B8DC / #35C8E6 / #6FE0F0 ↔ nane #43D6A8 ailesi. Rainbow değil —
// yedi ışığın farkı sıcaklıkta değil, aynı ailenin içindeki mikro kaymada.
// ---------------------------------------------------------------------------
export type IsikDuzeni = {
  /** Dünya konumu. disciplines[] sırası bu diziyi besliyor. */
  pos: readonly [number, number, number];
  tint: string;
  /** Sakin hâldeki şiddet. */
  guc: number;
  /** FİZİKSEL ışık yarıçapı → yarı-gölge genişliği buradan geliyor. */
  yaricap: number;
  /** Nefes: şiddet salınımının fazı ve hızı. Ortak kat YOK → yelpaze tekrar etmez. */
  faz: number;
  hiz: number;
  /** Asılı ışık plakasının ölçüsü. */
  plaka: readonly [number, number, number];
};

export const ISIK_DUZENI: readonly IsikDuzeni[] = [
  { pos: [-3.6, 11.4, -14.4], tint: "#6FE0F0", guc: 0.72, yaricap: 0.66, faz: 0.0, hiz: 0.081, plaka: [1.6, 0.14, 1.15] },
  { pos: [-5.4, 15.4, -22.0], tint: "#43D6A8", guc: 0.82, yaricap: 0.52, faz: 1.9, hiz: 0.063, plaka: [1.25, 0.12, 1.4] },
  { pos: [-1.2, 10.2, -11.2], tint: "#22B8DC", guc: 0.63, yaricap: 0.78, faz: 3.4, hiz: 0.107, plaka: [1.85, 0.16, 0.95] },
  { pos: [1.7, 14.0, -19.4], tint: "#35C8E6", guc: 0.77, yaricap: 0.58, faz: 5.1, hiz: 0.072, plaka: [1.3, 0.13, 1.3] },
  { pos: [4.6, 12.1, -13.0], tint: "#5FD9C6", guc: 0.69, yaricap: 0.70, faz: 0.8, hiz: 0.094, plaka: [1.5, 0.15, 1.05] },
  { pos: [2.9, 16.8, -24.6], tint: "#2FC6D8", guc: 0.86, yaricap: 0.48, faz: 4.2, hiz: 0.057, plaka: [1.15, 0.11, 1.5] },
  { pos: [-0.4, 13.0, -17.6], tint: "#8FEAF2", guc: 0.74, yaricap: 0.62, faz: 2.6, hiz: 0.088, plaka: [1.4, 0.13, 1.2] },
];

/** Hover'da ışık bu kadar güçleniyor ve yarıçapı bu orana iniyor (→ keskin gölge). */
export const VURGU = { gucCarpan: 2.05, yaricapCarpan: 0.26 } as const;
/** Nefes: sakin hâlde şiddet ±%22 salınıyor → yelpaze yavaşça yer değiştiriyor. */
export const NEFES = 0.22;

// ---------------------------------------------------------------------------
// Kırık kütle — dört parça. BİRLEŞİM (smin) DEĞİL, min(): parçalar arasında
// gerçek çatlaklar var ve ışık oralardan sızıyor. Her ışık çatlağı BAŞKA bir
// açıyla görüyor → sızan dilimler hiç üst üste gelmiyor. Umbra tam olarak
// çatlakların bile kapandığı yer: yedi okumanın hepsinden sağ çıkan koyu.
//
// Biçim: kırılmış bir lento/atkı taşı. Geniş, yassı, mimari. Küre/polihedra
// değil — bilim motifi yasağı.
// Ölçüler yarı-boy (half-extent). Konum kütle grubunun yerel çerçevesinde.
// ---------------------------------------------------------------------------
export type Parca = {
  pos: readonly [number, number, number];
  boy: readonly [number, number, number];
  rot: readonly [number, number, number];
};

export const PARCALAR: readonly Parca[] = [
  { pos: [-2.9, 0.15, 0.2], boy: [1.55, 1.05, 1.5], rot: [0.05, 0.21, -0.08] },
  { pos: [0.5, -0.05, -0.4], boy: [1.25, 1.3, 1.6], rot: [-0.1, -0.33, 0.13] },
  { pos: [3.3, 0.5, 0.5], boy: [1.0, 0.8, 1.2], rot: [0.18, 0.49, 0.26] },
  // Kopmuş şarap: kütleden ayrılmış, çatlağın üstünde asılı duran küçük parça.
  { pos: [-0.2, 1.8, 1.4], boy: [0.8, 0.5, 0.75], rot: [-0.29, 0.14, 0.41] },
];

/**
 * Kütlenin salonda asılı durduğu yer.
 *
 * ÖLÇÜLDÜ → DÜZELTİLDİ. [0, 6.2, -4.0] iken umbra havuzu zeminde z≈+4..+8'e,
 * yani KAMERANIN DİBİNE düşüyordu: kadrajın en alt şeridi. Metin bloğu ise
 * yukarıdaydı, dolayısıyla kicker ve başlığın üstü AYDINLIK zemin bandına
 * biniyordu — ölçülen kontrast kicker 2.15 (masaüstü) / 1.72 (mobil), başlık
 * mobilde 2.54. Beyaz metin parlak cyan zeminde hiçbir opaklıkta okunmaz;
 * yani umbra metne YÜKSELMEK zorundaydı.
 *
 * Fizik gerilimi: lambalar kadrajda kalsın diye GERİDE duruyor → ışık açısı
 * yatık → gölgeler uzun → umbra kameraya yakın düşüyor. Kütleyi alçaltmak onu
 * ufka/metnin üstüne indiriyor; lambaları yükseltmek onları kadrajdan atıyor.
 * İkisini de yapmayan kaldıraç: kütleyi biraz ALÇALTIP DAHA DERİNE asmak.
 * Yedi gölge artık z≈-3..+0.5'te çakışıyor (ekranda y≈673 → y≈527), umbra
 * metnin altına değil ARKASINA geliyor. Lambalar yerinde, silüet yerinde.
 */
export const KUTLE_MERKEZ = [0, 5.0, -7.0] as const;
/** Sınır küresi: march'ın kapısı. Parçaların hepsini kapsayan EN DAR yarıçap. */
export const KUTLE_YARICAP = 5.25;
/** Kütle çok yavaş dönüyor: sirkülasyon. Gölgeler onunla birlikte kayıyor. */
export const KUTLE_DONUS = 0.021;

// ---------------------------------------------------------------------------
// Salon + kamera
// ---------------------------------------------------------------------------
export const SALON = {
  duvarX: 16,
  // Tavan ZORUNLU çıktı: duvar y=22'de bitince kadrajın üstü arka plana açılıyor
  // ve yedi lamba beyaz bir boşlukta yüzen cyan dikdörtgenler gibi okuyordu.
  // Kapalı tavan hem salonu HACİM yapıyor hem de lambalar bir yerden ASILIYOR;
  // üstelik lambaların tavanda biriken ışığı ölçeği veren şey oluyor.
  duvarY: 24,
  arkaZ: -48,
  onZ: 12,
  ayakAra: 6.5, // paye aralığı (z)
  ayakIlk: 6,
  ayakSayi: 8,
} as const;

export const KAMERA = {
  y: 4.2,
  z: 15,
  /** Aşağı bakış: zemini açar → yelpaze perspektifte ezilmez. */
  egimDer: -9,
} as const;

/** yogunluk 0.028 salonun mimarisini fazla erken yutuyordu: payeler ve tavan
 *  orta mesafede sütlü bir duvara dönüşüyor, sahne "sakin" değil OLAYSIZ okuyordu.
 *  0.023 derinliği koruyor — uzak salon hâlâ sisin içinde eriyor, ama arada
 *  ışık-gölge kalıyor. */
export const SIS = { yogunluk: 0.023, dusme: 0.09 } as const;
/** Işık düşmesi: 1/(1+d²·k). Yakın zemin bu yüzden ışığa boğulur — umbra olmasa. */
export const DUSME = 0.004;

// ---------------------------------------------------------------------------
// Paylaşılan GLSL — hem salon (zemin+duvar+paye) hem kütle bunu kullanıyor.
// #define ADIM / ISIK / PARCA materyalde veriliyor (dokunmatikte ADIM düşer).
// ---------------------------------------------------------------------------
export const ORTAK_GLSL = /* glsl */ `
uniform vec3  uIsikPos[ISIK];
uniform vec3  uIsikRenk[ISIK];
uniform float uIsikGuc[ISIK];
uniform float uIsikYaricap[ISIK];

uniform vec3  uParcaMerkez[PARCA];
uniform vec3  uParcaBoy[PARCA];
uniform mat3  uParcaTers[PARCA];
uniform vec3  uKutleMerkez;
uniform float uKutleYaricap;

uniform vec3  uOrtam;
uniform float uDusme;
uniform float uKayma;
uniform vec3  uSisYakin;
uniform vec3  uSisUzak;
uniform float uSisYogunluk;
uniform float uSisDusme;

float sdKutuYuvarlak(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

/** Kırık kütlenin alanı. min() → parçalar ayrı, çatlaklar açık. */
float harita(vec3 p) {
  float d = 1e9;
  for (int i = 0; i < PARCA; i++) {
    vec3 q = uParcaTers[i] * (p - uParcaMerkez[i]);
    d = min(d, sdKutuYuvarlak(q, uParcaBoy[i], 0.14));
  }
  return d;
}

/**
 * IQ yumuşak gölgesi — SINIR KÜRESİ KAPISIYLA.
 *
 * Bu kapı fikri mobilde ayakta tutan şey: ışın, kütlenin (ışık yarıçapı kadar
 * şişirilmiş) sınır küresini ıskalıyorsa TEK adım bile yürümüyoruz. Zeminin ve
 * duvarların büyük çoğunluğu ~15 op ödeyip çıkıyor; march'ın parasını yalnız
 * gerçekten yarı-gölgenin içindeki pikseller ödüyor. Üstelik yürüyüş [t0,t1]
 * ile kürenin İÇİNE hapsediliyor, yani az sayıda adım o aralığa tam oturuyor.
 *
 * k = uzaklık / ışık yarıçapı: yarı-gölge genişliği ışığın FİZİKSEL boyutundan
 * geliyor, uydurma bir blur'dan değil. Hover yarıçapı küçültünce gölge kendi
 * kendine keskinleşiyor.
 */
float yumusakGolge(vec3 o, vec3 isikPos, float isikYaricap) {
  vec3 dl = isikPos - o;
  float uzak = length(dl);
  vec3 rd = dl / uzak;

  vec3 oc = uKutleMerkez - o;
  float tca = dot(oc, rd);
  float Re = uKutleYaricap + isikYaricap;
  float d2 = dot(oc, oc) - tca * tca;
  float thc2 = Re * Re - d2;
  if (thc2 <= 0.0 || tca < 0.0 || tca > uzak + Re) return 1.0;

  float thc = sqrt(thc2);
  float t0 = max(tca - thc, 0.05);
  float t1 = min(tca + thc, uzak - 0.05);
  if (t1 <= t0) return 1.0;

  float k = uzak / max(isikYaricap, 0.02);
  float res = 1.0;
  float t = t0;
  float onceki = 1e9;
  for (int i = 0; i < ADIM; i++) {
    float h = harita(o + rd * t);
    if (h < 0.004) return 0.0;
    float y = h * h / (2.0 * onceki);
    float d = sqrt(max(h * h - y * y, 0.0));
    res = min(res, k * d / max(t - y, 0.001));
    onceki = h;
    t += clamp(h, 0.09, 0.62);
    if (t > t1) break;
  }
  return clamp(res, 0.0, 1.0);
}

/** Yedi ışık, yedi yarı-gölge. Toplamları sahnenin bütün aydınlığı. */
vec3 isikla(vec3 P, vec3 N) {
  vec3 col = uOrtam;
  vec3 o = P + N * uKayma;
  for (int i = 0; i < ISIK; i++) {
    vec3 L = uIsikPos[i] - P;
    float uzak2 = dot(L, L);
    float ndl = dot(N, L * inversesqrt(uzak2));
    if (ndl <= 0.003) continue;           // ışığa sırtı dönük yüz march ödemez
    float dusme = 1.0 / (1.0 + uzak2 * uDusme);
    float g = yumusakGolge(o, uIsikPos[i], uIsikYaricap[i]);
    col += uIsikRenk[i] * (uIsikGuc[i] * ndl * dusme * g);
  }
  return col;
}

/**
 * Analitik yükseklik sisi (IQ). Tek katman, march yok.
 * Kamera sisin İÇİNDE duruyor: yakın zemine (umbra çekirdeği) mesafe kısa
 * olduğu için sis oraya hiç binmiyor → metnin bölgesi hem en koyu hem en
 * tekdüze yer. Uzak salon ise sisin içinde ışıl ışıl eriyor.
 */
vec3 sisle(vec3 col, vec3 P) {
  vec3 d = P - cameraPosition;
  float uzunluk = length(d);
  vec3 rd = d / max(uzunluk, 1e-4);
  float b = uSisDusme;
  float ic = uzunluk * rd.y * b;
  // rd.y → 0'da (1-exp(-ic))/rd.y tekilleşir; limiti uzunluk*b.
  float pay = (abs(ic) < 1e-3) ? uzunluk * b : (1.0 - exp(-ic)) / rd.y;
  float miktar = (uSisYogunluk / b) * exp(-cameraPosition.y * b) * pay;
  float f = clamp(1.0 - exp(-max(miktar, 0.0)), 0.0, 1.0);
  vec3 sisRenk = mix(uSisYakin, uSisUzak, clamp(rd.y * 1.6 + 0.42, 0.0, 1.0));
  return mix(col, sisRenk, f);
}

/** Yumuşak omuz: hue'yu kaydırmayan Reinhard. ACES cyan'ı beyaza büker. */
vec3 omuz(vec3 c) { return c / (1.0 + c * 0.30); }

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

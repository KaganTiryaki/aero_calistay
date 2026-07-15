/*
 * İĞNE DELİĞİ — odanın geometrisi, paleti ve paylaşılan GLSL parçaları.
 *
 * Sahne tek bir camera obscura: uzun, karanlık bir salonun sağ duvarında tek
 * bir iğne deliği var. Dışarısı o delikten giriyor, salonu çaprazlama geçiyor
 * ve dip duvarın sol üstüne BAŞ AŞAĞI düşüyor. Oda hiçbir şey üretmiyor —
 * yalnızca dolaşımı geçiriyor ve çeviriyor.
 *
 * Ters çevirme ELLE YAPILMIYOR. Delikten geçen ışınlar bir noktada kesiştiği
 * için görüntü geometrinin kendisi tarafından çevriliyor (bkz. GNOMONIK_GLSL):
 * duvardaki bir noktaya `dir` yönünden gelen ışık, dışarıda `-dir` yönünden
 * gelmiştir. Hem dikey hem yatay çevrim buradan, bedavaya çıkıyor.
 */

export const DER = Math.PI / 180;

/* ---- oda: kutu, iç yüzeyi görülüyor -------------------------------------- */
export const ODA = {
  yariEn: 7, // x ∈ [-7, 7]
  yukseklik: 7, // y ∈ [0, 7]
  dipZ: -20, // projeksiyonun düştüğü duvar
  girisZ: 14, // kamera geri çekilebilsin diye derin: dar ekran kadrajı
} as const;

export const KAMERA_Y = 1.7;
export const KAMERA_Z = 4.4;

/**
 * İğne deliği: SAĞ duvarda (x = +7), göz hizasının üstünde, kadrajın sağ
 * üstüne düşecek kadar ileride. Sahnenin tek olayı ve kontrast çıpası.
 */
export const DELIK: readonly [number, number, number] = [7, 4.9, -10.1];

/**
 * Koni ekseninin dip duvara vurduğu nokta: SOL ÜST. Metnin (ortada, alt
 * yarıda) üstünden çaprazlama geçsin diye. Bütün kontrast metnin ETRAFINDA:
 * sol üstte oval, sağ üstte delik, aradaki bantta koni.
 */
export const DUSME: readonly [number, number, number] = [-4.6, 5.3, -20];

/**
 * Duvar kalın: delik bir "bore", yani dar bir koni geçiriyor ve kenarda
 * vinyetliyor. Oda 7 birim yüksek — 8°'den geniş koni tavanı da tabanı da
 * basar ve oval "olay" olmaktan çıkıp duvar kağıdına döner.
 */
export const YARI_ACI = 8.2 * DER;

/** Dış görüntünün gnomonik yarı-FOV'u: koniden bir tık geniş → kenar payı. */
export const DIS_YARI_FOV = 9.6 * DER;

/**
 * Açıklık (delik çapı, dünya birimi) nefes alıyor: 19 sn'lik bir döngüde
 * daralıp genişliyor. Fiziksel gerçek: bir iğne deliğinin duvardaki bulanıklık
 * dairesi = delik ÇAPI (uzak nesne için mesafeden bağımsız). Yani açıklık
 * doğrudan bulanıklık yarıçapı; daraldıkça dışarısı okunur hale geliyor.
 * Üretimde bunun scroll'a bağlanması gerekir (aşağı indikçe delik daralır).
 */
// 0.34'te görüntü tamamen mushluyordu: geniş uçta oval yapısız bir leke oluyor
// ve "dışarısı" okunmuyordu. Dar uçta dünya çözülsün, geniş uçta yumuşasın —
// ama her iki uçta da bir GÖRÜNTÜ olsun.
export const ACIKLIK_DAR = 0.045;
export const ACIKLIK_GENIS = 0.22;
export const NEFES_HIZ = 0.33; // 2π/0.33 ≈ 19 sn
export const DURGUN_T = 6.2; // reduced-motion'ın dondurulduğu an

/* ---- palet: tek hue ailesi + beyazın onlarca opaklığı --------------------- */
export const P = {
  cyan: "#22B8DC",
  cyanOrta: "#35C8E6",
  cyanAcik: "#6FE0F0",
  nane: "#43D6A8",
  teal: "#0E4A46",
  koyu: "#073F49", // sahnenin EN KOYU değeri. Saf siyah yok.
} as const;

/* ---- dışarıdaki dünyanın akışı: GLSL + TS aynı fonksiyon ----------------- */
/*
 * Bulut bantlarının büyük ölçekli fazı. Alt şeritteki disiplinler de bunu
 * örnekliyor (CPU'da), böylece dışarıdaki akış ile disiplinlerin aydınlanması
 * AYNI dalga. Fikir hiçbirinde durmuyor, hepsinin arasından geçiyor.
 */
export const BANT_GLSL = /* glsl */ `
  float bant(float a, float t) {
    return 0.5 + 0.5 * (
        sin(a * 2.40 - t * 0.160) * 0.50
      + sin(a * 4.70 + t * 0.110 + 1.7) * 0.32
      + sin(a * 1.30 - t * 0.070 + 3.1) * 0.18
    );
  }
`;

export function bant(a: number, t: number) {
  return (
    0.5 +
    0.5 *
      (Math.sin(a * 2.4 - t * 0.16) * 0.5 +
        Math.sin(a * 4.7 + t * 0.11 + 1.7) * 0.32 +
        Math.sin(a * 1.3 - t * 0.07 + 3.1) * 0.18)
  );
}

/* ---- gürültü: doku dosyası yok, hepsi proceduraly ------------------------ */
export const GURULTU_GLSL = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float hash31(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float gurultu2(vec2 x) {
    vec2 i = floor(x); vec2 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float gurultu3(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash31(i + vec3(0.0,0.0,0.0)), hash31(i + vec3(1.0,0.0,0.0)), f.x),
                   mix(hash31(i + vec3(0.0,1.0,0.0)), hash31(i + vec3(1.0,1.0,0.0)), f.x), f.y),
               mix(mix(hash31(i + vec3(0.0,0.0,1.0)), hash31(i + vec3(1.0,0.0,1.0)), f.x),
                   mix(hash31(i + vec3(0.0,1.0,1.0)), hash31(i + vec3(1.0,1.0,1.0)), f.x), f.y), f.z);
  }
  float fbm2(vec2 p) {
    float s = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * gurultu2(p); p *= 2.03; a *= 0.5; }
    return s;
  }
  float fbm3(vec3 p) {
    float s = 0.0; float a = 0.5;
    for (int i = 0; i < 3; i++) { s += a * gurultu3(p); p *= 2.07; a *= 0.5; }
    return s;
  }
`;

/* ---- gnomonik: delik = kamera. Ters çevirme burada, geometriden gelir ---- */
export const GNOMONIK_GLSL = /* glsl */ `
  // dir: delikten yüzeye giden yön. Dışarıdaki karşılığı -dir'dir → görüntü
  // hem dikey hem yatay TERS düşer. Elle 180° çevirme yok; fizik yapıyor.
  // Dönüş: xy = uv, z = eksene göre öne düşüş (0'ın altı = geçersiz).
  vec3 disariUV(vec3 dir, vec3 R, vec3 U, vec3 F, float k) {
    vec3 o = -dir;
    float f = dot(o, F);
    if (f <= 0.06) return vec3(0.0, 0.0, -1.0);
    return vec3(0.5 + vec2(dot(o, R), dot(o, U)) / f * k, f);
  }
`;

/* ---- çıkış: dizeleme + banding kırıcı dither ----------------------------- */
/*
 * Koyu teal gradyanlar 8-bit tamponda ZORUNLU olarak bantlanır. 1 LSB'lik
 * beyaz gürültü dither bunu tamamen öldürüyor — sRGB dönüşümünden SONRA.
 * Hue koruyan diz: kanalları eşit bölüyor, yani #6FE0F0 morarmıyor/beyazlamıyor.
 * Yalnız çekirdek kontrollü biçimde beyaza itiliyor (patlayan ışık beyazdır).
 */
export const CIKIS_GLSL = /* glsl */ `
  vec3 dizle(vec3 c) {
    float m = max(max(c.r, c.g), c.b);
    if (m < 1e-4) return c;
    // Patlayan ışık beyazdır — ama yalnız ÇEKİRDEK. Hale cyan kalır.
    c = mix(c, vec3(m), smoothstep(3.0, 14.0, m) * 0.70);
    // Üstel diz. Önceki hali c/(1 + max(0, m-0.82)*1.15) idi: m>1 olan HER
    // ŞEYİ ~0.85'e basan bir duvardı. Sonuç: deliğin çekirdeği (m≈24) ile halesi
    // (m≈1.3) aynı değere düşüyor, yani sahnenin "tek keskin parlak nokta"sı
    // düz bir lekeye dönüşüyordu. Bu eğri sıralamayı koruyor: mid'ler yerinde
    // kalıyor, çekirdek gerçekten patlıyor. Tek çarpan → hue bozulmaz.
    return c * ((1.0 - exp(-m)) / m);
  }
`;


/**
 * SARNIÇ AKINTISI — dalga alanının tek kaynağı.
 *
 * Aynı fonksiyon üç yerde çalışır ve üçü de birbirine bağlı kalmak zorunda:
 *   1. su yüzeyinin shader'ı (yansımayı öteleyen eğim)
 *   2. sütun shader'ı (dipteki aydınlık bandın fazı)
 *   3. JS (alttaki disiplin şeridinin ışığı)
 * Bu yüzden GLSL ve TS sürümleri yan yana, aynı sabitlerle duruyor.
 *
 * Motif notu: bu alan EŞ MERKEZLİ HALKA DEĞİL. Kaynak noktası yok, cephe var:
 * tek yönlü doğrusal bir kabarma sütun ormanının içinden yanlamasına geçer.
 * (Halka / yörünge / orbit motifi bu projede yasak.)
 */

/** Kabarmanın yürüdüğü yön — çoğunlukla +x, biraz +z. Cephe çizgisi koridora
 *  boylamasına uzanır, yani dalga sütunları soldan sağa tek tek geçer. */
const YON_HAM: [number, number] = [0.92, 0.39];
const YON_BOY = Math.hypot(YON_HAM[0], YON_HAM[1]);
export const YON: [number, number] = [YON_HAM[0] / YON_BOY, YON_HAM[1] / YON_BOY];

/** Zarf genişliği (W²) ve salınım frekansı: tek bir kabarma + tek bir çukur. */
const W2 = 46;
const K = 0.44;

/** Kabarmanın kazancı. Mikro kırışıklığa göre baskın olmak ZORUNDA: aksi halde
 *  su "genel amaçlı dalgalanma" gibi okunuyor ve tek cephe kayboluyor. */
const KAZANC = 1.6;

/** Cephe, dot(p,YON) ekseninde BAS'tan BAS+MENZIL'e yürür, sonra başa sarar. */
export const BAS = -46;
export const MENZIL = 78;
export const HIZ = 4.0; // birim/sn → tam geçiş ~19.5 sn, iki cephe → ~10 sn'de bir olay

/** Hareket kapalıyken donan kare: kabarma koridorun ortasına yakın durur. */
export const DURGUN_CEPHE: [number, number] = [-2, -45];
export const DURGUN_T = 4;

/** Yürüyen cephe çiftinin t anındaki konumu. İki cephe yarım periyot kaydırılır
 *  ki kadrajda çoğu zaman bir kabarma bulunsun. */
export function cepheler(t: number): [number, number] {
  const x = BAS + ((t * HIZ) % MENZIL);
  const y = BAS + ((t * HIZ + MENZIL * 0.5) % MENZIL);
  return [x, y];
}

/** Tek cephenin profili: gauss zarfı içinde tek salınım = düz bir kabarma. */
function kabarma(d: number): number {
  return Math.exp(-(d * d) / W2) * Math.sin(d * K);
}

/** JS tarafı örnekleme — yalnız kabarma terimi (mikro dalgalanma gereksiz). */
export function suKabarmasi(
  x: number,
  z: number,
  cephe: readonly [number, number],
): number {
  const d = x * YON[0] + z * YON[1];
  return KAZANC * (kabarma(d - cephe[0]) + kabarma(d - cephe[1]));
}

/**
 * GLSL karşılığı. Hem su hem sütun shader'ına aynen enjekte edilir.
 * mikroPay: yüksek frekanslı kırışıklığın payı — uzakta piksel altına düşüp
 * aliasing yaptığı için mesafeye göre söndürülür.
 */
export const DALGA_GLSL = /* glsl */ `
float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float gurultu2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}
float kabarma(float d) {
  return exp(-(d * d) / ${W2.toFixed(1)}) * sin(d * ${K.toFixed(3)});
}
float suAlani(vec2 p, vec2 yon, vec2 cephe, float t, float mikroPay) {
  float d = dot(p, yon);
  float s = ${KAZANC.toFixed(2)} * (kabarma(d - cephe.x) + kabarma(d - cephe.y));

  // Mikro kırışıklık cephe eksenine göre hafif ANİZOTROP örnekleniyor: dalga
  // yönünde biraz daha hızlı, cephe boyunca (q.y) yavaş. Kaynak noktası yok,
  // cephe var → kapalı halka üretmiyor.
  //
  // İki tuzak arasında duruyoruz ve İKİSİNİ DE gördük:
  //  · İZOTROP gürültü kapalı halkalar basıyordu (yasak motif + "su birikintisi").
  //  · AŞIRI ANİZOTROP (0.85/0.22 ≈ 4:1) gürültü ise izo-eğrilerini cepheye
  //    paralel UZUN SIRTLARA çeviriyordu; yansıma bu sırtlarda düzenli olarak
  //    kırılınca su "oluklu plastik" gibi şeritleniyordu. RENDER'DA GÖRÜLDÜ.
  // Çözüm: oran ~2:1'e indirildi (sırt yok, yön hissi var) ve frekans
  // düşürüldü — kırışıklık değil GENİŞ, tembel bir kıpırtı. Sarnıç suyu
  // durgundur: neredeyse kusursuz ayna, tek olay kabarmadır.
  vec2 q = vec2(d, dot(p, vec2(-yon.y, yon.x)));
  float m = gurultu2(vec2(q.x * 0.40, q.y * 0.20) + vec2(t * 0.16, 0.0)) * 0.045
          + gurultu2(vec2(q.x * 0.92, q.y * 0.44) - vec2(t * 0.30, 0.0)) * 0.016;
  return s + m * mikroPay;
}
`;

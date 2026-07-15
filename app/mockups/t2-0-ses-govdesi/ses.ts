/*
 * SES GÖVDESİ — paylaşılan matematik.
 *
 * Buradaki iki şey bütün sahneyi sürüyor:
 *   1. telGenlikleri(t) → 7 telin anlık genliği. Aynı 7 sayı hem cookie
 *      shader'ına (gölge bulanıklığı) hem de DOM'a (disiplin şeridi) gidiyor.
 *      Tek kaynak: ekrandaki etiket ile ışıktaki gölge ASLA ayrışamaz.
 *   2. kesit(s) → gövdenin z boyunca daralma profili. Kaburgalar da, ses
 *      tablasının kenar çizgisi de bu tek fonksiyondan türüyor.
 */

// ---- gövde ölçüleri (mimari ölçek: bir ud değil, bir udun İÇİ) ------------
export const TABLA_Y = 6.0; // ses tablası (tavan)
export const Z_KUYRUK = -16;
export const Z_BOYUN = 24;
export const EN_YARI = 9.0; // belde yarı genişlik
export const DERINLIK = 8.6; // tabladan dibe

export const KABURGA_SAYI = 21; // gerçek ud teknesi gibi tek sayı
export const Z_BOLUM = 132;

/** Kaburga demetinin z boyunca daralması. s=0 kuyruk takozu, s=1 boyun takozu.
 *  Bel s≈0.38'de: kamera belin biraz gerisinde durup öne, boyuna bakıyor. */
export function kesit(s: number) {
  const c = Math.min(Math.max(s, 0), 1);
  return 0.1 + 0.9 * Math.pow(Math.sin(Math.PI * Math.pow(c, 0.72)), 1.15);
}

export function zdenS(z: number) {
  return (z - Z_KUYRUK) / (Z_BOYUN - Z_KUYRUK);
}

// ---- teller ---------------------------------------------------------------
export const TEL_SAYI = 7; // disciplines.length ile birebir
const PLUCK_ARA = 0.62; // ardışık iki tel arasındaki gecikme
const SONUM = 1.75; // genlik zaman sabiti (s)
export const CEVRIM = TEL_SAYI * PLUCK_ARA;

/** reduced-motion tek karesi. 2.9'da beş tel sönümün ortasında, ikisi
 *  durgun → donmuş karede bile "keskin çizgi ↔ bulanık bant" farkı okunuyor. */
export const DURGUN_T = 2.9;

/**
 * Tırmalama sırayla 0→1→…→6→0 dolaşıyor: tema "sirkülasyon", fikir hiçbir
 * telde durmuyor. Sönüm süresi tırmalama aralığından uzun → aynı anda birkaç
 * tel birden çınlıyor; gövde hepsini üst üste taşıyor.
 */
export function telGenlikleri(t: number, dis: number[]) {
  for (let i = 0; i < TEL_SAYI; i++) {
    let dt = (t - i * PLUCK_ARA) % CEVRIM;
    if (dt < 0) dt += CEVRIM;
    dis[i] = Math.exp(-dt / SONUM);
  }
  return dis;
}

// ---- cookie shader --------------------------------------------------------
/*
 * SpotLight.map olarak her karede yeniden çizilen 512² doku. İçinde ÜÇ engel
 * üst üste duruyor — üçü de gerçek, üçü de sahnedeki bir nesnenin ışık
 * kaynağından görünen siluetı:
 *
 *   · rozet (gül) kafesi  → ışığın geçtiği delikler = dantel
 *   · 7 tel               → sabit x'te düz çizgiler; bulanıklığı = genlik
 *   · bas barı            → tablanın altındaki dev kirişin siluetı, v bandı
 *
 * NEDEN GÖLGE HARİTASI YOK: ışık kaynağı rozetin ÜSTÜNDE, rozet ve teller de
 * kiriş de kaynak ile tekne arasında. Nokta kaynak için bir engelin kestiği
 * ışın kümesi = o engelin kaynaktan görünen siluetinin konisi; yani projektif
 * bir dokuda birebir kodlanabilir. Shadow map'in vereceği şeyi cookie zaten
 * matematiksel olarak tam veriyor — üstelik penumbra genişliği elimde kalıyor
 * (shadow map'te kalmazdı). Bkz. uPenumbra.
 */
export const COOKIE_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uGenlik[${TEL_SAYI}];
  uniform float uVLo;      // bas barı siluetinin alt kenarı (cookie v)
  uniform float uVHi;      // üst kenarı
  uniform float uPenumbra; // rozet açıklığının açısal boyundan gelen yarı gölge
  uniform float uParlak;   // gövde rezonansı: çok hafif genel nabız

  varying vec2 vUv;

  const float PI = 3.141592653589793;

  /** ang yönünde, aralik periyotlu, yari kalınlıkta paralel çubuk ailesi. */
  float cubukAilesi(vec2 q, float ang, float aralik, float yari) {
    float t = dot(q, vec2(cos(ang), sin(ang)));
    float f = abs(fract(t / aralik + 0.5) - 0.5) * aralik;
    return 1.0 - smoothstep(yari, yari + 0.0075, f);
  }

  /** Rozetin ahşap kafesi. 12 katlı simetri + üç çizgi ailesi = girih dokusu.
   *  Doku dosyası yok; her şey burada. 1.0 = ahşap (ışık geçmez). */
  float rozetKafesi(vec2 p) {
    float d = length(p);
    float a = atan(p.y, p.x);
    float sek = 2.0 * PI / 12.0;
    float af = mod(a + sek * 0.5, sek) - sek * 0.5;
    vec2 q = vec2(cos(af), sin(af)) * d;

    // Çubuklar İNCE ve aralıklı: ilk denemede (0.168 aralık / 0.0175 kalınlık)
    // kafes dokunun yarısından fazlasını kaplıyordu → hem ışığın çoğunu yiyip
    // sahneyi neredeyse simsiyah bırakıyor hem de kaburgalara düştüğünde
    // dantel değil yüksek frekanslı gürültü olarak okunuyordu. Rozet AHŞAP
    // değil IŞIK olmalı: delikler baskın, ahşap ince bir ağ.
    float ahsap = 0.0;
    ahsap = max(ahsap, cubukAilesi(q, 0.0, 0.30, 0.012));
    ahsap = max(ahsap, cubukAilesi(q, PI / 3.0, 0.30, 0.012));
    ahsap = max(ahsap, cubukAilesi(q, 2.0 * PI / 3.0, 0.30, 0.012));
    // ince ikinci aile: kafesin içindeki dolgu. Tam opak değil → dantelin içi
    // tek değerde ölü kalmıyor.
    ahsap = max(ahsap, cubukAilesi(q, PI / 6.0, 0.155, 0.0055) * 0.5);
    // merkez göbeği: rozetin ortasındaki dolu madalyon
    ahsap = max(ahsap, 1.0 - smoothstep(0.055, 0.08, d));
    return clamp(ahsap, 0.0, 1.0);
  }

  /**
   * Tel gölgesi. Titreşen tel yörüngesinin uçlarında YAVAŞLAR (basit harmonik
   * hareket) → orada birim zamanda daha çok ışık keser. Yoğunluk arcsine
   * dağılımı: 1/sqrt(1-x²). Sonuç, bulanık bandın iki kenarında iki koyu ray.
   * Durgun telde (r = kalınlık) yoğunluk her yerde 1'i aşar → dolu, keskin
   * çizgi. Yani aynı formül hem "duran tel" hem "çalınan tel".
   */
  float telGolgesi(vec2 p) {
    const float KALINLIK = 0.0075;
    float g = 0.0;
    for (int i = 0; i < ${TEL_SAYI}; i++) {
      float u0 = -0.36 + 0.12 * float(i);
      float r = max(KALINLIK, uGenlik[i] * 0.062);
      float x = (p.x - u0) / r;
      float ax = abs(x);
      float yog = (KALINLIK / r) * (1.55 / sqrt(max(1.0 - ax * ax, 0.006)));
      g = max(g, ax < 1.0 ? clamp(yog, 0.0, 1.0) : 0.0);
    }
    return g;
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;

    float isik = 1.0 - rozetKafesi(p);
    // Rozetin dış kenarı BİLEREK geniş ve yumuşak: çemberin kendisi asla
    // kadraja girmesin, sadece döktüğü ışık görünsün. Halka motifi yasak.
    isik *= 1.0 - smoothstep(0.62, 1.12, length(p));

    isik *= 1.0 - telGolgesi(p) * 0.90;

    // Bas barı: v ekseninde tam genişlikte bant. Kiriş x boyunca uzanıyor ve
    // ışık x=0'da → siluetinin kenarları cookie'de u eksenine paralel doğrular.
    float band =
      smoothstep(uVLo - uPenumbra, uVLo + uPenumbra, vUv.y) *
      (1.0 - smoothstep(uVHi - uPenumbra, uVHi + uPenumbra, vUv.y));
    isik *= 1.0 - band * 0.93;

    // Dantelin çekirdeği #6FE0F0, kuyruğu #22B8DC. Sıcak hiçbir şey yok.
    vec3 renk = mix(vec3(0.133, 0.722, 0.863), vec3(0.437, 0.878, 0.941), pow(isik, 1.6));
    gl_FragColor = vec4(renk * isik * uParlak, 1.0);
  }
`;

export const COOKIE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/*
 * AŞINMA — GLSL kaynakları.
 *
 * Üç geçiş var:
 *   1) KABARTMA_FS  → taşın yükseklik alanını bir kereliğine RT'ye pişirir
 *                     (dosya yok, her şey prosedürel + tileable).
 *   2) ASINDIRMA_FS → 512² ping-pong: imlecin taşta biriktirdiği cila.
 *   3) TAS_FS       → asıl yüzey: POM + yalayan ışık + öz-gölge.
 *
 * Hepsi #version 300 es olarak derleniyor ama `glslVersion: THREE.GLSL3`
 * VERİLMİYOR — ve bu bilerek.
 *
 * TUZAK (bir kez bu sahneyi tamamen öldürdü): three, RawShaderMaterial
 * olmayan HER ShaderMaterial'ı zaten koşulsuz `#version 300 es`e çeviriyor
 * (WebGLProgram.js:864), yani textureLod GLSL3 bayrağı olmadan da var.
 * Bayrağın tek etkisi şu iki satırı SİLMEK (WebGLProgram.js:875-876):
 *     layout(location = 0) out highp vec4 pc_fragColor;
 *     #define gl_FragColor pc_fragColor
 * Bayrak verilince gl_FragColor tanımsız kimlik olur → üç shader da derlenmez
 * → sahne hiç çizilmez. Üstelik clear color CSS zemini ile aynı olduğu için
 * hata sessizdir. Aşağıda gl_FragColor kullanıldığı sürece bayrağı EKLEME.
 */

/** Tam ekran üçgen/quad geçişlerinin ortak vertex'i. */
export const QUAD_VS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Tileable value noise + worley. Periyot verilir ki doku kenarında dikiş olmasın. */
const GURULTU = /* glsl */ `
// sin tabanlı hash yerine Hoskins: taş kabuğu her pikselde 70+ kez
// örnekleniyor, transandantal sayısını düşürmek doğrudan fps.
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float vnoise(vec2 p, float per) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(mod(i + vec2(0.0, 0.0), per));
  float b = hash21(mod(i + vec2(1.0, 0.0), per));
  float c = hash21(mod(i + vec2(0.0, 1.0), per));
  float d = hash21(mod(i + vec2(1.0, 1.0), per));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbmT(vec2 p, float per, int oct) {
  float s = 0.0, a = 0.5, nrm = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * vnoise(p, per);
    nrm += a;
    p *= 2.0; per *= 2.0; a *= 0.5;
  }
  return s / max(nrm, 1e-4);
}

// x = F1, y = F2. F2-F1 çatlak ağını verir.
vec2 worleyT(vec2 p, float per) {
  vec2 ip = floor(p), fp = fract(p);
  float f1 = 9.0, f2 = 9.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(mod(ip + g, per));
      vec2 r = g + o - fp;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; }
      else if (d < f2) { f2 = d; }
    }
  }
  return vec2(sqrt(f1), sqrt(f2));
}
`;

/**
 * 1) Kireçtaşı kabartması. r = yükseklik (0..1).
 * Çakıllı worley + geniş benekleme + yer yer alet izi çizgileri, üstüne
 * F2-F1'den kazınan çatlak ağı. Yalayan ışık bu çatlaklarda yaşıyor.
 */
export const KABARTMA_FS = /* glsl */ `
${GURULTU}
varying vec2 vUv;

void main() {
  vec2 p = vUv;

  // TILE 8 m. Worley 13 → ~60 cm hücre = kurumuş göl yatağı / çatlamış çamur
  // okunuyordu, kireçtaşı değil. 23 ise ters uca kaçtı: doku büsbütün yok oldu
  // ve sahne CSS gradyanına döndü. 17 taşın tanesini koruyor, çamur desenini
  // kırıyor. Bu üç sayı gözle ayarlandı; kâğıt üstünde değil.
  vec2 w1 = worleyT(p * 17.0, 17.0);
  vec2 w2 = worleyT(p * 41.0 + 7.3, 41.0);
  vec2 w3 = worleyT(p * 89.0 + 2.1, 89.0);

  float cakil = (1.0 - w1.x) * 0.44 + (1.0 - w2.x) * 0.33 + (1.0 - w3.x) * 0.23;

  float catlak = smoothstep(0.10, 0.0, w1.y - w1.x) * 0.52
               + smoothstep(0.055, 0.0, w2.y - w2.x) * 0.30;

  float benek = fbmT(p * 5.0, 5.0, 5);

  // Alet izi: tam sayı frekans → kusursuz tileable çizgi demeti.
  float faz = (p.x * 29.0 + p.y * 17.0) * 6.2831853 + fbmT(p * 9.0, 9.0, 3) * 9.0;
  float iz = sin(faz) * 0.5 + 0.5;
  iz *= smoothstep(0.40, 0.78, fbmT(p * 4.0 + 13.0, 4.0, 3)); // sadece bazı yamalarda

  float h = cakil * 0.60 + benek * 0.31 + iz * 0.09;
  h -= catlak * 0.28;
  h = pow(clamp(h, 0.0, 1.0), 1.12);

  gl_FragColor = vec4(h, benek, catlak, 1.0);
}
`;

/**
 * 2) İmleç aşındırması. r kanalında birikir, exp ile çok yavaş siliniyor.
 * Nokta değil kapsül basıyoruz: hızlı fare hareketinde iz kesikli çıkmasın.
 */
export const ASINDIRMA_FS = /* glsl */ `
uniform sampler2D uOnceki;
uniform vec2  uPlaneSize;
uniform vec2  uA;       // önceki imleç (uv)
uniform vec2  uB;       // şimdiki imleç (uv)
uniform float uAcik;    // imleç yüzeyde mi
uniform float uDt;
uniform float uYaricap; // metre
varying vec2 vUv;

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float onceki = texture2D(uOnceki, vUv).r;
  onceki *= exp(-uDt / 16.0); // ~11 sn yarı ömür: taş yavaşça geri kabalaşıyor

  vec2 p = vUv * uPlaneSize;
  float d = sdSeg(p, uA * uPlaneSize, uB * uPlaneSize);
  float firca = exp(-(d * d) / (uYaricap * uYaricap)) * uAcik * uDt * 1.5;

  gl_FragColor = vec4(min(onceki + firca, 1.0), 0.0, 0.0, 1.0);
}
`;

export const TAS_VS = /* glsl */ `
varying vec3 vDunya;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDunya = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/**
 * 3) Taş yüzeyi.
 *
 * Okunabilirlik burada çözülüyor ve perde yok: aşınma maskesi 1'e giderken
 * kabartma genliği ~0'a iniyor. Yalayan ışık altında düz yüzey = tek bir
 * sabit N·L = olaysız, sakin, kontrastsız. Kaba taş ise aynı ışıkta
 * çıldırıyor. Yani metnin altındaki sükûnet fizikten geliyor.
 */
export const TAS_FS = /* glsl */ `
${GURULTU}

uniform sampler2D uKabartma;
uniform sampler2D uAsinma;
uniform float uZaman;
uniform float uTile;        // bir kabartma karesi kaç metre
uniform float uDokuBoy;     // kabartma dokusunun piksel boyu
uniform float uGenlik;      // metre cinsinden ham kabartma yüksekliği
uniform vec2  uPlaneSize;
uniform vec2  uPlaneMerkez;
uniform vec3  uGunes;       // yüzeyden ışığa, normalize
uniform vec3  uGunesRenk;
uniform vec3  uGokRenk;
uniform vec3  uGolgeRenk;
uniform vec3  uPus;
uniform vec3  uAlbedo;
uniform float uGunesSid;
uniform float uOrtamSid;
uniform float uSis;
uniform float uAdim;        // POM azami adım
uniform float uGolgeAdim;
uniform vec2  uYolN;        // yola dik birim vektör
uniform vec2  uYolD;        // yol yönü birim vektör
uniform vec2  uYolP0;
uniform float uYolEn;
uniform float uCukur;       // aşınan yolun metre cinsinden çökmesi
uniform float uPikselAci;

varying vec3 vDunya;

// ---- aşınma alanı ---------------------------------------------------------

// Soyut, silinmekte olan bir geçiş izi. Harf/sembol değil: sadece yön.
float izSeridi(vec2 xz, vec2 d, vec2 p0, float en, float boy) {
  vec2 n = vec2(-d.y, d.x);
  vec2 rel = xz - p0;
  float s = dot(rel, n) + (vnoise(xz * 0.34, 4096.0) - 0.5) * 1.2;
  float a = dot(rel, d);
  float omur = smoothstep(-boy, -boy * 0.5, a) * (1.0 - smoothstep(boy * 0.5, boy, a));
  return (1.0 - smoothstep(en * 0.25, en, abs(s))) * omur * 0.44;
}

float asinmaAlani(vec2 xz) {
  // Asıl yol: kameraya yakın dar bir girişten başlıyor, mekâna girdikçe
  // yelpaze gibi açılıyor. Perspektif zaten uzağı sıkıştırdığı için bu hem
  // fiziksel olarak doğru (kapı ağzından yayılan ayak trafiği) hem de
  // ekranda dengeli duruyor.
  vec2 rel = xz - uYolP0;
  float boyunca = dot(rel, uYolD);
  float dik = dot(rel, uYolN);

  // ESKİ: (0.20 + 0.98 * smoothstep(-6, 10, boyunca)) — yol kameraya yakın
  // yerde DARALIYORDU. Ama künye satırı (disiplinler) tam da o yakın alanda
  // duruyor: metnin en küçük punto satırı sahnenin en pürüzlü yerine denk
  // geliyordu, yani okunabilirlik fizikten değil şanstan geliyordu.
  //
  // Ters uca da kaçmamak lazım: 0.62 + uYolEn 8.0 denendi ve cilalı alan tüm
  // kadrajı yuttu — taş bitti, sahne düz gradyana döndü (jürinin 1 numaralı
  // ret sebebi). 0.42 dengesi: metin sütunu sakin, kenarlar hâlâ taş.
  float en = uYolEn * (0.42 + 0.50 * smoothstep(-8.0, 12.0, boyunca));
  en += sin(boyunca * 0.42) * 0.26 + sin(boyunca * 0.17 + 1.7) * 0.44;
  en = max(en, 0.5);

  // Kenar hiçbir yerde cetvelle çizilmiş olmasın. Genlik kısıldı (0.85→0.32):
  // ±en*0.85'lik salınım kenarı metin sütununun içine sokabiliyordu.
  dik += (fbmT(xz * 0.13, 4096.0, 3) - 0.5) * en * 0.32;

  float yol = 1.0 - smoothstep(en * 0.55, en * 1.12, abs(dik));

  // 45-66 sn'lik döngülerde yüzeye çıkıp silinen ikincil izler.
  float iz = 0.0;
  iz += izSeridi(xz, vec2(0.94, 0.34), vec2(-6.5, 2.0), 1.05, 15.0)
        * (0.5 + 0.5 * sin(uZaman * 0.1396));
  iz += izSeridi(xz, vec2(-0.42, 0.91), vec2(5.0, 4.5), 0.85, 12.0)
        * (0.5 + 0.5 * sin(uZaman * 0.0952 + 2.4));
  iz += izSeridi(xz, vec2(0.71, -0.70), vec2(-2.0, -4.5), 1.35, 18.0)
        * (0.5 + 0.5 * sin(uZaman * 0.1178 + 4.1));

  // İmleç: kullanıcının kendi elinin taşta bıraktığı pay.
  vec2 wuv = (xz - uPlaneMerkez) / uPlaneSize + 0.5;
  float el = texture2D(uAsinma, wuv).r;

  return clamp(yol + iz + el, 0.0, 1.0);
}

// ---- yükseklik ------------------------------------------------------------

float hLod(vec2 xz, float lod) { return textureLod(uKabartma, xz / uTile, lod).r; }
float hImp(vec2 xz) { return texture2D(uKabartma, xz / uTile).r; }

void main() {
  vec3 P = vDunya;
  vec3 V = normalize(cameraPosition - P);
  float uzak = distance(cameraPosition, P);

  // Uzakta kabartmayı söndür: hem aliasing biter hem de ayağının dibindeki
  // taneli taşın pusa çözülmesi sahnenin derinliğini veriyor.
  //
  // ESKİ (6, 17): kabartma 17 m'de tükeniyordu, ama kadrajın üst üçte ikisi
  // zaten 17 m'den uzak — yani ekranın çoğu düz gradyandı ve "gerçek sahne"
  // iddiası orada çöküyordu. (12, 34) taşı ufka kadar taşıyor. Perf ücreti
  // sınırlı: adım sayısı zaten ayrinti ile ölçekleniyor (uzak piksel ~4 adım).
  float ayrinti = 1.0 - smoothstep(12.0, 34.0, uzak);

  float asinma = asinmaAlani(P.xz);

  // Cila = düzlük. Genlik ~0'a inince POM ve öz-gölge bile atlanıyor:
  // metnin durduğu bölge hem sakin hem de bedava.
  float genlik = uGenlik * mix(1.0, 0.06, asinma) * ayrinti;
  float purtuk = mix(0.92, 0.18, asinma);

  float texelM = uTile / uDokuBoy;
  float pikselM = max(uzak * uPikselAci, texelM);
  float lod = clamp(log2(pikselM / texelM), 0.0, 7.0);

  vec2 vur = P.xz;
  float h = 0.5;

  if (genlik > 0.0012) {
    float adim = max(mix(4.0, uAdim, ayrinti), 2.0);
    vec2 dXZ = -(V.xz / max(V.y, 0.12)) * (genlik / adim);
    float dD = 1.0 / adim;
    vec2 cur = P.xz;
    float curD = 0.0;
    float curH = 1.0 - hLod(cur, lod);
    for (int i = 0; i < 24; i++) {
      if (float(i) >= adim) break;
      if (curD >= curH) break;
      cur += dXZ;
      curD += dD;
      curH = 1.0 - hLod(cur, lod);
    }
    vec2 onc = cur - dXZ;
    float oncH = 1.0 - hLod(onc, lod);
    float sonra = curH - curD;
    float once = oncH - (curD - dD);
    float w = clamp(sonra / (sonra - once + 1e-5), 0.0, 1.0);
    vur = mix(cur, onc, w);
    h = 1.0 - mix(curD, curD - dD, w);
  } else {
    h = hImp(P.xz);
  }

  // ---- normal ----
  float e = texelM * 1.6;
  float hL = hImp(vur - vec2(e, 0.0));
  float hR = hImp(vur + vec2(e, 0.0));
  float hD = hImp(vur - vec2(0.0, e));
  float hU = hImp(vur + vec2(0.0, e));
  float egimX = (hR - hL) * genlik / (2.0 * e);
  float egimZ = (hU - hD) * genlik / (2.0 * e);

  // Aşınan yol gerçekten çukurlaşıyor: eşik taşı gibi. Maskenin gradyanı
  // yolun omzunda çok hafif, geniş bir ışık kırılması bırakıyor.
  float ea = 0.35;
  float ax = (asinmaAlani(P.xz + vec2(ea, 0.0)) - asinma) / ea;
  float az = (asinmaAlani(P.xz + vec2(0.0, ea)) - asinma) / ea;
  egimX -= uCukur * ax;
  egimZ -= uCukur * az;

  vec3 N = normalize(vec3(-egimX, 1.0, -egimZ));

  // ---- öz-gölge: 4°'lik ışıkta gölgeler uzun, sahnenin dramı burada ----
  float golge = 1.0;
  if (genlik > 0.0012 && uGunes.y > 0.002) {
    float cikis = (1.0 - h) * genlik;
    vec2 ld = normalize(uGunes.xz);
    float yol = min(cikis * length(uGunes.xz) / uGunes.y, genlik * 26.0);
    float kapali = 0.0;
    for (int i = 1; i <= 10; i++) {
      if (float(i) > uGolgeAdim) break;
      float t = float(i) / uGolgeAdim;
      float hs = hLod(vur + ld * yol * t, lod) * genlik;
      float ry = h * genlik + cikis * t;
      kapali = max(kapali, clamp((hs - ry) / (genlik * 0.30), 0.0, 1.0) * (1.0 - t * 0.5));
    }
    golge = 1.0 - kapali * 0.9;
  }

  // ---- ışıklandırma ----
  float ao = mix(0.42, 1.0, smoothstep(0.12, 0.72, h));
  ao = mix(1.0, ao, clamp(genlik / max(uGenlik, 1e-4), 0.0, 1.0));

  vec3 albedo = uAlbedo * mix(0.94, 1.0, h) * mix(1.0, 0.9, asinma);

  float ndl = max(dot(N, uGunes), 0.0);
  vec3 gunes = uGunesRenk * uGunesSid * ndl * golge;
  vec3 ortam = mix(uGolgeRenk, uGokRenk, ao) * uOrtamSid;
  vec3 col = albedo * (gunes + ortam);

  // spekülar: cilalı yol dar loblu, kaba taş neredeyse mat
  vec3 Hv = normalize(uGunes + V);
  float a2 = max(purtuk * purtuk, 0.002);
  float ndh = max(dot(N, Hv), 0.0);
  float dGGX = a2 * a2 / (3.14159 * pow(ndh * ndh * (a2 * a2 - 1.0) + 1.0, 2.0));
  col += uGunesRenk * dGGX * ndl * golge * 0.35;

  // Fresnel × pus. Uzağa doğru bakış açısı yatıklaştıkça cilalı yol pusu
  // aynalıyor: "heykelin öpüle öpüle parlayan ayağı" ta oradan geliyor,
  // ama metnin durduğu yakın bölgede Fresnel düşük, yani sakin kalıyor.
  float f = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 yansima = mix(uGolgeRenk, uPus, smoothstep(-0.15, 0.55, reflect(-V, N).y));
  col += yansima * f * (1.0 - purtuk * 0.85) * 0.9;

  float sis = 1.0 - exp(-pow(uzak * uSis, 2.0));
  col = mix(col, uPus, sis);

  gl_FragColor = vec4(col, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/*
 * YALAYAN IŞIK — parşömen yüzeyinin gölgelendiricisi.
 *
 * Sahnenin tamamı TEK plane + TEK yönlü ışık. Parçacık, FBO, post yok.
 * Yüksekliği vertex'te değil fragment'ta üretiyoruz: yüzey fiziksel olarak düz,
 * bütün kabartma normalden geliyor (analitik değil, fwidth ile piksel ayağına
 * kilitlenmiş sonlu fark → uzakta kendiliğinden alçak-geçiren, aliasing yok).
 *
 * OKUNABİLİRLİK BORCU SIFIR:
 * Metnin oturduğu kutu (ada) ekran uzayında maskeleniyor ve maske gradyanı
 * ÇARPIYOR — yani orada dh/dx = dh/dy = 0. Düz yüzeyde ışık ne açıdan gelirse
 * gelsin sapma = 0, yani gölge fiziksel olarak imkânsız. Bu bir perde değil;
 * o bölgeyi hiç yazmamış olmak.
 */

export const vertexShader = /* glsl */ `
varying vec2 vP;
varying vec3 vYerel;

void main() {
  vP = position.xy;
  vYerel = position.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;

#define ADA_SAY 4

#ifndef OCT
  #define OCT 3
#endif

uniform vec2 uRes;

// Ada = metnin kendi kutusu. xy = merkez, zw = yarı boyut (birim: ekran yüksekliği)
uniform vec4 uAda[ADA_SAY];
// x = köşe yarıçapı, y = pay, z = yumuşama, w = açık mı
uniform vec4 uAdaX[ADA_SAY];

// 7 disiplin = 7 kazıma katmanı (strata)
uniform float uW[7];    // ışığın azimutundan gelen ağırlık
uniform vec2 uOff[7];
uniform float uAng[7];  // satır doğrultusu
uniform float uSeed[7];

uniform float uAz;
uniform float uElev;
uniform float uAmb;
uniform float uKey;
uniform float uBump;
uniform float uStroke;
uniform float uMacro;
uniform float uFiber;
uniform float uRowD;
uniform float uSweep;
uniform float uSpec;
uniform float uShin;
uniform float uCoolAmt;
uniform float uVig;
uniform float uGrain;
uniform vec3 uAlbedo;
uniform vec3 uCool;
uniform vec3 uKeyCol;
uniform vec3 uSpecCol;
uniform vec3 uKamYerel;

varying vec2 vP;
varying vec3 vYerel;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < OCT; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + 19.7;
    a *= 0.5;
  }
  return s;
}

mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

/*
 * Tek kazıma katmanı: kendi açısında duran bir SAYFA, üstünde satır satır
 * kalem izleri. Harf değil — kazıma izi: satır bandı (gauss) × kelime aralığı
 * × kalem tiki. Yazının kendisi okunmuyor, yazılmış OLDUĞU okunuyor.
 */
float katman(vec2 p, vec2 off, float ang, float seed) {
  vec2 q = rot(-ang) * (p - off);

  // Sayfa dikdörtgeni: her katmanın kendi kenarı var, ışık dönünce
  // başka açıda duran BAŞKA bir sayfanın kenarı ortaya çıkıyor.
  vec2 d = abs(q) - vec2(4.85, 3.35);
  float sd = length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0);
  float sayfa = 1.0 - smoothstep(-0.5, 0.28, sd);
  if (sayfa < 0.004) return 0.0;

  // Kalem elle tutuluyor: satırlar birebir düz değil.
  vec2 w = q + 0.24 * vec2(
    vnoise(q * 0.62 + seed) - 0.5,
    vnoise(q * 0.62 + seed + 21.3) - 0.5
  );

  // Bant/kelime/iz üç ayrı maske; çarpımları çok dar tutulursa sayfada mürekkep
  // örtüsü %7'ye düşüyor ve ekranda "boş" okunuyor (ölçüldü). Gerçek bir yazı
  // bloğu ~%20 örtüyor — eşikler ona göre açıldı.
  float rows = w.y * uRowD;
  float rf = fract(rows) - 0.5;
  float bant = exp(-rf * rf * 15.0);
  if (bant < 0.03) return 0.0;

  float ri = floor(rows);
  float kelime = smoothstep(0.30, 0.60, vnoise(vec2(w.x * 1.45, ri * 3.1 + seed)));
  if (kelime < 0.012) return 0.0;

  float iz = vnoise(vec2(w.x * 10.5 + ri * 23.0, ri * 1.9 + seed));
  iz = smoothstep(0.26, 0.70, iz);

  return sayfa * bant * kelime * iz;
}

/* Yazının ham yüksekliği. uW[k] tamamen uniform → dallanma ıraksamıyor. */
float ham(vec2 p) {
  float h = 0.0;
  for (int k = 0; k < 7; k++) {
    if (uW[k] < 0.02) continue;
    h -= uW[k] * katman(p, uOff[k], uAng[k], uSeed[k]);
  }
  h *= uStroke;
  h += uMacro * (fbm(p * 0.21 + 4.3) - 0.5);
  return h;
}

/* Parşömenin kendi dokusu (yazı değil, malzeme). */
float lif(vec2 p) {
  return vnoise(p * 24.0) + 0.5 * vnoise(p * 55.0 + 8.1);
}

float adaMaske(vec2 s) {
  float m = 1.0;
  for (int i = 0; i < ADA_SAY; i++) {
    if (uAdaX[i].w < 0.5) continue;
    float r = uAdaX[i].x;
    vec2 hs = max(uAda[i].zw + vec2(uAdaX[i].y), vec2(r) + 0.0001);
    vec2 d = abs(s - uAda[i].xy) - (hs - vec2(r));
    float sd = length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
    m *= smoothstep(0.0, uAdaX[i].z, sd);
  }
  return m;
}

void main() {
  // Ekran uzayı, izotropik birim: yükseklik = 1.0
  vec2 s = gl_FragCoord.xy / uRes.y;
  float ada = adaMaske(s);

  // Sonlu fark adımı = pikselin düzlem üzerindeki ayak izi.
  float ex = max(fwidth(vP.x), 0.0006);
  float ey = max(fwidth(vP.y), 0.0006);

  float h0 = ham(vP);
  vec2 g = vec2(ham(vP + vec2(ex, 0.0)) - h0, ham(vP + vec2(0.0, ey)) - h0) / vec2(ex, ey);

  // İşte borç burada kapanıyor: adanın içinde gradyan sıfır.
  g *= ada;

  // Lif, yazı değil malzeme — adanın içinde de var ama %30'a iniyor ve
  // eğimi 1 dereceyi geçmiyor: gölge üretmez, sadece yüzeyi diri tutar.
  float lifLod = 1.0 - smoothstep(0.004, 0.011, max(ex, ey));
  float f0 = lif(vP);
  vec2 gf = vec2(lif(vP + vec2(ex, 0.0)) - f0, lif(vP + vec2(0.0, ey)) - f0) / vec2(ex, ey);
  g += gf * uFiber * lifLod * (0.30 + 0.70 * ada);

  g *= uBump;
  vec3 N = normalize(vec3(-g, 1.0));

  // TEK yönlü ışık, azimut turda, yükseklik sabit ve sıyırıcı.
  vec3 L = vec3(cos(uAz) * cos(uElev), sin(uAz) * cos(uElev), sin(uElev));
  vec3 V = normalize(uKamYerel - vYerel);

  float ndl = dot(N, L);
  float lam = max(ndl, 0.0);
  float dolgu = 0.5 + 0.5 * N.z;

  // Kaynak sonsuzda değil: ışığın geldiği yan geniş ve yumuşak biçimde parlak.
  float sweep = 1.0 + uSweep * clamp(dot(L.xy, vP) / 6.5, -1.0, 1.0);

  // Düz bir pikselin BURADA alacağı ışık. Ada tam olarak bu.
  float duzIsik = (uAmb + uKey * sin(uElev)) * sweep;
  float isik = (uAmb * dolgu + uKey * lam) * sweep;
  float sapma = isik - duzIsik;

  vec3 col = uAlbedo * duzIsik;
  col += uAlbedo * uKeyCol * max(sapma, 0.0) * 0.7;
  col = mix(col, uCool * (0.35 + 0.65 * duzIsik), clamp(-sapma * 3.2, 0.0, 1.0) * uCoolAmt);

  // Sıyırma açısında patlayan anizotropik parlama. İzler ışığa dik durduğu
  // için teğet doğrudan azimuttan geliyor (Kajiya-Kay).
  vec3 T = vec3(cos(uAz - 1.5707963), sin(uAz - 1.5707963), 0.0);
  vec3 H = normalize(L + V);
  float th = dot(T, H);
  float par = pow(sqrt(max(1.0 - th * th, 0.0)), uShin);
  float kabart = smoothstep(0.02, 0.30, length(g));
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
  par *= kabart * smoothstep(0.0, 0.10, ndl) * (0.30 + 1.5 * fres) * uSpec;
  col += uSpecCol * par;

  vec2 n = gl_FragCoord.xy / uRes - 0.5;
  col *= 1.0 - uVig * dot(n, n) * 2.2;

  // Film grenı: adanın düz alanında bantlaşmayı da öldürüyor.
  col += (hash21(gl_FragCoord.xy + uGrain) - 0.5) * 0.016;

  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

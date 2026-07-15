/**
 * KATLANMA — kâğıt katlama shader'ı.
 *
 * Tek büyük beyaz sayfa, tek sert ışık. Katlama tamamen vertex shader'da;
 * normal ise FRAGMENT'ta analitik olarak yeniden kuruluyor (tessellation'dan
 * bağımsız keskin sırt — interpolate edilmiş normal kullanılmıyor).
 *
 * Kat matematiği (tek katın (u,w) düzlemindeki haritası):
 *   u = kat çizgisine olan işaretli mesafe, w = düzlem dışı offset
 *   u <= 0            → dokunma (düz kalan taraf)
 *   0 < u < R*th      → yarıçapı R olan yaya sar:  polar(merkez=(0,R), rho=R-w)
 *   u >= R*th         → yayın ucundan teğet boyunca rijit devam
 * Bu harita C1 sürekli, yay boyunu korur (kâğıt esnemez) ve th ∈ (0,π) için
 * kalkan kanadın TAMAMI w>0'da kalır → kâğıt kendinden geçemez. Yani
 * self-intersection riski matematikle kapatıldı, açı aralığını daraltarak değil.
 */

export const NFOLD = 3;
/**
 * Kırık izleri iki bloğa ayrılıyor:
 *  [0, NPERM)        → KALICI kat ağı. Sayfa daha önce katlanıp açılmış: harita
 *                      gibi. Kadrajı boydan boya dolduran yapı bu. Kırıklar
 *                      sayfayı DÜZ yüzeylere bölüyor — metin bir yüzeyin
 *                      üstünde duruyor, yani yapı okunabilirliği bozmuyor.
 *  [NPERM, NCREASE)  → geçici izler için ring buffer (açılan katlar buraya yazar).
 */
export const NPERM = 5;
export const NCREASE = 21;

/** Hem kâğıt hem derinlik (gölge) materyalinin paylaştığı katlama çekirdeği. */
const ORTAK = /* glsl */ `
uniform vec2 uPaper;
uniform vec4 uFold[NFOLD];   // xy = kat normali (birim), z = çizgi mesafesi, w = dihedral açı
uniform vec4 uFoldR[NFOLD];  // x = kat yumuşatma yarıçapı

void katUygula(inout vec3 p, inout vec3 nr, vec4 f, float R) {
  float th0 = f.w;
  if (abs(th0) < 1e-4) return;

  vec3 N = vec3(f.xy, 0.0);          // u ekseni
  vec3 D = vec3(-f.y, f.x, 0.0);     // kat çizgisinin yönü
  vec3 W = vec3(0.0, 0.0, 1.0);      // w ekseni  (N x D = W → sağ el)

  float u = dot(p, N) - f.z;
  if (u <= 0.0) return;              // düz kalan taraf: tek normal, olaysız

  float s = th0 < 0.0 ? -1.0 : 1.0;  // katın yönü
  float th = abs(th0);
  float w = dot(p, W);
  float v = dot(p, D);

  float ws = s * w;
  float rho = R - ws;
  float L = R * th;                  // yay bandının yay boyu
  float phi = min(u / R, th);

  float uu, ww;
  if (u < L) {
    uu = rho * sin(phi);
    ww = R - rho * cos(phi);
  } else {
    float e = u - L;
    uu = rho * sin(th) + e * cos(th);
    ww = R - rho * cos(th) + e * sin(th);
  }
  p = N * (f.z + uu) + D * v + W * (s * ww);

  // Normal de aynı phi kadar dönüyor (analitik — türev/finite difference yok).
  float nu = dot(nr, N);
  float nv = dot(nr, D);
  float nws = s * dot(nr, W);
  float c = cos(phi), si = sin(phi);
  nr = N * (nu * c - nws * si) + D * nv + W * (s * (nu * si + nws * c));
}
`;

export const kagitVertex = /* glsl */ `
${ORTAK}

varying vec2 vPaper;

void main() {
  vec2 paper = position.xy * uPaper;   // plane [-0.5,0.5] → dünya birimleri
  vPaper = paper;

  vec3 p = vec3(paper, 0.0);
  vec3 nr = vec3(0.0, 0.0, 1.0);
  for (int i = 0; i < NFOLD; i++) katUygula(p, nr, uFold[i], uFoldR[i].x);

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}
`;

/** Gölge haritası pass'i: aynı vertex deformasyonu, boş fragment. */
export const derinlikFragment = /* glsl */ `
void main() { gl_FragColor = vec4(1.0); }
`;

export const kagitFragment = /* glsl */ `
${ORTAK}

varying vec2 vPaper;

// three modelMatrix'i sadece VERTEX prefix'ine koyuyor; fragment'ta elle
// tanımlanınca renderer yine dolduruyor (renderBufferDirect uniform map'e bakar).
uniform mat4 modelMatrix;

uniform vec4 uCrease[NCREASE];  // xy = normal, z = mesafe, w = güç (kalıcı kırık izi)
uniform vec2 uCreaseShape;      // x = sigma, y = genlik

uniform vec3 uCam;
uniform vec3 uLight;            // ışığa DOĞRU birim vektör
uniform mat4 uLightMat;
uniform sampler2D uShadow;
uniform sampler2D uFiber;
uniform vec2 uShadowTexel;
uniform vec2 uFiberScale;
uniform vec2 uCockleScale;
uniform float uCockleAmp;
uniform float uFiberAmp;
uniform float uShadowRadius;
uniform float uShadowBias;
uniform float uShadowNB;
uniform float uShadowFloor;
uniform vec3 uAlbedo;
uniform vec3 uKey;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uRim;
uniform vec3 uBack;
uniform float uExp;
uniform float uGrain;
uniform float uTime;

// Poisson diski — yumuşak ama dağılmayan penumbra.
const vec2 kDisk[12] = vec2[12](
  vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696,  0.457),
  vec2(-0.203,  0.621), vec2( 0.962, -0.195), vec2( 0.473, -0.480),
  vec2( 0.519,  0.767), vec2( 0.185, -0.893), vec2( 0.507,  0.064),
  vec2( 0.896,  0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598)
);

/**
 * Kırık izleri: .xy = yükseklik gradyanı, .z = ize düşen hafif koyuluk.
 * w'nin İŞARETİ kırığın yönü: + = vadi (içe kıvrık), − = sırt (dışa kıvrık).
 * Gerçek katlanmış harita vadi/sırt sırasıyla ilerler — hepsi aynı yöne
 * kıvrılırsa yüzey kabartma deseni gibi durur, katlanmış kâğıt gibi değil.
 */
vec3 kirikAlan(vec2 paper) {
  vec2 g = vec2(0.0);
  float dark = 0.0;
  float sg = uCreaseShape.x;
  float inv = 1.0 / (sg * sg);
  float sgW = sg * 1.7;
  float invW = 1.0 / (sgW * sgW);
  for (int i = 0; i < NCREASE; i++) {
    float st = uCrease[i].w;
    if (abs(st) <= 0.002) continue;
    float t = dot(paper, uCrease[i].xy) - uCrease[i].z;
    float e = exp(-0.5 * t * t * inv);
    // oluk profili z(t) = -A*e → dz/dt = A * t/sigma^2 * e
    g += (uCreaseShape.y * st * t * inv * e) * uCrease[i].xy;
    // Koyuluk yöne bağlı değil: her iki kırık da mürekkebi biraz tutar.
    dark += abs(st) * exp(-0.5 * t * t * invW);
  }
  return vec3(g, dark);
}

float golge(vec3 wp, vec3 N) {
  // Normal-offset: düz alanda acne'yi bias'a bel bağlamadan kesiyor.
  vec4 lp = uLightMat * vec4(wp + N * uShadowNB, 1.0);
  vec3 sc = lp.xyz / lp.w * 0.5 + 0.5;
  if (sc.z >= 1.0 || sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0) return 1.0;
  float sum = 0.0;
  for (int i = 0; i < NTAP; i++) {
    vec2 o = kDisk[i * (12 / NTAP)] * uShadowRadius * uShadowTexel;
    float d = texture2D(uShadow, sc.xy + o).x;
    sum += step(sc.z - uShadowBias, d);
  }
  return sum / float(NTAP);
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  // 1) Kâğıdın kendi yüzeyi: kalıcı kırık izleri + fiber + cockle (kâğıt
  //    hiçbir zaman düz değil; ışığın yüzeyde gezinmesini sağlayan bu).
  vec3 kg = kirikAlan(vPaper);
  vec2 g = kg.xy;
  g += (texture2D(uFiber, vPaper * uFiberScale).xy * 2.0 - 1.0) * uFiberAmp;
  g += (texture2D(uFiber, vPaper * uCockleScale + 0.37).xy * 2.0 - 1.0) * uCockleAmp;
  vec3 nr = normalize(vec3(-g, 1.0));

  // 2) Katları uygula — normal FRAGMENT'ta analitik döndürülüyor.
  vec3 p = vec3(vPaper, 0.0);
  for (int i = 0; i < NFOLD; i++) katUygula(p, nr, uFold[i], uFoldR[i].x);
  vec3 N = normalize(nr);
  // Kâğıdın iki yüzü var: 90°'yi geçen kat ön yüzünü kameradan çeviriyor, o
  // zaman gördüğümüz sayfanın ARKA yüzü — normali ters. Bu satır olmadan derin
  // kat delik gibi görünür (FrontSide) ya da yanlış aydınlanır.
  if (!gl_FrontFacing) N = -N;
  vec3 wp = (modelMatrix * vec4(p, 1.0)).xyz;
  vec3 V = normalize(uCam - wp);

  // 3) Tek sert directional + hemisphere fill + kâğıt yarı geçirgenliği.
  float ndl = dot(N, uLight);
  float key = max(ndl, 0.0);
  float lit = mix(uShadowFloor, 1.0, golge(wp, N));
  vec3 fill = mix(uGround, uSky, 0.5 + 0.5 * N.y);
  float back = max(-ndl, 0.0);

  vec3 alb = uAlbedo * (1.0 - 0.05 * clamp(kg.z, 0.0, 1.0));
  vec3 col = alb * (uKey * key * lit + fill + uBack * back);

  // Sırtlarda ince cyan rim — sadece ışık gören tarafta.
  float rim = pow(1.0 - abs(dot(N, V)), 4.0);
  col += uRim * rim * (0.35 + 0.65 * key);

  col = aces(col * uExp);
  col += (hash12(gl_FragCoord.xy + uTime) - 0.5) * uGrain;
  gl_FragColor = vec4(pow(max(col, 0.0), vec3(0.4545)), 1.0);
}
`;

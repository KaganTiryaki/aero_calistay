/*
 * EŞİK — shader'lar.
 *
 * Sahnenin tek iddiası şu: parlaklık farkı bir PERDE katmanından değil,
 * roughness'tan geliyor. Aşınmış (cilalı) bölge pürüzsüz → tek gök/kapı
 * ışığını düzgün yansıtıyor → doğal olarak açık, dokusuz, sakin bir havuz.
 * İşlenmemiş taş pürüzlü → ışığı saçıyor → dişli, orta ton. Metin havuzun
 * İÇİNDE duruyor; havuz da tam olarak binlerce kişinin bastığı yer.
 */

/** Ortak: gök/kapı ışık ortamı. Hem taşın yansıması hem görünen kubbe bunu kullanır. */
export const GOK_GLSL = /* glsl */ `
uniform vec3 gokTepe;
uniform vec3 gokUfuk;
uniform vec3 gokDip;
uniform vec3 kapiRenk;
uniform float kapiGuc;
uniform vec3 kapiYatay;   // ışığın yatay yönü (yüzeyden ışığa doğru)

vec3 gokRenk(vec3 d){
  float h = d.y;
  vec3 c = mix(gokUfuk, gokDip, smoothstep(0.0, -0.45, h));
  c = mix(c, gokTepe, smoothstep(0.0, 0.9, h));
  // Kapı: ufkun hemen üstünde geniş, parlak bir açıklık. Havuzun aynaladığı şey bu.
  vec3 yatay = normalize(vec3(d.x, 0.0, d.z) + vec3(1e-5));
  float az = max(dot(yatay, kapiYatay), 0.0);
  // Dar lob: kapı BİR açıklık, gökyüzü değil. Geniş olursa sahne süte döner.
  float lob = pow(az, 7.0) * exp(-pow((h - 0.17) / 0.30, 2.0));
  return c + kapiRenk * lob * kapiGuc;
}
`;

/** Tonemap + sRGB elle: three'nin chunk'larına bağımlılık yok, davranış kesin. */
export const CIKIS_GLSL = /* glsl */ `
// Khronos PBR Neutral — ACES'in aksine hue kaydırmaz; tek hue ailesi şart.
vec3 notralTon(vec3 c){
  const float d0 = 0.76; const float d1 = 0.15;
  float x = min(min(c.r, c.g), c.b);
  float f = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c -= f;
  float p = max(max(c.r, c.g), c.b);
  if (p < d0) return c;
  float dd = 1.0 - d0;
  float yeni = 1.0 - dd * dd / (p + dd - d0);
  c *= yeni / p;
  float g = 1.0 - 1.0 / (d1 * (p - yeni) + 1.0);
  return mix(c, vec3(yeni), g);
}
vec3 srgbe(vec3 c){
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
}
`;

// ---------------------------------------------------------------------------
// AŞINMA (FBO) — taş iyileşmez. Doyumlu birikim: w += güç * (1 - w).
// Plandaki "yavaş global renormalize" yerine bu: aynı işi (doyumu önleme)
// yapıyor ama geri gitmiyor. Mermer geri gelmez.
// ---------------------------------------------------------------------------
export const ASINMA_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D onceki;
uniform vec3 firca[24];      // xy = uv, z = güç
uniform int fircaSayi;
uniform float yaricap;       // dünya birimi
uniform vec2 alan;           // eşik alanının dünya boyutu (EN, BOY)
varying vec2 vUv;

void main(){
  float w = texture2D(onceki, vUv).r;
  float ekle = 0.0;
  for (int i = 0; i < 24; i++){
    if (i >= fircaSayi) break;
    vec2 d = (vUv - firca[i].xy) * alan;
    ekle += exp(-dot(d, d) / (yaricap * yaricap)) * firca[i].z;
  }
  w = w + ekle * (1.0 - w);
  gl_FragColor = vec4(clamp(w, 0.0, 1.0), 0.0, 0.0, 1.0);
}
`;

export const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// ---------------------------------------------------------------------------
// TAŞ
// ---------------------------------------------------------------------------

/** Aşınma alanı düzlemin tamamını değil, ortadaki eşik bölgesini kaplar. */
const ASINMA_UV = /* glsl */ `
uniform vec2 esikMerkez;   // dünya (x, z)
uniform vec2 esikAlan;     // EN, BOY
vec2 asinmaUv(vec2 p){     // p = dünya (x, z)
  return vec2(
    (p.x - esikMerkez.x) / esikAlan.x + 0.5,
    0.5 - (p.y - esikMerkez.y) / esikAlan.y
  );
}
float asinmaOku(sampler2D t, vec2 p){
  vec2 uv = asinmaUv(p);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(t, uv).r;
}
`;

export const TAS_VERT = /* glsl */ `
precision highp float;
uniform sampler2D asinma;
uniform float derinlik;
varying vec3 vDunya;
${ASINMA_UV}
void main(){
  // Düzlem yerelde XY'de; mesh.rotation.x = -PI/2 ile yatıyor.
  // Yerel +Z → dünya +Y, yani çukur için position.z azaltılır.
  vec3 p = position;
  vec2 dw = vec2(position.x, -position.y);          // dünya (x, z)
  float w = asinmaOku(asinma, dw);
  p.z -= w * derinlik;
  vec4 dp = modelMatrix * vec4(p, 1.0);
  vDunya = dp.xyz;
  gl_Position = projectionMatrix * viewMatrix * dp;
}
`;

export const TAS_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D asinma;
uniform sampler2D tas;
uniform vec3 isikYon;      // yüzeyden ışığa, normalize
uniform vec3 isikRenk;
uniform float isikGuc;
uniform vec3 ambRenk;
uniform float derinlik;
uniform float mikroYuk;
uniform float derzDerin;
uniform vec3 mermerRenk;
uniform vec3 damarRenk;
uniform vec3 damarVurgu;
uniform vec3 sisRenk;
uniform float sisYogun;
uniform vec4 gecen[4];     // xy = dünya (x,z), z = boş, w = güç
uniform int gecenSayi;
uniform float kapiX;       // söve iç yarı-açıklığı
uniform float kapiZ;       // söve düzleminin z'si
uniform float isikEgim;    // ışığın yatay eğimi (birim mesafede x kayması)
varying vec3 vDunya;

${GOK_GLSL}
${CIKIS_GLSL}
${ASINMA_UV}

const float PI = 3.14159265;

// --- derz (taş birleşim çizgileri): eşik tek levha değil, apron. -----------
float derzMesafe(vec2 p){
  float d = 1e3;
  d = min(d, abs(abs(p.x) - 10.6));
  d = min(d, abs(abs(p.x) - 31.2));
  d = min(d, abs(p.y - 19.0));
  d = min(d, abs(p.y - 6.8));
  d = min(d, abs(p.y + 6.2));
  d = min(d, abs(p.y + 19.5));
  d = min(d, abs(p.y + 34.0));
  return d;
}
float derzMask(vec2 p){ return smoothstep(0.16, 0.78, derzMesafe(p)); }

// --- taşın dişi: iki ölçek + döndürme, tile tekrarını kırar ----------------
float tasYuk(vec2 p){
  float a = texture2D(tas, p * 0.075).r;
  vec2 r = mat2(0.88, -0.47, 0.47, 0.88) * p;
  float b = texture2D(tas, r * 0.041 + 0.31).r;
  return a * 0.55 + b * 0.45;
}

// --- tek yükseklik fonksiyonu → normal bunun gradyanı ---------------------
float yuk(vec2 p){
  float w = asinmaOku(asinma, p);
  float c = smoothstep(0.05, 0.72, w);
  float t = tasYuk(p);
  float dm = derzMask(p);
  return (t - 0.5) * mikroYuk * (1.0 - c * 0.93)
       - w * derinlik
       - (1.0 - dm) * derzDerin;
}

// --- söve gölgesi: ışık da trafik de AYNI kapıdan geçiyor. -----------------
// Aydınlık kama ile aşınmış havuz aynı sebepten aynı yerde. Tasarımın kalbi bu.
float kapiIsigi(vec2 p){
  float dz = kapiZ - p.y;                    // >0 → kapının ötesi (dışarısı)
  float s = max(-dz, 0.0);                   // kapıdan içeri mesafe
  float xd = p.x + s * isikEgim;
  float pen = 0.9 + s * 0.075;               // yarı gölge mesafeyle açılır
  float g = smoothstep(-pen, pen, kapiX - abs(xd));
  return mix(g, 1.0, smoothstep(0.0, 2.5, dz));
}

// --- geçenler: gövde YOK, sadece gölge. -----------------------------------
// Taş tek tek kimseyi hatırlamaz. Sahne de göstermez: geçip gitmiş olanların
// yalnızca gölgesi ve bıraktığı aşınma kalır.
float gecenGolge(vec2 p){
  float t = 0.0;
  for (int i = 0; i < 4; i++){
    if (i >= gecenSayi) break;
    float dz = gecen[i].y - p.y;
    if (dz <= 0.0) continue;                 // geçenin ötesi etkilenmez
    float s = dz;
    float xd = p.x - (gecen[i].x - s * isikEgim);
    float pen = 0.75 + s * 0.10;
    float k = 1.0 - smoothstep(0.0, pen * 1.9, abs(xd) - 0.34);
    t += clamp(k, 0.0, 1.0) * exp(-s * 0.052) * gecen[i].w;
  }
  return clamp(t, 0.0, 1.0);
}

void main(){
  vec2 p = vec2(vDunya.x, vDunya.z);

  float w = asinmaOku(asinma, p);
  float dm = derzMask(p);
  float cila = smoothstep(0.05, 0.72, w) * dm;   // derz cilalanmaz, korunaklı

  // Normal: yuk()'un dünya gradyanı. Ayrı bir "perde" katmanı yok.
  float e = 0.035;
  float h0 = yuk(p);
  float hx = yuk(p + vec2(e, 0.0));
  float hz = yuk(p + vec2(0.0, e));
  vec3 N = normalize(vec3(-(hx - h0) / e, 1.0, -(hz - h0) / e));

  vec3 V = normalize(cameraPosition - vDunya);
  vec3 L = isikYon;
  vec3 H = normalize(L + V);
  float NoL = max(dot(N, L), 0.0);
  float NoV = max(dot(N, V), 1e-4);
  float NoH = max(dot(N, H), 0.0);
  float VoH = max(dot(V, H), 0.0);

  float ham = texture2D(tas, p * 0.075).r;
  float purz = mix(0.86, 0.055, cila);
  purz = clamp(purz + (ham - 0.5) * 0.16 * (1.0 - cila), 0.035, 1.0);
  purz = mix(0.95, purz, dm);

  float kapiK = kapiIsigi(p);
  float golge = gecenGolge(p);
  float direkt = kapiK * (1.0 - golge);
  float ao = mix(0.42, 1.0, dm);

  // Albedo: soluk mermer + damar. Cila damarı ORTAYA ÇIKARIR (aşınma değil,
  // parlatma). Havuz bu yüzden "boş" değil — dokusuz ama taş.
  vec4 ts = texture2D(tas, p * 0.014);
  vec3 albedo = mermerRenk * (0.88 + 0.12 * ts.g);
  float damar = ts.b;
  albedo = mix(albedo, damarRenk, damar * mix(0.18, 0.62, cila));
  albedo = mix(albedo, damarVurgu, damar * damar * 0.05 * cila);

  // GGX doğrudan spekülar — pürüzlü taşın dişini yalayan ışık çıkarır.
  float a = purz * purz;
  float a2 = a * a;
  float dd = NoH * NoH * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * dd * dd);
  float k = a * 0.5;
  float G = (NoV / (NoV * (1.0 - k) + k)) * (NoL / (NoL * (1.0 - k) + k));
  vec3 F0 = vec3(0.055);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - VoH, 5.0);
  vec3 spec = D * G * F / (4.0 * NoV * NoL + 1e-4) * NoL * isikRenk * isikGuc * direkt;

  // Ortam yansıması — HAVUZ BURADAN geliyor. Alçak kamera → NoV küçük →
  // Fresnel yüksek → cilalı taş kapıyı güçlü aynalar. Bloom yok, perde yok.
  vec3 R = reflect(-V, N);
  vec3 keskin = gokRenk(R);
  vec3 genis = gokRenk(normalize(mix(R, N, 0.78)));
  vec3 env = mix(keskin, genis, smoothstep(0.02, 0.62, purz));
  float fr = F0.r + (1.0 - F0.r) * pow(1.0 - NoV, 5.0);
  // Kapı GÜNEŞİ keser, GÖĞÜ değil: söve gölgesindeki taş hâlâ tüm gök kubbeyi
  // görür ve onu aynalar. Bu yüzden gölge "kapalı" değil, sadece güneşsiz.
  // (Eskiden 0.55/0.5 idi; ön alanı mürekkep okunmaz hale getiren şey oydu.
  // Okunabilirliği perdeyle değil, sahnenin kendi gök ışığıyla çözüyoruz.)
  float envKis = mix(0.88, 1.0, kapiK) * (1.0 - golge * 0.55);
  vec3 envSpec = env * fr * (1.0 - purz * 0.55) * ao * envKis;

  vec3 diff = albedo / PI * NoL * isikRenk * isikGuc * direkt
            + albedo * ambRenk * ao * mix(0.86, 1.0, kapiK);

  vec3 renk = diff + spec + envSpec;

  // Hava perspektifi: uzak kenar sisin içinde biter, gök kubbeyle dikişsiz.
  float mesafe = length(vDunya - cameraPosition);
  float sis = 1.0 - exp(-mesafe * sisYogun);
  vec3 bakis = normalize(vDunya - cameraPosition);
  vec3 sisR = sisRenk + kapiRenk * pow(max(dot(normalize(vec3(bakis.x, 0.0, bakis.z)), kapiYatay), 0.0), 3.0) * kapiGuc * 0.35;
  renk = mix(renk, sisR, sis);

  gl_FragColor = vec4(srgbe(notralTon(renk)), 1.0);
}
`;

export const GOK_VERT = /* glsl */ `
varying vec3 vYon;
void main(){
  vYon = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GOK_FRAG = /* glsl */ `
precision highp float;
varying vec3 vYon;
${GOK_GLSL}
${CIKIS_GLSL}
void main(){
  vec3 c = gokRenk(normalize(vYon));
  gl_FragColor = vec4(srgbe(notralTon(c)), 1.0);
}
`;

/** Söve: koyu siluet + parlak kapıya karşı Fresnel kenar ışığı. */
export const SOVE_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vD;
void main(){
  vN = normalize(normalMatrix * normal);
  vec4 d = modelMatrix * vec4(position, 1.0);
  vD = d.xyz;
  gl_Position = projectionMatrix * viewMatrix * d;
}
`;

export const SOVE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 soveRenk;
uniform vec3 kenarRenk;
uniform vec3 sisRenk;
uniform float sisYogun;
uniform sampler2D tas;
varying vec3 vN; varying vec3 vD;
${GOK_GLSL}
${CIKIS_GLSL}
void main(){
  vec3 V = normalize(cameraPosition - vD);
  vec3 N = normalize(vN);

  // Söve de TAŞ: düz renk kartondur. Yüze göre üçlü projeksiyon ile doku.
  vec2 uv = abs(N.x) > 0.5 ? vD.zy * 0.09 : vD.xy * 0.09;
  float d = texture2D(tas, uv).r;
  // Yüzler birbirinden ayrılsın; yoksa silüet yassı durur.
  float yuz = 0.72 + 0.28 * abs(N.x) + 0.16 * max(N.z, 0.0);

  float kenar = pow(1.0 - abs(dot(N, V)), 2.4);
  float ust = smoothstep(-2.0, 9.0, vD.y);       // yukarısı kapı ışığını yakalar
  // Söve de göğü görür: ön yüzü güneşsiz ama kör değil. Gök ambiyansı olmadan
  // düz siyah karton gibi duruyordu; taş gibi dursun diye kubbeyi örnekliyoruz.
  vec3 gokAmb = gokRenk(normalize(N + vec3(0.0, 0.35, 0.0))) * 0.20;
  vec3 c = soveRenk * yuz * (0.78 + 0.44 * d) + gokAmb + kenarRenk * kenar * (0.35 + 0.65 * ust);
  float mesafe = length(vD - cameraPosition);
  float sis = 1.0 - exp(-mesafe * sisYogun);
  c = mix(c, sisRenk, sis * 0.85);
  gl_FragColor = vec4(srgbe(notralTon(c)), 1.0);
}
`;

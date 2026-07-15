import { RAMPA_US, TAVAN_Y, UZAK, ZEMIN_Y } from "./enfilad";

/**
 * Sıva gölgeleyicisi — duvar / zemin / tavan / kapak aynı malzemeyi paylaşır.
 * Ton tamamen KAMERAYA GÖRE derinlikten gelir: treadmill'de duvarlar geri
 * dönüştüğü için ton duvarın kimliğine değil, o anki uzaklığına bağlı olmalı.
 * Bunun yan etkisi konseptin ta kendisi: kamera sonsuza dek ilerler ama
 * görüntü hep aynı kalır — hiçbir odaya varılmaz.
 */
export const sivaVertex = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
varying float vD;
varying float vSeed;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vD = -mv.z;
  vN = normalize(mat3(modelMatrix) * normal);
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  vSeed = modelMatrix[3].z;
  gl_Position = projectionMatrix * mv;
}
`;

export const sivaFragment = /* glsl */ `
precision highp float;

uniform vec3 uDerin;
uniform vec3 uBeyaz;
uniform vec3 uCyan;
uniform float uAkis;

varying vec3 vW;
varying vec3 vN;
varying float vD;
varying float vSeed;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.07 + 11.3;
    a *= 0.5;
  }
  return s;
}

void main() {
  vec3 N = normalize(vN);
  vec3 an = abs(N);

  // --- derinlik rampası: tek hue ailesi, beyazın onlarca opaklığı --------
  // Üs 2.4 = arkaya yüklü eğri. Yakın odalar neredeyse aynı soluk değerde
  // kalır (metnin arkası), düşüş son üçte birde olur (kaçış noktası).
  float k = pow(clamp(vD / ${UZAK.toFixed(1)}, 0.0, 1.0), ${RAMPA_US.toFixed(1)});
  vec3 col = mix(uDerin, uBeyaz, 1.0 - k);
  // orta bantta çok ince cyan kaldırma — doygun değil, sadece hue'yu diri tutar
  col = mix(col, uCyan, 0.13 * exp(-pow((k - 0.34) / 0.24, 2.0)));

  // --- ışık: fiziksel değil, elle kurgulanmış yüzey değerleri -----------
  // Söveler asıl iş: her eşiğin solu parlak, sağı gölgeli → iç içe yedi
  // dikdörtgen düz bir gradyan değil, kenarları olan mimari olur.
  float lam = 1.0;
  if (an.y > 0.5) {
    lam = N.y > 0.0 ? 0.80 : 0.96; // zemin daha koyu : tavan sıvası parlak
  } else if (an.x > 0.5) {
    lam = N.x > 0.0 ? 1.12 : 0.73; // sol söve ışık alır : sağ söve gölgede
  }
  col *= lam;

  // --- sıva greni: yüzeye göre düzlem seç (tek malzeme, üç yönelim) -----
  vec2 uvp = an.z > 0.5
    ? vW.xy + vec2(vSeed * 0.61, vSeed * 0.23)
    : (an.y > 0.5 ? vec2(vW.x, vW.z - uAkis) : vec2(vW.y * 1.7, vSeed * 0.5));
  float grain = fbm(uvp * 0.7) * 0.55 + fbm(uvp * 6.5) * 0.45;
  col *= 0.945 + 0.11 * grain;

  // --- mimari özgüllük: süpürgelik, kartonpiyer, kapıya toplanan ışık ---
  if (an.z > 0.5) {
    float sup = 1.0 - smoothstep(${ZEMIN_Y.toFixed(2)}, ${(ZEMIN_Y + 0.38).toFixed(2)}, vW.y);
    col *= 1.0 - 0.10 * sup;
    float kart = smoothstep(${(TAVAN_Y - 0.45).toFixed(2)}, ${TAVAN_Y.toFixed(2)}, vW.y);
    col *= 1.0 + 0.05 * kart;
    // Yakın duvar kareyi neredeyse tümüyle kaplar. Rampa arkaya yüklü olduğu
    // için bu yüzey tek başına bırakılırsa DÜPEDÜZ BEYAZ bir alan olur ve sahne
    // "render edilmemiş" görünür. Işık eşikten toplanıp köşelere doğru
    // düşsün: metnin oturduğu alan doğal olarak sakinleşir, kadraj kenarı
    // derinleşir. Bu bir CSS perdesi değil — sahnenin kendi ışığı.
    float rr = length(vec2(vW.x / 10.5, (vW.y + 0.9) / 8.0));
    col *= 1.09 - 0.32 * smoothstep(0.45, 2.35, rr);
  }

  // --- derin uç: kaçış noktası küçük ve koyu bir delik olarak kalsın ----
  col *= 1.0 - 0.45 * smoothstep(0.58, 0.97, k);

  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Toz — venturi: eşiğin dar kesitinden geçerken hızlanır. Hız tamamen
 * vertex'te, parçacığın kendi (x,y)'sinden türer; CPU her kare hiçbir şey yazmaz.
 */
export const tozVertex = /* glsl */ `
uniform float uZaman;
uniform float uAkis;

attribute float aOfs;
attribute float aBoy;

varying float vK;

void main() {
  vec3 p = position;

  // eşiğin kesiti dikdörtgen → metrik de dikdörtgen olmalı
  float rx = abs(p.x) / 8.2;
  float ry = abs(p.y + 0.9) / 6.2;
  float r = max(rx, ry);
  float venturi = mix(2.1, 0.45, smoothstep(0.0, 1.05, r));

  float z = p.z + uAkis * venturi + aOfs * ${(164).toFixed(1)};
  p.z = mod(z + 4096.0, 164.0) - 158.0;
  p.x += sin(uZaman * 0.35 + aOfs * 40.0) * 0.22;
  p.y += cos(uZaman * 0.29 + aOfs * 27.0) * 0.16;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  vK = pow(clamp(d / ${UZAK.toFixed(1)}, 0.0, 1.0), ${RAMPA_US.toFixed(1)});
  // 260/d yakın zerreyi 20-90px'lik parlak bir topağa çeviriyordu: additive
  // harmanla üst üste binince kaçış noktası konfeti kutusuna dönüyordu.
  // Zerre TOZ olmalı, kar değil — üst sınırla birlikte birkaç piksel.
  gl_PointSize = min(aBoy * (58.0 / max(d, 1.0)), 3.2);
  gl_Position = projectionMatrix * mv;
}
`;

export const tozFragment = /* glsl */ `
precision highp float;

uniform vec3 uZerre;

varying float vK;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  float a = smoothstep(0.25, 0.0, d2);
  // Soluk sıvanın önünde additive zerre hiçbir şey yapmaz ve metni kirletir:
  // tozu sadece koridor koyulaşmaya başladığı yerden itibaren aç.
  a *= smoothstep(0.06, 0.34, vK) * (1.0 - 0.5 * smoothstep(0.80, 1.0, vK));
  if (a < 0.01) discard;
  // 0.85 additive = kaçış noktasında yanan bir küme. Toz havada asılı kalsın,
  // parlamasın: delik yine delik kalmalı, glitter olmamalı.
  gl_FragColor = vec4(uZerre, a * 0.26);
}
`;

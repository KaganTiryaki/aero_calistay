"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/*
 * STERİL KATMAN — yukarıdan bakılan bir kazı alanı.
 *
 * Her kare kendi kazı derinliğinde duruyor. Yalayan bir key light (~16°) uzun
 * gölgeler atıyor; gölge shadow map'ten değil, yükseklik alanının kendisinden
 * ışın yürütülerek çıkıyor (tek DataTexture, 14 adım). Kadrenin ortasındaki blok
 * "steril katman"a — insan faaliyetinin altındaki, hiçbir buluntunun olmadığı
 * katmana — kadar açılmış: geniş, düz, açık, dokusuz. UI o çukurun İÇİNDE durur.
 *
 * Okunabilirlik perde/scrim ile değil sahnenin ışık tasarımıyla çözülür:
 * steril bandın ambient'i yüksek, key'i ve gölge alımı düşük → doğal olarak
 * sakin ve açık. Üst katmanlar tersine: düşük ambient, sert key → dolu ve derin.
 *
 * Kapılar: DPR cap · IntersectionObserver · visibilitychange ·
 * prefers-reduced-motion'da rAF hiç başlamaz (tek statik kare) · pointer:coarse'ta
 * antialias kapalı + ışın/AO adımları düşük · cleanup'ta tam dispose.
 */

// ---- Alan ------------------------------------------------------------------
const GX = 22; // sütun (kadraj kenarı görünmesin diye geniş)
const GZ = 26; // satır (dikey ekranda da taşsın diye derin)
const HUCRE = 1.55;
const BOSLUK = 0.1; // kareler arası dikiş — bitişik küp kütlesi olmasın
const GENIS = GX * HUCRE;
const DERIN = GZ * HUCRE;
const MINX = -GENIS / 2;
const MINZ = -DERIN / 2;

/*
 * Katman tavanları (dünya Y). Kalınlıklar kasten eşit değil — stratigrafi öyle.
 * KRİTİK: bu değerler HÜCRE'ye (1.55) göre ALÇAK olmak zorunda. Yüksek bloklar
 * + alçak kamera = gökdelen silüeti; alan "kazı" değil "şehir" gibi okunuyordu.
 * En kalın katman artık hücre genişliğinin altında: yerden yükselen kuleler
 * değil, yere gömülmüş kareler.
 */
const KAT = [0.95, 0.74, 0.54, 0.34, 0.09];
const MAXH = KAT[0];
const TABAN_Y = 0.045; // dikişlerin dibindeki karanlık
const OLCEK = 1.05; // yükseklik → bayt kodlama aralığı (>= MAXH)

/*
 * Üst toprak → yerleşim katmanları → steril. Tek hue ailesi (cyan→nane→koyu
 * teal), hiyerarşi renkten değil VALÖRDEN geliyor. Doygunluk kasten ölçülü:
 * cam gibi parlamasın ama beton grisine de düşmesin — kroma tamamen çekilince
 * marka kayboluyor. En derin bant nane/teal'e yaklaşır (AERO paleti).
 */
const KAT_RENK = ["#D6E6E7", "#AECBD1", "#82B2BB", "#3E8B8A", "#F2FAFB"];

/** Steril bloğun grid aralığı (dahil). Kadrenin ortası. */
const CUK = { x0: 7, x1: 14, z0: 9, z1: 14 };

// Işık: sol-arka, alçak. Gölgeler sağa-öne düşer (ekranda sağ-aşağı) —
// UI'daki CTA gölgesi de aynı yöne düşüyor, o yüzden düğme sahnenin içinde durur.
const ISIK_AZ = (218 * Math.PI) / 180;
const ISIK_YUK = (14 * Math.PI) / 180;

// Kazı kulesi açısı. 57° blokların YAN yüzlerini gösteriyordu → gökdelen.
// 64°'de baskın düzlem üst yüz: kareler ızgarası okunuyor, siluet değil.
const KAMERA_YUKSELIS = (64 * Math.PI) / 180;

/*
 * Lens. Dikey ekranda çukuru kadraja sığdırmak için kamerayı 57 birime kadar
 * geri çekiyordu (masaüstünde 21) — sahne sisin içinde eriyor, grid kenarı
 * görünüyordu. Artık mesafe sabit, dar ekranda LENS açılıyor.
 */
const FOV_DAR = 34; // geniş ekran: uzun lens, belgeleme fotoğrafı hissi
const FOV_GENIS = 50; // dikey ekran tavanı
const HEDEF_MESAFE = 21;

// ---- Deterministik gürültü --------------------------------------------------
function prng(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function karma(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function deger(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = karma(xi, yi);
  const b = karma(xi + 1, yi);
  const c = karma(xi, yi + 1);
  const d = karma(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x: number, y: number) {
  return (
    deger(x, y) * 0.62 +
    deger(x * 2.1 + 5.2, y * 2.1 + 1.3) * 0.26 +
    deger(x * 4.3 + 9.1, y * 4.3 + 7.7) * 0.12
  );
}

const yumusak = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---- Kareler ----------------------------------------------------------------
type Kare = {
  gx: number;
  gz: number;
  gw: number;
  gd: number;
  cx: number; // grid merkezi
  cz: number;
  x: number; // dünya merkezi
  z: number;
  w: number;
  d: number;
  h: number;
  hiz: number;
  steril: boolean;
  dCuk: number; // çukura düzensizleştirilmiş uzaklık (dünya birimi)
};

const icCukur = (gx: number, gz: number) =>
  gx >= CUK.x0 && gx <= CUK.x1 && gz >= CUK.z0 && gz <= CUK.z1;

function kareleriKur(): Kare[] {
  const rnd = prng(0x5e21);
  const dolu = new Uint8Array(GX * GZ);
  const liste: Kare[] = [];

  for (let gz = 0; gz < GZ; gz++) {
    for (let gx = 0; gx < GX; gx++) {
      if (dolu[gz * GX + gx]) continue;
      const benim = icCukur(gx, gz);
      let gw = 1;
      let gd = 1;
      const r = rnd();
      // düzensiz dikdörtgenler — ama çukur sınırını asla aşmadan
      if (
        r < 0.3 &&
        gx + 1 < GX &&
        !dolu[gz * GX + gx + 1] &&
        icCukur(gx + 1, gz) === benim
      ) {
        gw = 2;
      } else if (
        r < 0.52 &&
        gz + 1 < GZ &&
        !dolu[(gz + 1) * GX + gx] &&
        icCukur(gx, gz + 1) === benim
      ) {
        gd = 2;
      }
      for (let j = 0; j < gd; j++) {
        for (let i = 0; i < gw; i++) dolu[(gz + j) * GX + gx + i] = 1;
      }

      const cx = gx + gw / 2;
      const cz = gz + gd / 2;
      // Çukur dikdörtgenine uzaklık, fbm ile tırtıklanmış: kazı cephesi
      // düzgün bir çember değil, düzensiz bir sınır olsun.
      const dx = Math.max(CUK.x0 - cx, 0, cx - (CUK.x1 + 1));
      const dz = Math.max(CUK.z0 - cz, 0, cz - (CUK.z1 + 1));
      let dCuk = Math.hypot(dx, dz) * HUCRE;
      dCuk += (fbm(cx * 0.15 + 11.3, cz * 0.15 + 4.7) - 0.5) * 8;

      liste.push({
        gx,
        gz,
        gw,
        gd,
        cx,
        cz,
        x: MINX + cx * HUCRE,
        z: MINZ + cz * HUCRE,
        w: gw * HUCRE - BOSLUK,
        d: gd * HUCRE - BOSLUK,
        h: KAT[0],
        hiz: 1.1 + rnd() * 1.3,
        steril: benim,
        dCuk,
      });
    }
  }

  // Çukurun iki köşesinde kazılmadan bırakılmış "tanık" karesi: mükemmel
  // dikdörtgen okumasını kırar, gerçek kazıda da böyledir.
  for (const k of liste) {
    if (!k.steril) continue;
    const kose =
      (k.gx <= CUK.x0 && k.gz <= CUK.z0) ||
      (k.gx + k.gw - 1 >= CUK.x1 && k.gz + k.gd - 1 >= CUK.z1);
    if (kose) k.steril = false;
  }
  return liste;
}

/** Steril tabanın dünya dikdörtgeni: tek parça zemin (bkz. tabanKur). */
const CUK_X0 = MINX + CUK.x0 * HUCRE;
const CUK_X1 = MINX + (CUK.x1 + 1) * HUCRE;
const CUK_Z0 = MINZ + CUK.z0 * HUCRE;
const CUK_Z1 = MINZ + (CUK.z1 + 1) * HUCRE;

/** Kazı alanının o anki hedef yüksekliği. Gürültü alanı zamanla kayar → göç. */
function hedefY(k: Kare, t: number) {
  if (k.steril) return KAT[4];
  const n = fbm(k.cx * 0.19 + t * 0.055, k.cz * 0.19 + t * 0.018);
  const yakin = 1 - yumusak(0.6, 11.5, k.dCuk);
  // uzakta ara sıra açılan sondaj cepleri — cephe kapalı bir zarf olmasın
  const cep = fbm(k.cx * 0.085 - t * 0.02, k.cz * 0.085 + 3.1) > 0.63 ? 0.6 : 0;
  const derinlik = Math.pow(n, 1.45) * (0.2 + 0.8 * yakin) * 4.7 + cep;
  let kat = Math.min(3, Math.max(0, Math.floor(derinlik)));
  // çukura komşu kareler duvar görevi görür: en az bir katman yukarıda kalsın
  if (k.dCuk < HUCRE * 1.2) kat = Math.min(kat, 2);
  return KAT[kat];
}

// ---- Shader -----------------------------------------------------------------
// Aynı materyal hem InstancedMesh (kareler) hem düz Mesh (steril zemin) için
// derleniyor. instanceMatrix yalnız USE_INSTANCING altında tanımlı — korumasız
// referans düz Mesh'in programını derlenmez yapar.
const VERT = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
void main() {
  #ifdef USE_INSTANCING
    mat4 im = instanceMatrix;
  #else
    mat4 im = mat4(1.0);
  #endif
  vec4 wp = modelMatrix * im * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * (mat3(im) * normal));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uH;
uniform vec2 uMin;
uniform vec2 uSpan;
uniform vec3 uL;
uniform vec3 uKey;
uniform vec3 uGok;
uniform vec3 uSis;
uniform vec3 uBand[5];
uniform float uBandTop[5];
uniform float uMaxH;
uniform float uOlcek;
uniform float uSisYakin;
uniform float uSisUzak;

varying vec3 vW;
varying vec3 vN;

float ornekH(vec2 p) {
  vec2 uv = (p - uMin) / uSpan;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return -20.0;
  return texture2D(uH, uv).r * uOlcek;
}

float h21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// not: adı kasten "vn" değil — varying vN ile tek harf farkla karışırdı.
float gurultu(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Gölge: shadow map yok — yükseklik alanında ışık yönünde yürü. Yaklaşırken
// sertleşen, uzaklaşırken yumuşayan doğal bir penumbra verir.
float golge(vec3 ro) {
  float res = 1.0;
  float t = 0.20;
  for (int i = 0; i < ADIM; i++) {
    vec3 p = ro + uL * t;
    if (p.y > uMaxH) break;
    float d = p.y - ornekH(p.xz);
    if (d < 0.0) return 0.0;
    // sertlik katsayısı yükseklik aralığıyla ölçekli: alan alçaldı, d küçüldü
    res = min(res, 10.0 * d / t);
    t += 0.34;
  }
  return clamp(res, 0.0, 1.0);
}

// Analitik AO: komşu yüksekliklerinden. Çukur diplerine temas karanlığı verir.
float kapanma(vec3 p, vec3 n) {
  vec2 c = p.xz + n.xz * 0.3;
  float o = 0.0;
  for (int i = 0; i < AOADIM; i++) {
    float a = float(i) * 1.0472 + 0.35;
    float r = mod(float(i), 2.0) < 0.5 ? 0.8 : 1.8;
    float h = ornekH(c + vec2(cos(a), sin(a)) * r);
    // normalleştirici de yükseklik aralığıyla ölçekli (eskiden 1.15 / ~1.93)
    o += clamp((h - p.y) / 0.51, 0.0, 1.0);
  }
  return clamp(1.0 - (o / float(AOADIM)) * 0.8, 0.0, 1.0);
}

void main() {
  vec3 n = normalize(vN);
  float ust = clamp(n.y, 0.0, 1.0);
  float yan = 1.0 - ust;

  // Katman rengi yalnızca dünya Y'sinden gelir: üst yüz ile kesit duvarı
  // aynı tabloyu okur, stratigrafi kendiliğinden tutarlı çıkar.
  vec3 alb = uBand[0];
  float steril = 0.0;
  for (int i = 0; i < 5; i++) {
    if (vW.y <= uBandTop[i] + 0.0006) {
      alb = uBand[i];
      steril = (i == 4) ? 1.0 : 0.0;
    }
  }

  // kesit çizgileri — sadece dikey yüzlerde (üst yüz tam bant tavanında durur)
  float cizgi = 0.0;
  for (int i = 1; i < 5; i++) {
    cizgi = max(cizgi, 1.0 - smoothstep(0.0, 0.009, abs(vW.y - uBandTop[i])));
  }
  cizgi *= yan;

  // Doku: toprakta benek + tane, duvarda mala izi, sterilde HİÇ.
  float benek = gurultu(vW.xz * 1.7) * 0.55 + gurultu(vW.xz * 6.0) * 0.45;
  float tane = h21(floor(vW.xz * 30.0));
  float dk = mix(benek, tane, 0.34) - 0.5;
  // mala izi: duvar alçaldı, çizgi yoğunluğu korunsun diye Y frekansı arttı
  float iz = h21(floor(vec2((vW.x + vW.z) * 2.4, vW.y * 125.0))) - 0.5;
  alb *= 1.0 + dk * (mix(0.30, 0.0, steril) * ust) + iz * 0.13 * yan * (1.0 - steril);
  // sterilde yalnızca çok geniş, çok zayıf bir ton — dijital düzlüğü kırar,
  // doku olarak okunmaz.
  alb *= 1.0 + (gurultu(vW.xz * 0.32) - 0.5) * 0.05 * steril;
  alb *= 1.0 - cizgi * 0.34;

  float ndl = max(dot(n, uL), 0.0);
  float sh = golge(vW + n * 0.035);
  float ao = kapanma(vW, n);

  // Işık tasarımı = okunabilirlik tasarımı. Steril bant yüksek ambient / düşük
  // key alır: geniş, sakin, gölgesiz. Üst katmanlar tersi: dolu ve derin.
  //
  // AMA tamamen düz aydınlatılınca metnin arkasına konmuş BEYAZ BİR KART gibi
  // okuyor — yani tam da yasaklanan perde, geometriden yapılmışı. Bu yüzden
  // steril zemin bir miktar yalayan ışık ve kenarlarında temas karanlığı alır:
  // üstüne konmuş bir yüzey değil, çukurun DİBİ gibi otursun. Metnin sakinliği
  // hâlâ korunuyor (key hâlâ düşük), ama zemin artık kart değil zemin.
  float ambK = mix(0.44, 0.98, steril);
  float keyK = mix(0.92, 0.26, steril);
  float shE  = mix(sh, 1.0, steril * 0.70);
  float aoE  = mix(ao, 1.0, steril * 0.45);
  float gok  = 0.45 + 0.55 * n.y;

  vec3 col = alb * uGok * (ambK * gok * aoE) + alb * uKey * (keyK * ndl * shE);

  float dist = length(vW - cameraPosition);
  col = mix(col, uSis, smoothstep(uSisYakin, uSisUzak, dist) * 0.92);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function KaziSahnesi({ className }: { className?: string }) {
  const kapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)");
    const kaba = window.matchMedia("(pointer: coarse)").matches;
    const statik = azHareket.matches;

    const kareler = kareleriKur();
    // Yükseklik alanı TÜM kareleri okur (gölge/AO), ama steril blok tek parça
    // zemin olarak çizilir: kutu olarak çizilince aradaki dikişler soluk alanı
    // panellere bölüyor ve cam giydirme cephesi gibi okunuyordu. Gerçek kazıda
    // da bir alan sterile kadar açıldığında aradaki şahitler kaldırılır.
    const cizilen = kareler.filter((k) => !k.steril);
    const N = cizilen.length;

    // ---- Yükseklik alanı: gölge + AO bunu okur -----------------------------
    // RGBA8 kasten: float texture uzantısı gerektirmez, her yerde çalışır.
    // 8 bit / 1.05 birim ≈ 4 mm — gölge kenarında görünmez.
    const hVeri = new Uint8Array(GX * GZ * 4);
    const hDoku = new THREE.DataTexture(hVeri, GX, GZ, THREE.RGBAFormat);
    hDoku.minFilter = THREE.NearestFilter;
    hDoku.magFilter = THREE.NearestFilter;
    hDoku.wrapS = THREE.ClampToEdgeWrapping;
    hDoku.wrapT = THREE.ClampToEdgeWrapping;
    hDoku.colorSpace = THREE.NoColorSpace;
    hDoku.needsUpdate = true;

    const hYaz = () => {
      for (const k of kareler) {
        const b = Math.max(0, Math.min(255, Math.round((k.h / OLCEK) * 255)));
        for (let j = 0; j < k.gd; j++) {
          for (let m = 0; m < k.gw; m++) {
            hVeri[((k.gz + j) * GX + (k.gx + m)) * 4] = b;
          }
        }
      }
      hDoku.needsUpdate = true;
    };

    // ---- Sahne -------------------------------------------------------------
    const sahne = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(FOV_DAR, 1, 1, 220);

    // WebGL yoksa/başarısızsa THROW eder. useEffect içinde atılan hata tüm
    // ağacı söker: başlık, CTA, disiplinler — hepsi kaybolur. Sahne süstür,
    // başvuru linki değil; sahne düşerse sayfa CSS zemininde ayakta kalsın.
    let cizer: THREE.WebGLRenderer;
    try {
      cizer = new THREE.WebGLRenderer({
        antialias: !kaba,
        powerPreference: "high-performance",
      });
    } catch {
      hDoku.dispose();
      return;
    }
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, kaba ? 1.5 : 2)); // DPR cap
    cizer.setClearColor(0xe7f1f2, 1);
    cizer.domElement.style.display = "block";
    cizer.domElement.style.width = "100%";
    cizer.domElement.style.height = "100%";
    kap.appendChild(cizer.domElement);

    const L = new THREE.Vector3(
      Math.cos(ISIK_YUK) * Math.cos(ISIK_AZ),
      Math.sin(ISIK_YUK),
      Math.cos(ISIK_YUK) * Math.sin(ISIK_AZ),
    ).normalize();

    const uniforms = {
      uH: { value: hDoku },
      uMin: { value: new THREE.Vector2(MINX, MINZ) },
      uSpan: { value: new THREE.Vector2(GENIS, DERIN) },
      uL: { value: L },
      uKey: { value: new THREE.Color("#FFF6E4") }, // alçak güneş, hafif sıcak
      uGok: { value: new THREE.Color("#CFEAF2") }, // gökten dolgu, soğuk
      uSis: { value: new THREE.Color("#E7F1F2") },
      uBand: { value: KAT_RENK.map((c) => new THREE.Color(c)) },
      uBandTop: { value: KAT.slice() },
      uMaxH: { value: MAXH },
      uOlcek: { value: OLCEK },
      // sis mesafeleri yerlestir()'de kamera mesafesinden türetilir — sabit
      // sayı olduğunda dar ekranda (kamera geride) tüm sahneyi yutuyordu
      uSisYakin: { value: 13 },
      uSisUzak: { value: 41 },
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      defines: { ADIM: kaba ? 8 : 14, AOADIM: kaba ? 4 : 6 },
    });

    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0); // taban y=0 → instance ölçeği doğrudan yükseklik

    const kutle = new THREE.InstancedMesh(geo, mat, N);
    // her karede yeniden yazılıyor (göç) → static değil dynamic
    kutle.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    kutle.frustumCulled = false;
    sahne.add(kutle);

    // dikişlerin dibi: kareler ayrı ayrı dursun, bitişik voksel kütlesi olmasın
    const tabanGeo = new THREE.PlaneGeometry(GENIS, DERIN);
    // Dikişlerin dibi. Çok koyu olduğunda uzak alanda kameradan kaçan uzun
    // dikişler siyah ÇATLAK gibi okunuyordu (glitch izlenimi) — gölgeli bir
    // oluk kadar koyu, kırık kadar değil.
    const tabanMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#3E6E78"),
    });
    const taban = new THREE.Mesh(tabanGeo, tabanMat);
    taban.rotation.x = -Math.PI / 2;
    taban.position.y = TABAN_Y;
    sahne.add(taban);

    // Steril taban: tek parça, dikişsiz. Aynı ShaderMaterial'ı kullanır —
    // rengi/ışığı dünya Y'sinden geldiği için kendiliğinden steril bandı okur.
    // Tanık kareleri bu zeminin İÇİNDEN yükselir (ayrı instance olarak çizilir).
    const sterilGeo = new THREE.BoxGeometry(CUK_X1 - CUK_X0, KAT[4], CUK_Z1 - CUK_Z0);
    sterilGeo.translate(
      (CUK_X0 + CUK_X1) / 2,
      KAT[4] / 2,
      (CUK_Z0 + CUK_Z1) / 2,
    );
    const sterilZemin = new THREE.Mesh(sterilGeo, mat);
    sterilZemin.frustumCulled = false;
    sahne.add(sterilZemin);

    const m4 = new THREE.Matrix4();
    const kon = new THREE.Vector3();
    const dur4 = new THREE.Quaternion();
    const olc = new THREE.Vector3();

    const matrisYaz = () => {
      for (let i = 0; i < N; i++) {
        const k = cizilen[i];
        kon.set(k.x, 0, k.z);
        olc.set(k.w, k.h, k.d);
        m4.compose(kon, dur4, olc);
        kutle.setMatrixAt(i, m4);
      }
      kutle.instanceMatrix.needsUpdate = true;
    };

    // ---- Kamera yerleşimi: sahne UI'ın ARKASINDA, kadre her yerde dolu -----
    // Çukur ekranda garantili sığar (alt sınır), grid ise garantili taşar
    // (üst sınır) — böylece alan sonsuza gidiyor, kesilmiş bir tabak değil.
    const cukGenis = (CUK.x1 - CUK.x0 + 1) * HUCRE;
    let mesafe = HEDEF_MESAFE;
    let sonT = 0; // döngünün son zamanı — yeniden boyutlarken kamerayı kurtarır

    const yerlestir = () => {
      const w = kap.clientWidth;
      const h = kap.clientHeight;
      if (!w || !h) return;
      const en = w / h;

      // Mesafeyi sabit tut, LENSİ aç: çukurun yatay yarısı hedef mesafede
      // kadraja girsin. Dar ekranda kamerayı geri çekmek sahneyi sise gömüyordu.
      const yatayYariTan = (cukGenis * 0.56) / HEDEF_MESAFE;
      const gerekenTanV = yatayYariTan / en;
      const fov = Math.min(
        FOV_GENIS,
        Math.max(FOV_DAR, (Math.atan(gerekenTanV) * 360) / Math.PI),
      );
      const tanF = Math.tan((fov * Math.PI) / 360);

      // Grid kadrajı garantili taşsın: kesilmiş bir tabak görünmesin.
      const ustGenis = (GENIS * 0.94) / (2 * tanF * en);
      const ustDerin = (DERIN * Math.sin(KAMERA_YUKSELIS) * 0.96) / (2 * tanF);
      mesafe = Math.min(HEDEF_MESAFE, ustGenis, ustDerin);

      // Hava perspektifi kameraya bağlı — ekran uzayına değil. Perde değil:
      // uzaktaki toprak doğal olarak açılır, nav bandı bu yüzden okunur,
      // çukurun yakın kenarı tam kontrastta kalır.
      uniforms.uSisYakin.value = mesafe * 0.62;
      uniforms.uSisUzak.value = mesafe * 1.95;

      kamera.fov = fov;
      kamera.aspect = en;
      kamera.updateProjectionMatrix();
      cizer.setSize(w, h, false);

      // HER boyutlandırmada çiz — sadece reduced-motion'da değil. İlk yerleşim
      // düzen öncesi (clientWidth=0) düşerse tek init karesi yanlış boyutta
      // kalıyor, sonra setSize tuvali temizliyor ve rAF durmuşsa (arka plan
      // sekmesi, ekran dışı) sahne BOŞ clear-color olarak kalıyordu.
      kameraYaz(sonT);
      cizer.render(sahne, kamera);
    };

    // ---- Fare parallax: yalnızca ince işaretçide ----------------------------
    const fare = { x: 0, y: 0 };
    const hedef = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedef.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedef.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba) {
      window.addEventListener("pointermove", fareOynat, { passive: true });
    }

    const kameraYaz = (t: number) => {
      // yavaş sürüklenme: kazı kulesinden çekilmiş uzun pozun nefesi
      const sx = Math.sin(t * 0.06) * 1.1 + fare.x * 1.4;
      const sz = Math.cos(t * 0.045) * 0.7 - fare.y * 0.9;
      kamera.position.set(
        sx,
        mesafe * Math.sin(KAMERA_YUKSELIS),
        mesafe * Math.cos(KAMERA_YUKSELIS) + sz,
      );
      kamera.lookAt(0, 0.4, -1.4); // alan alçaldı: bakış hedefi de indi
    };

    // ---- Statik base katman: önce durağan hali kur, sonra döngüyü aç -------
    for (const k of kareler) k.h = hedefY(k, 0);
    hYaz();
    matrisYaz();
    yerlestir();
    kameraYaz(0);
    cizer.render(sahne, kamera);

    // ---- Döngü --------------------------------------------------------------
    let id = 0;
    let gorunur = true;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const ciz = () => {
      const dt = Math.min(saat.getDelta(), 0.05);
      const t = saat.elapsedTime;
      sonT = t;

      // Sirkülasyon: gürültü alanı kayıyor → çukurlar geri doluyor, başka
      // yerde yenisi açılıyor. Kazı alanı zeminin üstünde göç ediyor.
      for (const k of kareler) {
        const hd = hedefY(k, t);
        k.h += (hd - k.h) * (1 - Math.exp(-dt * k.hiz));
      }
      hYaz();
      matrisYaz();

      fare.x += (hedef.x - fare.x) * (1 - Math.exp(-dt * 2.4));
      fare.y += (hedef.y - fare.y) * (1 - Math.exp(-dt * 2.4));
      kameraYaz(t);

      cizer.render(sahne, kamera);
      id = requestAnimationFrame(ciz);
    };

    const basla = () => {
      if (calisiyor || statik) return; // reduced-motion: rAF hiç başlamaz
      calisiyor = true;
      saat.getDelta();
      id = requestAnimationFrame(ciz);
    };
    const durdur = () => {
      calisiyor = false;
      cancelAnimationFrame(id);
    };

    const io = new IntersectionObserver(
      ([g]) => {
        gorunur = g.isIntersecting;
        if (gorunur && !document.hidden) basla();
        else durdur();
      },
      { threshold: 0 },
    );
    io.observe(kap);

    const gorunurluk = () => {
      if (document.hidden) durdur();
      else if (gorunur) basla();
    };
    document.addEventListener("visibilitychange", gorunurluk);

    const ro = new ResizeObserver(yerlestir);
    ro.observe(kap);

    return () => {
      durdur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", fareOynat);
      geo.dispose();
      mat.dispose();
      tabanGeo.dispose();
      tabanMat.dispose();
      sterilGeo.dispose();
      hDoku.dispose();
      kutle.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className={className} aria-hidden="true" />;
}

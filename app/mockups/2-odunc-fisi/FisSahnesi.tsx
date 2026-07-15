"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  CIZGI_ALT_V,
  CIZGI_KALINLIK_V,
  CIZGI_UST_V,
  KART_KAPLAMA,
  KASE_BANT_UST_V,
  KASE_ORAN,
  RENK,
  SATIR_ADIM_V,
  SUTUN_CIZGI_U,
  kaseIzgara,
} from "./fis";

/*
 * ÖDÜNÇ FİŞİ — kitabın arkasındaki tarih kaşesi kartı.
 *
 * "Sirkülasyon" kütüphanede zaten ödünç dolaşımının adıdır. Sahne o fişi
 * canlandırıyor: kaşeler üst satırlardan aşağı doluyor, izleri kalıcı olarak
 * mürekkep FBO'suna işleniyor, kart dolunca temizlenmiyor — üstüne yenisi
 * kayıyor ve yığın kalınlaşıyor. Zaman fiziksel derinliğe dönüşüyor.
 *
 * Harman: mürekkep KASE_BANT'ına hapsedilmiş. Altındaki satırlar saf kâğıt —
 * UI orada yaşıyor. Işık havuzu o bölgeyi bir tık derinleştiriyor (perde değil,
 * ışık tasarımı). Kart tüm kadreyi kapladığı için sol/sağ bölünme yok.
 *
 * Kapılar (CLAUDE.md): DPR cap · IntersectionObserver · visibilitychange ·
 * prefers-reduced-motion'da rAF hiç başlamaz (tek statik kare) · pointer:coarse'ta
 * parçacık düşür + antialias kapat · cleanup'ta tam dispose.
 */

/* -------------------------------------------------------------------------- */
/* GLSL                                                                        */
/* -------------------------------------------------------------------------- */

const ORTAK = /* glsl */ `
float rast(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float gurultu(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = rast(i), b = rast(i + vec2(1.0, 0.0));
  float c = rast(i + vec2(0.0, 1.0)), d = rast(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i = 0; i < 4; i++){ s += a * gurultu(p); p = p * 2.03 + 17.3; a *= 0.5; }
  return s;
}
float kutu(vec2 p, vec2 b, float r){
  vec2 d = abs(p) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}
`;

/** Darbe dalgası: hem vertex (yer değiştirme) hem fragment (normal) kullanır. */
const DALGA = /* glsl */ `
uniform vec4 uDarbe;     // xy = uv, z = darbeden beri geçen sn, w = güç
uniform vec2 uKartBoy;   // dünya birimi en/boy
uniform float uKavis;
uniform float uZaman;

float dalgaZ(vec2 uv){
  float z = (sin(uv.x * 3.4 + uZaman * 0.19) * 0.010
           + cos(uv.y * 2.6 - uZaman * 0.13) * 0.008) * uKavis;
  if(uDarbe.w <= 0.001) return z;
  vec2 d = (uv - uDarbe.xy) * uKartBoy;
  float r = length(d);
  float t = uDarbe.z;
  float halka = sin(r * 12.0 - t * 16.0) * exp(-r * 1.35) * exp(-t * 2.6);
  float cukur = -exp(-r * r * 22.0) * exp(-t * 4.2) * 1.5;
  return z + (halka * 0.55 + cukur) * uDarbe.w * 0.055;
}
`;

const KART_VERTEX = /* glsl */ `
varying vec2 vUv;
${ORTAK}
${DALGA}
void main(){
  vUv = uv;
  vec3 p = position;
  p.z += dalgaZ(uv);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const KART_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMurekkep;
uniform float uVarMurekkep;
uniform vec4  uKase;      // xy = uv, z = yükseklik, w = görünürlük
uniform vec2  uKaseBoy;   // dünya yarı-boyut
uniform float uDerinlik;  // 0 = en üstteki fiş
uniform vec3  uKagitA;
uniform vec3  uKagitB;
uniform vec3  uCizgiRenk;
${ORTAK}
${DALGA}

void main(){
  vec2 uv = vUv;
  float vy = 1.0 - uv.y;

  /* --- kâğıt --------------------------------------------------------------
   * Doku PİKSELDEN İRİ olmamalı: yüksek frekanslı gürültü ekranda aliasing'e
   * düşüp sıvaya dönüşüyor. Geniş mottling + çok ince lif = kâğıt. */
  float lif   = fbm(uv * uKartBoy * 8.0);
  float ince  = gurultu(uv * uKartBoy * 44.0);
  vec3 kagit  = mix(uKagitA, uKagitB, clamp(0.52 + (lif - 0.5) * 0.55 + (ince - 0.5) * 0.22, 0.0, 1.0));
  float leke  = fbm(uv * 2.6 + 4.0);
  kagit = mix(kagit, uKagitA * vec3(1.0, 0.975, 0.9), smoothstep(0.45, 0.95, leke) * (0.16 + uDerinlik * 0.14));

  /* --- cetvel çizgileri: kâğıdın üstüne BASILI, dalgayla birlikte eğilir --- */
  float adim = ${SATIR_ADIM_V.toFixed(6)};
  float q  = (vy - ${CIZGI_UST_V.toFixed(4)}) / adim;
  float dl = abs(q - floor(q + 0.5)) * adim;
  float bant = step(${CIZGI_UST_V.toFixed(4)}, vy) * step(vy, ${CIZGI_ALT_V.toFixed(4)});
  float w = fwidth(vy) * 0.85 + 0.00012;
  float cizgi = (1.0 - smoothstep(0.0, w, dl - ${CIZGI_KALINLIK_V.toFixed(6)})) * bant;
  cizgi *= 0.62 + gurultu(uv * vec2(140.0, 5.0)) * 0.38;   // baskı düzensizliği

  /* dikey sütun ayraçları — fişin kendi baskısı. Nav ve kaşe yerleşimi de
   * aynı sabitten besleniyor (fis.ts · SUTUN_CIZGI_U), üçü hiç ayrışmaz. */
  float dv = min(abs(uv.x - ${SUTUN_CIZGI_U.toFixed(4)}), abs(uv.x - ${(1 - SUTUN_CIZGI_U).toFixed(4)}));
  float dikey = (1.0 - smoothstep(0.0, fwidth(uv.x) * 0.9 + 0.0002, dv - 0.0006))
              * step(0.055, vy) * step(vy, 0.975);
  kagit = mix(kagit, uCizgiRenk, clamp(cizgi * 0.5 + dikey * 0.38, 0.0, 1.0));

  /* --- mürekkep: FBO'daki kalıcı iz (premultiplied "over") --- */
  vec4 m = texture2D(uMurekkep, uv) * uVarMurekkep;
  vec3 col = kagit * (1.0 - m.a) + m.rgb;

  /* --- ışık: kâğıdın kendi yüzeyi. Dalga burada görünür hale gelir. --- */
  float e = 0.0035;
  float z0 = dalgaZ(uv);
  vec3 n = normalize(vec3(
    -(dalgaZ(uv + vec2(e, 0.0)) - z0) / (e * uKartBoy.x),
    -(dalgaZ(uv + vec2(0.0, e)) - z0) / (e * uKartBoy.y),
    1.0));
  /* Kâğıt dişi: normal'i sadece ısırgan kadar bozar. Bu değer büyüdüğünde
   * yüzey kâğıt değil SIVA oluyor — specular her ~9 pikselde parlıyor. */
  vec2 gp = uv * uKartBoy * 16.0;
  float g0 = gurultu(gp);
  n.xy += vec2(gurultu(gp + vec2(1.0, 0.0)) - g0, gurultu(gp + vec2(0.0, 1.0)) - g0) * 0.06;
  n = normalize(n);

  vec3 L = normalize(vec3(-0.42, 0.55, 0.72));
  float dif = clamp(dot(n, L), 0.0, 1.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(clamp(dot(n, H), 0.0, 1.0), 20.0);

  /* Yumuşak sol-üst anahtar havuzu. Alt-orta (metin bölgesi) doğal olarak bir
   * tık daha derin: sakinliği perde değil ışık kuruyor. */
  float havuz = 1.0 - 0.24 * clamp(length((uv - vec2(0.34, 0.76)) * vec2(0.7, 1.0)), 0.0, 1.7);
  col *= (0.80 + 0.30 * dif) * havuz;
  col += spec * 0.05 * vec3(0.86, 0.98, 1.0);

  /* --- inen kaşenin gölgesi: kadrenin her yerinde gezinir --- */
  if(uKase.w > 0.001){
    float h = uKase.z;
    vec2 sp = (uv - uKase.xy - vec2(0.028, -0.028) * h) * uKartBoy;
    float d = kutu(sp, uKaseBoy * (1.0 + h * 0.28), 0.02);
    float bl = 0.012 + h * 0.30;
    float g = 1.0 - smoothstep(-bl, bl, d);
    col *= 1.0 - g * uKase.w * (0.36 / (1.0 + h * 1.9));
  }

  col *= 1.0 - clamp(uDerinlik, 0.0, 6.0) * 0.11;    // yığında derine inen kararır

  /* --- kartın kenarı: hafif yuvarlak, yıprandıkça düzensiz --- */
  float asinma = (fbm(uv * uKartBoy * 6.0) - 0.5) * 0.009 * (0.12 + uDerinlik * 0.4);
  float kenar = kutu((uv - 0.5) * uKartBoy, uKartBoy * 0.5 - 0.014, 0.05) + asinma;
  float alfa = 1.0 - smoothstep(0.0, fwidth(kenar) * 1.3 + 0.0005, kenar);
  if(alfa < 0.01) discard;

  gl_FragColor = vec4(col, alfa);
}
`;

/** Kaşe izi — mürekkep FBO'suna basılan tek kare. Glif yok: okunaksız çubuklar. */
const IZ_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTohum;
uniform vec3  uRenk;
uniform float uGuc;
uniform float uEnBoy;
${ORTAK}

void main(){
  vec2 p = vUv - 0.5;
  p.x *= uEnBoy;                       // kaşe yüksekliği birimine geç
  float aa = fwidth(p.y) * 1.3;

  /* dikdörtgen çerçeve: dışta kalın, içte kılcal */
  float d1 = abs(kutu(p, vec2(uEnBoy * 0.46, 0.44), 0.06)) - 0.030;
  float d2 = abs(kutu(p, vec2(uEnBoy * 0.41, 0.37), 0.04)) - 0.012;
  float sekil = (1.0 - smoothstep(0.0, aa, d1))
              + (1.0 - smoothstep(0.0, aa, d2)) * 0.55;

  /* TARİH: GG·AA·YYYY — 2+3+4 rakamlık üç öbek. Glif yok, sadece ritim;
   * okunaksız ama gözde "bir tarih" olarak okunuyor. */
  float dd = 1e9;
  for(int i = 0; i < 9; i++){
    float fi = float(i);
    float obek = fi < 2.0 ? 0.0 : (fi < 5.0 ? 0.17 : 0.34);
    float bw = 0.055 + rast(vec2(uTohum + fi, 2.1)) * 0.028;
    float x  = -1.36 + fi * 0.30 + obek;
    dd = min(dd, kutu(p - vec2(x, 0.085), vec2(bw, 0.115), 0.018));
  }
  /* öbek ayıraçları: iki nokta */
  dd = min(dd, kutu(p - vec2(-1.36 + 1.5 * 0.30 + 0.085, 0.02), vec2(0.022, 0.022), 0.02));
  dd = min(dd, kutu(p - vec2(-1.36 + 4.5 * 0.30 + 0.255, 0.02), vec2(0.022, 0.022), 0.02));
  sekil += (1.0 - smoothstep(0.0, aa, dd)) * 0.95;

  /* alt satır: kütüphane adı gibi daha ince, daha kısa bir dizi */
  float da = 1e9;
  for(int i = 0; i < 6; i++){
    float fi = float(i);
    float bw = 0.04 + rast(vec2(uTohum + fi, 6.4)) * 0.05;
    float x  = -0.62 + fi * 0.25;
    da = min(da, kutu(p - vec2(x, -0.20), vec2(bw, 0.045), 0.012));
  }
  sekil += (1.0 - smoothstep(0.0, aa, da)) * 0.62;
  sekil = clamp(sekil, 0.0, 1.0);

  /* lastik her yere eşit basmaz: kuru noktalar + kenar kanaması */
  float kuru = smoothstep(0.24, 0.70, fbm(vUv * 26.0 + uTohum * 13.0) * 0.8 + 0.36);
  float kanama = fbm(vUv * 52.0 + uTohum * 5.0) * 0.3;
  float a = clamp(sekil * kuru * uGuc * (0.82 + kanama), 0.0, 1.0);
  if(a < 0.005) discard;

  gl_FragColor = vec4(uRenk * a, a);   // premultiplied
}
`;

const DUZ_VERTEX = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GOLGE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2  uBoy;
uniform float uYum;
uniform float uGuc;
uniform vec3  uRenk;
${ORTAK}
void main(){
  float d = kutu((vUv - 0.5) * uBoy, uBoy * 0.5 - uYum * 1.2, 0.06);
  float a = (1.0 - smoothstep(-uYum, uYum, d)) * uGuc;
  if(a < 0.004) discard;
  gl_FragColor = vec4(uRenk * a, a);
}
`;

const CEP_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uKoyu;
uniform vec3 uAcik;
${ORTAK}
void main(){
  float d = clamp(length((vUv - vec2(0.34, 0.78)) * vec2(0.85, 1.0)) * 1.15, 0.0, 1.0);
  vec3 c = mix(uAcik, uKoyu, d);
  c += (gurultu(vUv * 620.0) - 0.5) * 0.018;
  c *= 0.9 + fbm(vUv * 5.0) * 0.2;
  gl_FragColor = vec4(c, 1.0);
}
`;

/* -------------------------------------------------------------------------- */

/** Ortam haritası — prosedürel, doku dosyası yok.
 *
 * ZORUNLU: metalness'lı MeshStandardMaterial'ın yansıtacak bir şeyi yoksa
 * SİYAH çıkar (metalin difüz yanıtı yoktur). Kaşenin parlak metal plakası
 * envMap'siz "#c3e4e6" verilmesine rağmen koyu bir levha gibi görünüyordu.
 * Dikey gradyan = üstte pencere ışığı, altta masa. */
function ortamDokusu() {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 96;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, 0, 96);
  g.addColorStop(0, "#f2feff"); // tavan / pencere
  g.addColorStop(0.42, "#a9dee6");
  g.addColorStop(0.58, "#2f767c"); // ufuk
  g.addColorStop(1, "#06232b"); // masa
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 96);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowDokusu() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const yumusa = (t: number) => 1 - Math.pow(1 - t, 3);
const hizlan = (t: number) => t * t;
const MAX_FIS = 7;

type Fis = {
  grup: THREE.Group;
  kagit: THREE.Mesh;
  golge: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  golgeMat: THREE.ShaderMaterial;
  sapma: number;
};

export function FisSahnesi({ sinif }: { sinif?: string }) {
  const kapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kaba = window.matchMedia("(pointer: coarse)").matches;

    const en = kap.clientWidth || 1;
    const boy = kap.clientHeight || 1;
    const enBoy = en / boy;

    /* --- sahne & kamera: kart tam karşıda, kilitli. Parallax'ı arka yığın yapar,
     * çünkü kamera kaydırırsam cetvel çizgileri HTML metninden kayar. --- */
    const sahne = new THREE.Scene();
    const KAM_Z = 6;
    const FOV = 32;
    const kamera = new THREE.PerspectiveCamera(FOV, enBoy, 0.1, 40);
    kamera.position.set(0, 0, KAM_Z);

    /* WebGL her zaman var sayılamaz: eski cihaz, kapatılmış sürücü ya da tarayıcı
     * context limitine dayanmış olabilir. Renderer patlarsa useEffect ölür, canvas
     * hiç eklenmez ve koyu teal metin koyu zeminde KALIR — okunmaz. Sahne
     * dekoratif, metin ürün: sessizce CSS kâğıt zeminine düşüyoruz. */
    let cizer: THREE.WebGLRenderer;
    try {
      cizer = new THREE.WebGLRenderer({
        antialias: !kaba,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap
    cizer.setSize(en, boy);
    cizer.setClearColor(new THREE.Color(RENK.cepKoyu), 1);
    kap.appendChild(cizer.domElement);

    const frustumBoy = 2 * Math.tan((FOV * Math.PI) / 360) * KAM_Z;
    const frustumEn = frustumBoy * enBoy;
    const kartEn = frustumEn * KART_KAPLAMA;
    const kartBoy = frustumBoy * KART_KAPLAMA;
    const kartBoyVec = new THREE.Vector2(kartEn, kartBoy);

    const izgara = kaseIzgara(enBoy);
    const kaseBoyY = izgara.yukseklikV * kartBoy;
    const kaseBoyX = Math.min(kaseBoyY * KASE_ORAN, (kartEn / izgara.sutun) * 0.86);
    const kaseYariBoy = new THREE.Vector2(kaseBoyX * 0.5, kaseBoyY * 0.5);

    /* Kaşe MERKEZLERİNİN gezebileceği aralık. Sütun çizgileri arasına sadece
     * merkezi sığdırmak yetmiyor — kaşenin kendi yarı genişliği hesaba
     * katılmazsa sağdaki mühürler marjı aşıp kartın kenarından taşıyor. */
    const kaseYariU = kaseBoyX / kartEn / 2;
    const uMin = SUTUN_CIZGI_U + kaseYariU + 0.012;
    const uMax = 1 - SUTUN_CIZGI_U - kaseYariU - 0.012;

    /* --- mürekkep FBO: kaşe izleri buraya KALICI olarak işleniyor --- */
    const rtEn = kaba ? 1024 : 2048;
    const rtBoy = kaba ? 512 : 1024;
    const rtSecenek: THREE.RenderTargetOptions = {
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    };
    let rtGuncel = new THREE.WebGLRenderTarget(rtEn, rtBoy, rtSecenek);
    let rtOnceki = new THREE.WebGLRenderTarget(rtEn, rtBoy, rtSecenek);
    const temizleRT = (rt: THREE.WebGLRenderTarget) => {
      cizer.setRenderTarget(rt);
      cizer.setClearColor(0x000000, 0);
      cizer.clear(true, false, false);
      cizer.setRenderTarget(null);
      cizer.setClearColor(new THREE.Color(RENK.cepKoyu), 1);
    };
    temizleRT(rtGuncel);
    temizleRT(rtOnceki);

    const bosDoku = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    bosDoku.needsUpdate = true;

    /* --- iz sahnesi: tek quad, ortografik, FBO'ya autoClear'sız çizilir --- */
    const izSahne = new THREE.Scene();
    const izKam = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
    const birimQuad = new THREE.PlaneGeometry(1, 1);
    const izMat = new THREE.ShaderMaterial({
      vertexShader: DUZ_VERTEX,
      fragmentShader: IZ_FRAGMENT,
      uniforms: {
        uTohum: { value: 0 },
        uRenk: { value: new THREE.Color(RENK.murekkepYeni) },
        uGuc: { value: 1 },
        uEnBoy: { value: kaseBoyX / kaseBoyY },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const izMesh = new THREE.Mesh(birimQuad, izMat);
    izMesh.scale.set(kaseBoyX / kartEn, kaseBoyY / kartBoy, 1);
    izSahne.add(izMesh);

    const YENI = new THREE.Color(RENK.murekkepYeni);
    const ESKI = new THREE.Color(RENK.murekkepEski);
    const izRenk = new THREE.Color();

    /** slot -> kart üzerindeki yer (uv).
     *
     * Izgara sadece bir NİYET: kimse cetvelle kaşe basmaz. Sapmalar kaşelerin
     * birbirine değeceği, hatta bineceği kadar büyük — "üst üste basılmış"
     * ancak böyle okunuyor. Düzgün ızgara = infografik = ölü. */
    const slotYeri = (slot: number) => {
      const r = Math.floor(slot / izgara.sutun);
      const c = slot % izgara.sutun;
      const rnd = (k: number) => {
        const s = Math.sin((slot + 1) * 12.9898 + k * 78.233) * 43758.5453;
        return s - Math.floor(s);
      };
      // Kaşeler fişin basılı marjlarının İÇİNDE kalır; kimse kenardan taşırmaz.
      const yayilim = izgara.sutun > 1 ? (uMax - uMin) / (izgara.sutun - 1) : 0;
      const u = THREE.MathUtils.clamp(
        uMin + c * yayilim + (rnd(1) - 0.5) * yayilim * 0.5,
        uMin,
        uMax,
      );
      const vTop = KASE_BANT_UST_V + (r + 0.55) * izgara.adim + (rnd(2) - 0.5) * izgara.adim * 0.62;
      return {
        u,
        v: 1 - vTop,
        egim: (rnd(3) - 0.5) * 0.28, // ±8°
        tohum: rnd(4) * 40,
        // Bazen mühür kaymış ya da iki kez basılmış: kartın en inandırıcı detayı.
        cift: rnd(5) > 0.72,
        ciftKay: [(rnd(6) - 0.5) * 0.05, (rnd(7) - 0.5) * 0.012],
      };
    };

    /** İzi FBO'ya bas. Bir daha silinmez — kartın hafızası budur. */
    const izBas = (rt: THREE.WebGLRenderTarget, slot: number) => {
      const y = slotYeri(slot);
      const yas = izgara.kapasite > 1 ? slot / (izgara.kapasite - 1) : 1;
      izRenk.copy(ESKI).lerp(YENI, Math.pow(yas, 0.8));
      (izMat.uniforms.uRenk.value as THREE.Color).copy(izRenk);
      izMat.uniforms.uTohum.value = y.tohum;

      cizer.setRenderTarget(rt);
      cizer.autoClear = false;
      // Kayık ilk vuruş önce: üstüne asıl baskı gelsin.
      if (y.cift) {
        izMesh.position.set(y.u + y.ciftKay[0], y.v + y.ciftKay[1], 0);
        izMesh.rotation.z = y.egim + 0.05;
        izMat.uniforms.uGuc.value = (0.5 + yas * 0.48) * 0.42;
        cizer.render(izSahne, izKam);
      }
      izMesh.position.set(y.u, y.v, 0);
      izMesh.rotation.z = y.egim;
      izMat.uniforms.uGuc.value = 0.5 + yas * 0.48;
      cizer.render(izSahne, izKam);
      cizer.autoClear = true;
      cizer.setRenderTarget(null);
    };

    /* --- cep (arka fon) --- */
    const cepMat = new THREE.ShaderMaterial({
      vertexShader: DUZ_VERTEX,
      fragmentShader: CEP_FRAGMENT,
      uniforms: {
        uKoyu: { value: new THREE.Color(RENK.cepKoyu) },
        uAcik: { value: new THREE.Color(RENK.cepAcik) },
      },
      depthWrite: false,
    });
    const cep = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cepMat);
    cep.position.z = -1.6;
    cep.scale.set(frustumEn * 1.9, frustumBoy * 1.9, 1);
    sahne.add(cep);

    /* --- fiş yığını --- */
    const geoYuksek = new THREE.PlaneGeometry(kartEn, kartBoy, kaba ? 56 : 108, kaba ? 40 : 76);
    const geoDusuk = new THREE.PlaneGeometry(kartEn, kartBoy, 2, 2);
    const golgeGeo = new THREE.PlaneGeometry(1, 1);

    const kartMatBase = new THREE.ShaderMaterial({
      vertexShader: KART_VERTEX,
      fragmentShader: KART_FRAGMENT,
      uniforms: {
        uDarbe: { value: new THREE.Vector4(0.5, 0.5, 9, 0) },
        uKartBoy: { value: kartBoyVec.clone() },
        uKavis: { value: 1 },
        uZaman: { value: 0 },
        uMurekkep: { value: bosDoku },
        uVarMurekkep: { value: 0 },
        uKase: { value: new THREE.Vector4(0.5, 0.5, 1, 0) },
        uKaseBoy: { value: kaseYariBoy.clone() },
        uDerinlik: { value: 0 },
        uKagitA: { value: new THREE.Color(RENK.kagitKoyu) },
        uKagitB: { value: new THREE.Color(RENK.kagitAcik) },
        uCizgiRenk: { value: new THREE.Color(RENK.cizgi) },
      },
      transparent: true,
    });
    const golgeMatBase = new THREE.ShaderMaterial({
      vertexShader: DUZ_VERTEX,
      fragmentShader: GOLGE_FRAGMENT,
      uniforms: {
        uBoy: { value: new THREE.Vector2(kartEn * 1.16, kartBoy * 1.16) },
        uYum: { value: 0.09 },
        uGuc: { value: 0.5 },
        uRenk: { value: new THREE.Color(RENK.golge) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });

    const yiginGrup = new THREE.Group();
    sahne.add(yiginGrup);
    const fisler: Fis[] = [];

    const fisYap = (sapma: number): Fis => {
      const grup = new THREE.Group();
      const mat = kartMatBase.clone();
      const golgeMat = golgeMatBase.clone();
      const kagit = new THREE.Mesh(geoDusuk, mat);
      const golge = new THREE.Mesh(golgeGeo, golgeMat);
      golge.scale.set(kartEn * 1.16, kartBoy * 1.16, 1);
      golge.position.z = -0.045;
      grup.add(golge, kagit);
      yiginGrup.add(grup);
      return { grup, kagit, golge, mat, golgeMat, sapma };
    };

    /** Yığını yeniden dizer: 0 = üstteki (canlı) fiş, altındakiler kayık ve kararık. */
    const yiginiDiz = () => {
      fisler.forEach((f, i) => {
        f.grup.position.set(i * kartEn * 0.006, -i * kartBoy * 0.009, -i * 0.05);
        f.grup.rotation.z = f.sapma * (0.15 + i * 0.3);
        f.kagit.geometry = i === 0 ? geoYuksek : geoDusuk;
        f.mat.uniforms.uDerinlik.value = i;
        f.mat.uniforms.uKavis.value = i === 0 ? 1 : 0.4;
        f.mat.uniforms.uMurekkep.value = i === 0 ? rtGuncel.texture : i === 1 ? rtOnceki.texture : bosDoku;
        f.mat.uniforms.uVarMurekkep.value = i <= 1 ? 1 : 0;
        f.golgeMat.uniforms.uGuc.value = i === 0 ? 0.5 : 0.34;
        f.golgeMat.uniforms.uYum.value = i === 0 ? 0.09 : 0.06;
        // Alttaki fişlerde canlı kaşenin gölgesi/darbesi donmuş kalmasın.
        if (i > 0) {
          (f.mat.uniforms.uKase.value as THREE.Vector4).w = 0;
          (f.mat.uniforms.uDarbe.value as THREE.Vector4).w = 0;
        }
      });
    };

    // Kitap yıllardır dolaşımda: açılışta altta zaten bir yığın var.
    for (let i = 0; i < 4; i++) fisler.push(fisYap((Math.random() - 0.5) * 0.012));
    yiginiDiz();

    /* --- kaşe: sahnedeki tek gerçek 3B nesne ------------------------------
     * Siluet her şey. Kalın bir kütük + top = ocak tepsisi; bu yüzden form
     * kademeli daralıyor: geniş lastik yüz → parlak metal plaka → daralan
     * gövde → ince boyun → topuz. Yandan bakınca "kaşe" diye okunuyor. */
    const kaseGrup = new THREE.Group();
    const H = 1 / KASE_ORAN;
    const yuzGeo = new THREE.BoxGeometry(1, H, 0.05);
    const plakaGeo = new THREE.BoxGeometry(1.04, H * 1.16, 0.04);
    const tabanGeo = new THREE.BoxGeometry(0.72, H * 0.88, 0.1);
    const govdeGeo = new THREE.BoxGeometry(0.42, H * 0.72, 0.16);
    const boyunGeo = new THREE.CylinderGeometry(0.05, 0.075, 0.16, 18);
    const sapGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.16, 18);
    const topuzGeo = new THREE.SphereGeometry(0.085, 20, 14);
    const lastikMat = new THREE.MeshStandardMaterial({ color: "#123f3c", roughness: 0.9, metalness: 0 });
    const metalMat = new THREE.MeshStandardMaterial({
      color: "#dff2f4",
      roughness: 0.26,
      metalness: 0.85,
      envMapIntensity: 1.15,
    });
    const ahsapMat = new THREE.MeshStandardMaterial({ color: "#1d7369", roughness: 0.45, metalness: 0.08 });
    const yuz = new THREE.Mesh(yuzGeo, lastikMat);
    yuz.position.z = 0.025;
    const plaka = new THREE.Mesh(plakaGeo, metalMat);
    plaka.position.z = 0.07;
    const taban = new THREE.Mesh(tabanGeo, ahsapMat);
    taban.position.z = 0.14;
    const govde = new THREE.Mesh(govdeGeo, ahsapMat);
    govde.position.z = 0.28;
    const boyun = new THREE.Mesh(boyunGeo, metalMat);
    boyun.rotation.x = Math.PI / 2;
    boyun.position.z = 0.44;
    const sap = new THREE.Mesh(sapGeo, ahsapMat);
    sap.rotation.x = Math.PI / 2;
    sap.position.z = 0.58;
    const topuz = new THREE.Mesh(topuzGeo, ahsapMat);
    topuz.position.z = 0.7;
    kaseGrup.add(yuz, plaka, taban, govde, boyun, sap, topuz);
    kaseGrup.scale.setScalar(kaseBoyX);
    sahne.add(kaseGrup);

    /* Metal plaka envMap olmadan siyah çıkıyordu; ortam prosedürel üretiliyor.
     * PMREM'i üretip hemen bırakıyoruz, sadece süzülmüş doku sahnede kalıyor. */
    const pmrem = new THREE.PMREMGenerator(cizer);
    const ortamHam = ortamDokusu();
    let ortam: THREE.Texture | null = null;
    if (ortamHam) {
      ortam = pmrem.fromEquirectangular(ortamHam).texture;
      sahne.environment = ortam;
      ortamHam.dispose();
    }
    pmrem.dispose();

    sahne.add(new THREE.AmbientLight(0x9fe0e8, 0.75));
    const anahtar = new THREE.DirectionalLight(0xffffff, 2.4);
    anahtar.position.set(-3, 3.4, 5);
    sahne.add(anahtar);

    /* --- toz: kartın önünde/arkasında yüzen hava --- */
    const doku = glowDokusu();
    const tozN = kaba ? 90 : 260;
    const tozGeo = new THREE.BufferGeometry();
    const tozPoz = new Float32Array(tozN * 3);
    for (let i = 0; i < tozN; i++) {
      tozPoz[i * 3] = (Math.random() - 0.5) * frustumEn * 1.5;
      tozPoz[i * 3 + 1] = (Math.random() - 0.5) * frustumBoy * 1.5;
      tozPoz[i * 3 + 2] = -1.2 + Math.random() * 4;
    }
    tozGeo.setAttribute("position", new THREE.BufferAttribute(tozPoz, 3));
    const tozMat = new THREE.PointsMaterial({
      size: 0.035,
      map: doku ?? undefined,
      color: new THREE.Color(RENK.toz),
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const toz = new THREE.Points(tozGeo, tozMat);
    sahne.add(toz);

    /* --- darbe püskürtüsü: kâğıt lifi + toz, her basışta yeniden doğar --- */
    const pufN = kaba ? 40 : 110;
    const pufGeo = new THREE.BufferGeometry();
    const pufPoz = new Float32Array(pufN * 3);
    const pufHiz = new Float32Array(pufN * 3);
    pufGeo.setAttribute("position", new THREE.BufferAttribute(pufPoz, 3));
    const pufMat = new THREE.PointsMaterial({
      size: 0.05,
      map: doku ?? undefined,
      color: new THREE.Color("#dff6f4"),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const puf = new THREE.Points(pufGeo, pufMat);
    puf.frustumCulled = false;
    sahne.add(puf);
    let pufYas = 9;

    const pufAt = (x: number, y: number) => {
      for (let i = 0; i < pufN; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.25;
        pufPoz[i * 3] = x + Math.cos(a) * r * KASE_ORAN * 0.4;
        pufPoz[i * 3 + 1] = y + Math.sin(a) * r;
        pufPoz[i * 3 + 2] = 0.02 + Math.random() * 0.05;
        const hz = 0.5 + Math.random() * 1.6;
        pufHiz[i * 3] = Math.cos(a) * hz * 0.9;
        pufHiz[i * 3 + 1] = Math.sin(a) * hz * 0.42 + 0.25;
        pufHiz[i * 3 + 2] = 0.4 + Math.random() * 1.1;
      }
      pufGeo.attributes.position.needsUpdate = true;
      pufYas = 0;
    };

    /* --- durum makinesi --------------------------------------------------- */
    const uvDunya = (u: number, v: number) =>
      new THREE.Vector3((u - 0.5) * kartEn, (v - 0.5) * kartBoy, 0);

    // Açılışta kart neredeyse dolu: ziyaretçi ilk karede "bu kitap yüzlerce el
    // görmüş" diyor, ve mürekkep boş satıra bir sıra kalmış halde bekliyor.
    let slot = Math.max(0, izgara.kapasite - 5);
    for (let i = 0; i < slot; i++) izBas(rtGuncel, i);
    fisler[0].mat.uniforms.uVarMurekkep.value = 1;

    type Faz = "bekle" | "sur" | "in" | "bas" | "kalk" | "yeniFis";
    let faz: Faz = "bekle";
    let fazT = 0;
    let bosluk = 0.8;
    let ritim = 0;
    const RITIM = [0.06, 0.06, 0.85]; // iki hızlı, bir duraklama: çalışan bir el
    let taraf = 1;

    const hedef = { u: 0.5, v: 0.5, egim: 0 };
    const P0 = new THREE.Vector3();
    const P1 = new THREE.Vector3();
    const P2 = new THREE.Vector3();
    // Perspektif büyütüyor: z=2.6'da kaşe kadrenin dışına taşıyordu. Yörüngeyi
    // alçalt, kaşe kartın üstünde kalsın.
    const Z_UST = 1.0;
    const Z_TEMAS = 0.045;

    const yeniHedef = () => {
      const y = slotYeri(slot);
      hedef.u = y.u;
      hedef.v = y.v;
      hedef.egim = y.egim;
      P2.copy(uvDunya(y.u, y.v)).setZ(Z_UST);
      P0.set(taraf * kartEn * 0.3, -kartBoy * 0.08, 1.75);
      // Kontrol noktası boş bölgeye dalıyor: kaşe her turda o satıra sarkıyor,
      // gölgesi metnin yanından geçiyor — ama asla oraya basmıyor.
      P1.set(taraf * kartEn * 0.26, -kartBoy * 0.33, 0.55);
      taraf *= -1;
    };
    yeniHedef();

    const darbe = new THREE.Vector4(0.5, 0.5, 9, 0);
    const kamSars = new THREE.Vector2();

    /**
     * yatir: kaşeyi kameraya doğru eğer. Dik inen kaşenin yüzü hep karta bakar,
     * yani biz sadece SIRTINI görürüz — ekranda topuzlu bir çubuk. Süzülürken
     * yatırıp yüzünü (tarihi) gösteriyoruz, inerken dikleşiyor.
     */
    const kaseYerlestir = (p: THREE.Vector3, egim: number, yatir = 0) => {
      kaseGrup.position.copy(p);
      kaseGrup.rotation.set(-yatir, yatir * 0.35, egim);
      const ust = fisler[0];
      const kU = ust.mat.uniforms.uKase.value as THREE.Vector4;
      kU.set(p.x / kartEn + 0.5, p.y / kartBoy + 0.5, THREE.MathUtils.clamp(p.z, 0, 3), 1);
    };

    const bezier = (t: number, out: THREE.Vector3) => {
      const it = 1 - t;
      out.set(0, 0, 0)
        .addScaledVector(P0, it * it)
        .addScaledVector(P1, 2 * it * t)
        .addScaledVector(P2, t * t);
      return out;
    };

    const yeniFisGetir = () => {
      const eski = rtOnceki;
      rtOnceki = rtGuncel;
      rtGuncel = eski;
      temizleRT(rtGuncel);
      slot = 0;
      darbe.set(0.5, 0.5, 9, 0);
      const f = fisYap((Math.random() - 0.5) * 0.014);
      fisler.unshift(f);
      if (fisler.length > MAX_FIS) {
        const at = fisler.pop();
        if (at) {
          yiginGrup.remove(at.grup);
          at.mat.dispose();
          at.golgeMat.dispose();
        }
      }
      yiginiDiz();
      // Yeni fiş kadrenin üstünden kayarak geliyor; gölgesi eskisinin üstünü siliyor.
      f.grup.position.y = kartBoy * 1.25;
      f.grup.position.z = 0.9;
    };

    const gecici = new THREE.Vector3();

    const adimla = (dt: number) => {
      fazT += dt;
      const ust = fisler[0];

      switch (faz) {
        case "bekle":
          (ust.mat.uniforms.uKase.value as THREE.Vector4).w = 0;
          kaseGrup.visible = false;
          if (fazT >= bosluk) {
            faz = "sur";
            fazT = 0;
            kaseGrup.visible = true;
          }
          break;
        case "sur": {
          const t = Math.min(fazT / 0.5, 1);
          bezier(yumusa(t), gecici);
          /* Kamera kilitli ve tam karşıda: kaşe dik durursa sadece YÜZÜNÜ
           * görürüz — top saplanmış bir dikdörtgen, siluet yok. Süzülürken
           * belirgin yatık duruyor ki gövde/boyun/topuz okunsun. */
          kaseYerlestir(gecici, hedef.egim * t, 0.85 * (1 - t) + 0.3);
          kaseGrup.scale.setScalar(kaseBoyX);
          if (t >= 1) {
            faz = "in";
            fazT = 0;
          }
          break;
        }
        case "in": {
          const t = Math.min(fazT / 0.12, 1);
          gecici.copy(P2).setZ(THREE.MathUtils.lerp(Z_UST, Z_TEMAS, hizlan(t)));
          // Temas anında dümdüz: yatık kaşe mürekkebi eşit basmaz.
          kaseYerlestir(gecici, hedef.egim, 0.3 * (1 - t));
          if (t >= 1) {
            // TEMAS: iz kalıcı olarak yanıyor, kâğıt çukurlaşıyor, toz kalkıyor.
            izBas(rtGuncel, slot);
            darbe.set(hedef.u, hedef.v, 0, 1);
            pufAt(P2.x, P2.y);
            kamSars.set((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02);
            faz = "bas";
            fazT = 0;
          }
          break;
        }
        case "bas": {
          const t = Math.min(fazT / 0.07, 1);
          gecici.copy(P2).setZ(Z_TEMAS);
          kaseYerlestir(gecici, hedef.egim);
          kaseGrup.scale.set(kaseBoyX * (1 + 0.05 * (1 - t)), kaseBoyX * (1 - 0.1 * (1 - t)), kaseBoyX);
          if (t >= 1) {
            faz = "kalk";
            fazT = 0;
          }
          break;
        }
        case "kalk": {
          const t = Math.min(fazT / 0.26, 1);
          gecici.copy(P2).setZ(THREE.MathUtils.lerp(Z_TEMAS, 1.7, yumusa(t)));
          gecici.x += Math.sin(t * 7) * 0.03 * (1 - t);
          kaseYerlestir(gecici, hedef.egim * (1 - t * 0.4), 0.55 * t);
          kaseGrup.scale.setScalar(kaseBoyX);
          if (t >= 1) {
            slot += 1;
            bosluk = RITIM[ritim % RITIM.length];
            ritim += 1;
            if (slot >= izgara.kapasite) {
              // Dolum asimptot: satırlar boş bölgeye ulaşamadan yeni fiş geliyor.
              yeniFisGetir();
              faz = "yeniFis";
              fazT = 0;
            } else {
              yeniHedef();
              faz = "bekle";
              fazT = 0;
            }
          }
          break;
        }
        case "yeniFis": {
          const t = Math.min(fazT / 0.95, 1);
          const e = yumusa(t);
          const f = fisler[0];
          f.grup.position.y = THREE.MathUtils.lerp(kartBoy * 1.25, 0, e);
          f.grup.position.z = THREE.MathUtils.lerp(0.9, 0, e);
          f.golgeMat.uniforms.uYum.value = THREE.MathUtils.lerp(0.34, 0.09, e);
          f.golgeMat.uniforms.uGuc.value = THREE.MathUtils.lerp(0.72, 0.5, e);
          kaseGrup.visible = false;
          if (t >= 1) {
            yeniHedef();
            faz = "bekle";
            fazT = 0;
            bosluk = 0.7;
          }
          break;
        }
      }
    };

    /* --- fare: sadece arka yığın + toz oynar, üstteki kart KİLİTLİ --- */
    const fare = new THREE.Vector2();
    const fareHedef = new THREE.Vector2();
    const fareOynat = (e: PointerEvent) => {
      fareHedef.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    };
    if (!azHareket && !kaba) window.addEventListener("pointermove", fareOynat, { passive: true });

    /* --- döngü + kapılar -------------------------------------------------- */
    let id = 0;
    let gorunur = true;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const ciz = () => {
      const dt = Math.min(saat.getDelta(), 0.05);
      const t = saat.elapsedTime;

      adimla(dt);

      darbe.z += dt;
      if (darbe.z > 2.4) darbe.w = 0;
      fisler[0].mat.uniforms.uDarbe.value.copy(darbe);
      fisler[0].mat.uniforms.uZaman.value = t;

      if (pufYas < 1.1) {
        pufYas += dt;
        for (let i = 0; i < pufN; i++) {
          pufPoz[i * 3] += pufHiz[i * 3] * dt;
          pufPoz[i * 3 + 1] += pufHiz[i * 3 + 1] * dt;
          pufPoz[i * 3 + 2] += pufHiz[i * 3 + 2] * dt;
          pufHiz[i * 3] *= 0.94;
          pufHiz[i * 3 + 1] = pufHiz[i * 3 + 1] * 0.94 - dt * 0.5;
          pufHiz[i * 3 + 2] *= 0.93;
        }
        pufGeo.attributes.position.needsUpdate = true;
        pufMat.opacity = Math.max(0, 0.75 * (1 - pufYas / 1.1));
      } else if (pufMat.opacity !== 0) {
        pufMat.opacity = 0;
      }

      for (let i = 0; i < tozN; i++) {
        tozPoz[i * 3 + 1] += (0.012 + (i % 5) * 0.004) * dt;
        tozPoz[i * 3] += Math.sin(t * 0.3 + i) * 0.004 * dt * 60;
        if (tozPoz[i * 3 + 1] > frustumBoy * 0.78) tozPoz[i * 3 + 1] = -frustumBoy * 0.78;
      }
      tozGeo.attributes.position.needsUpdate = true;

      fare.lerp(fareHedef, 0.05);
      // Üstteki fiş sabit kalsın diye grubu değil, ALTTAKİLERİ kaydırıyoruz.
      for (let i = 1; i < fisler.length; i++) {
        fisler[i].grup.position.x = i * kartEn * 0.009 + fare.x * i * 0.05;
        fisler[i].grup.position.y = -i * kartBoy * 0.011 - fare.y * i * 0.04;
      }
      toz.position.set(-fare.x * 0.5, fare.y * 0.4, 0);
      cep.position.set(-fare.x * 0.9, fare.y * 0.7, -1.6);

      kamSars.multiplyScalar(0.82);
      kamera.position.set(kamSars.x, kamSars.y, KAM_Z);

      cizer.render(sahne, kamera);
      id = requestAnimationFrame(ciz);
    };

    const basla = () => {
      if (calisiyor || azHareket) return;
      calisiyor = true;
      saat.getDelta();
      id = requestAnimationFrame(ciz);
    };
    const dur = () => {
      calisiyor = false;
      cancelAnimationFrame(id);
    };

    /* reduced-motion BASE katman: rAF hiç başlamaz, tek kare. Kaşe iniyor gibi
     * donuk duruyor — sahne hâlâ anlatıyor, sadece hareket etmiyor. */
    if (azHareket) {
      gecici.copy(P2).setZ(0.5);
      // Bu tek kare bu kullanıcıların gördüğü TEK kare: kaşe dik değil yatık
      // dursun ki "kaşe" diye okunsun, inmek üzereymiş gibi.
      kaseYerlestir(gecici, hedef.egim, 0.45);
      kaseGrup.visible = true;
      fisler[0].mat.uniforms.uZaman.value = 0;
      cizer.render(sahne, kamera);
    }

    const io = new IntersectionObserver(
      ([g]) => {
        gorunur = g.isIntersecting;
        if (gorunur && !document.hidden) basla();
        else dur();
      },
      { threshold: 0 },
    );
    io.observe(kap);

    const gorunurluk = () => {
      if (document.hidden) dur();
      else if (gorunur) basla();
    };
    document.addEventListener("visibilitychange", gorunurluk);

    const boyutla = () => {
      if (!kap.clientWidth || !kap.clientHeight) return;
      kamera.aspect = kap.clientWidth / kap.clientHeight;
      kamera.updateProjectionMatrix();
      cizer.setSize(kap.clientWidth, kap.clientHeight);
      if (azHareket) cizer.render(sahne, kamera);
    };
    const ro = new ResizeObserver(boyutla);
    ro.observe(kap);

    return () => {
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", fareOynat);
      fisler.forEach((f) => {
        f.mat.dispose();
        f.golgeMat.dispose();
      });
      [geoYuksek, geoDusuk, golgeGeo, birimQuad, tozGeo, pufGeo, cep.geometry].forEach((g) => g.dispose());
      [yuzGeo, plakaGeo, tabanGeo, govdeGeo, boyunGeo, sapGeo, topuzGeo].forEach((g) => g.dispose());
      [lastikMat, metalMat, ahsapMat, tozMat, pufMat, cepMat, izMat, kartMatBase, golgeMatBase].forEach((m) =>
        m.dispose(),
      );
      doku?.dispose();
      ortam?.dispose();
      sahne.environment = null;
      bosDoku.dispose();
      rtGuncel.dispose();
      rtOnceki.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

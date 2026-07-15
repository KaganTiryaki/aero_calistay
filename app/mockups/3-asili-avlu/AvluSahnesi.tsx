"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/*
 * ASILI AVLU — gündüz ışığındaki bir avlu, duvarlar arasına gerilmiş iplerde
 * kâğıt yapraklar. Rüzgâr avluyu TEK YÖNLÜ bir cephe hâlinde geçiyor:
 * kâğıtlar hep birlikte değil, SIRAYLA kıpırdıyor. Sirkülasyon kâğıtların
 * değil, aralarından geçen şeyin hareketi.
 *
 * Harman: ipler baş hizasının üstünde başlar; avlunun göz hizasındaki orta
 * hacmi bilerek boştur. Bu bir kural değil, HESAP: her ipin en alçak kâğıdının
 * ekran yüksekliği (NDC) kamerayla projekte edilip eşiğin altına düşmesi
 * engelleniyor (bkz. yIcin). Metnin arkasında düz soluk sıva kalır — perde yok.
 *
 * Zorunlu kapılar (CLAUDE.md): DPR cap · IntersectionObserver · visibilitychange
 * · prefers-reduced-motion'da rAF hiç başlamaz (tek statik kare) · pointer:coarse'da
 * yaprak sayısı düşer + antialias kapanır · cleanup'ta tam dispose.
 */

/* ── Avlu ölçüleri (metre gibi düşün) ─────────────────────────────────── */
const DUVAR_X = 7.2; // yan duvarlar ±X (geniş kadraj)
/* Dikey kadrajda yatay görüş açısı ~22°'ye düşüyor: arka duvar derinliğinde
   kadrajın yarı genişliği 4.1 birim kalıyor, yan duvarlar ise ±7.2'de — yani
   MOBİLDE DUVARLAR KADRAJIN DIŞINDA. Geriye gök + düz bir levha + kâğıt
   kırpıntıları kalıyordu: avlu değil, doygun cyan bir duvar kâğıdı (reddedilen
   görüntünün ta kendisi). Telefonda avlu bir ARALIĞA daralır; duvarlar geri
   girer, köşeler okunur, oda geri gelir. */
const DUVAR_X_DAR = 3.4;
const ARKA_Z = -14; // arka duvar
const ON_Z = 9; // yan duvarların kamera arkasındaki ucu
/* 7.8'de duvarın üstü NDC 0.70 → ekranın üst %15'i GÖK oluyordu; dikey
   kadrajda bu, tepede parlak cyan bir blok demek. 9.0'da %8.4'e iner: gök
   bir şerit olarak kalır (avlu açık kalsın), blok olmaz. */
const DUVAR_Y = 9.0; // duvar yüksekliği — uzak iplere tavan payı
const FOV = 46;
const KAMERA_Y = 1.58; // göz hizası
const KAMERA_Z = 7;

const IP_SAYISI = 18;
/* En yakın ip kameradan >5 birim uzakta. Daha yakını, düz bir ipi kadraj
   kenarlarında ±68°'ye sürer ve perspektif onu bir KUBBE KEMERİ gibi büker —
   yasaklı halka/yörünge motifi tam da böyle geri sızıyordu. */
const IP_Z_YAKIN = 1.2;
const IP_Z_UZAK = -11;

/* Kâğıtların inebileceği en alt ekran yüksekliği (NDC: -1 alt, +1 üst).
   0.36 → kâğıtlar tepeden %32'de durur; altı metnin. 0.22'de kicker satırı
   kâğıt alanının içinde kalıyordu — metin sahnenin içinde durmalı, altında değil. */
const NDC_ESIK = 0.36;
const NDC_ESIK_DAR = 0.48; // dar/mobil kadrajda metin bloğu uzar → ipler yukarı

const YAPRAK_W = 0.3;
const YAPRAK_H = 0.42;
const ADLI_KAT = 1.85; // adı basılı yapraklar daha büyük sayfalar

/* 0.028 her şeyi aynı süte çeviriyordu: duvar, zemin ve sis aynı değerdeydi →
   avlu yok, pus vardı. 0.019 hâlâ pustu: tarayıcıda arka duvarın SİLUETİ bir
   kart gibi okunuyordu çünkü sis yan duvarları da aynı değere çekip köşeleri
   yok ediyordu. Mimari ayakta kalsın diye düşürüldü. */
const SIS_YOGUNLUK = 0.0125;

const RENK = {
  /* #8fd2e4 tek başına doygun bir cyan bloğuydu; şerit daraldıktan sonra bile
     kadrajdaki EN doygun şey oydu ve gözü kâğıtlardan alıyordu. Hiyerarşi
     renkten değil şeffaflıktan gelmeli: gök artık ışığın geldiği yön, konu değil. */
  gokUst: "#a9d8e6",
  gokAlt: "#eaf7fa",
  sis: "#dceef2",
  kagitA: "#f9fdfd",
  kagitB: "#e3f0ed",
  isima: "#c9efe6",
  murekkep: "#0e4a46",
  ip: "#0e4a46",
  golge: "#2d5f5d",
};

/* Işık tasarımı okunabilirliği çözüyor, perde değil: metnin arkasına denk gelen
   ARKA DUVAR sahnenin en aydınlık ve en sakin düzlemi; yan duvarlar gölgede,
   zemin en koyu. Böylece koyu teal metin doğal olarak en yüksek kontrastta.
   Değerler bilerek geniş: hepsi %85-100 aralığında kalınca "aydınlık" değil
   "pus" okuyordu. Aydınlık, karşısında koyu bir şey varsa ışık olur. */
/* Tarayıcıda görülen kusur: hepsi birbirine bu kadar yakınken arka duvar bir
   AVLU DUVARI değil, metnin arkasına konmuş beyaz bir KART gibi okunuyordu —
   yani brief'in yasakladığı perde, geometriyle yapılmış hâli. Çare: yan duvar
   ve zemini gerçekten gölgeye indirmek. Arka duvar en aydınlık düzlem kalır,
   ama artık onu çevreleyen şey de bir yüzey; kart değil, ışık alan cephe. */
const SIVA = {
  arkaUst: "#eff7f6",
  arkaAlt: "#d5e6e4",
  yanUst: "#a9c6c5",
  yanAlt: "#6d9493",
  zeminUzak: "#8fb0af",
  zeminYakin: "#5d8180",
};

/* Güneş: yukarı-arka-sol. Kameraya bakan yapraklar ARKADAN aydınlanır → parlar. */
const ISIK = new THREE.Vector3(-0.34, 0.62, -0.71).normalize();
/* Zemin beneklerini alçak güneşle düşürünce hepsi kameraya doğru itilip alt
   kenarda tek bir ÇAMURLU kütleye yığılıyordu (altyazıyı da yutuyordu).
   Açık bir avluda zemini asıl kapatan şey güneş değil GÖKYÜZÜdür: geniş bir
   yarım küre kaynak, gölgeyi neredeyse dik düşürür. Yani benek = gök örtüsü,
   kâğıttaki parlama = doğrudan güneş. İkisi ayrı kaynak, ayrı yön. */
const GOLGE_YON = new THREE.Vector3(-0.12, 0.95, -0.28).normalize();
/* Rüzgâr cephesi: çapraz. Z bileşeni yaprakları ip ekseninde döndüren şey. */
const RUZGAR = new THREE.Vector3(0.55, 0, 0.84).normalize();
const DALGA_K = 0.52; // dalga sayısı → dalga boyu ≈ 12 birim
const DALGA_W = 1.05; // açısal hız → cephe hızı ≈ 2 birim/sn (yavaş)
/* Zarfın dar/geniş oluşu. 0.26 iken zarfın AKTİF bandı 18.7 birimdi; avlunun
   rüzgâr ekseni boyunca genişliği ise 17.6 birim. Yani esinti bandı avludan
   GENİŞTİ: cephe hiç gezmiyor, bütün avlu aynı anda kabarıp aynı anda
   dinleniyordu — bu dosyanın başındaki "hep birlikte değil, SIRAYLA" sözünün
   tam tersi. 0.5'te aktif band 9.7 birim (avlunun yarısı) → band gerçekten
   içeriden geçiyor. Faz hızı değişmez (ω/K = 2 birim/sn): zarf ile taşıyıcı
   aynı hızda gider, sadece band daralır. */
const ZARF_K = 0.5;
const DONUK_AN = 4.7; // reduced-motion'da dondurulan an

/* ── Zincir eğrisi (catenary) ─────────────────────────────────────────── */
/** Verilen yarı-açıklık ve sarkma için catenary parametresi a. */
function catenaryA(H: number, sarkma: number) {
  let a = (H * H) / (2 * sarkma); // küçük sarkma yaklaşımı
  for (let i = 0; i < 6; i++) {
    const ch = Math.cosh(H / a);
    const f = a * (ch - 1) - sarkma;
    const df = ch - 1 - (H / a) * Math.sinh(H / a);
    a -= f / df;
  }
  return a;
}

/* ── Prosedürel dokular (dosya yok) ───────────────────────────────────── */
function gokDokusu() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, RENK.gokUst);
    g.addColorStop(0.55, "#cdeaf1");
    g.addColorStop(1, RENK.gokAlt);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soluk sıva: düz kalsın — metin bunun önünde duracak. Sadece hafif leke. */
function sivaDokusu(ustAydinlik: string, altGolge: string) {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, ustAydinlik);
    g.addColorStop(1, altGolge);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = 18 + Math.random() * 90;
      const a = 0.012 + Math.random() * 0.03;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(14,74,70,${a})`);
      rg.addColorStop(1, "rgba(14,74,70,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Disiplin adları: tek canvas atlası, 4×2 hücre. Yaprak = sayfa, etiket değil. */
function adAtlasi(adlar: string[], aile: string) {
  const W = 1024;
  const H = 768;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const doku = new THREE.CanvasTexture(c);
  doku.colorSpace = THREE.SRGBColorSpace;
  doku.anisotropy = 4;

  const ciz = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const cw = W / 4;
    const ch = H / 2;
    adlar.slice(0, 8).forEach((ad, i) => {
      ctx.save();
      ctx.translate((i % 4) * cw, Math.floor(i / 4) * ch);

      // Gövde metni izlenimi — sayfa hissi. Okunmaz, olması yeter.
      ctx.fillStyle = "rgba(14,74,70,0.26)";
      for (let r = 0; r < 8; r++) {
        const w = cw * 0.56 * (r === 7 ? 0.5 : 0.78 + ((r * 41) % 19) / 90);
        ctx.fillRect(cw * 0.22, ch * 0.54 + r * ch * 0.05, w, 3);
      }

      ctx.fillStyle = "rgba(14,74,70,0.95)";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      let fs = Math.round(ch * 0.14);
      ctx.font = `400 ${fs}px ${aile}`;
      while (ctx.measureText(ad).width > cw * 0.76 && fs > 10) {
        fs -= 2;
        ctx.font = `400 ${fs}px ${aile}`;
      }
      ctx.fillText(ad, cw / 2, ch * 0.4);

      ctx.fillStyle = "rgba(14,74,70,0.45)";
      ctx.fillRect(cw * 0.36, ch * 0.45, cw * 0.28, 2);
      ctx.restore();
    });
    doku.needsUpdate = true;
  };

  ciz();
  return { doku, ciz };
}

/* ── Yaprak shader'ı ──────────────────────────────────────────────────── */
const YAPRAK_VS = /* glsl */ `
attribute vec2 aSize;    // (genişlik, yükseklik) — ölçek matrise değil buraya
attribute vec3 aWobble;  // (durgun açı, sertlik, ton)
attribute vec3 aAtlas;   // (uv offX, uv offY, adı var mı)

uniform float uTime;
uniform vec3  uWind;
uniform float uK;
uniform float uOmega;
uniform float uAmp;
uniform float uEnvK;

varying vec2  vUv;
varying vec3  vN;
varying vec3  vView;
varying vec3  vWorld;
varying float vTint;
varying vec3  vAtlas;

void main() {
  vUv = uv;
  vTint = aWobble.z;
  vAtlas = aAtlas;

  // Askı noktasının dünya konumu (mesh sahne kökünde, modelMatrix = birim).
  vec3 pin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);

  // TEK cephe: faz konumdan geliyor, rastgele değil. Zarf da aynı hızda gider.
  float ph  = dot(pin, uWind) * uK - uTime * uOmega;
  float env = smoothstep(0.30, 1.0, sin(ph * uEnvK));
  float sway = sin(ph) * (0.05 + uAmp * env) * aWobble.y;
  float ang = aWobble.x + sway;

  float droop = -position.y;               // 0 askıda, 1 uçta
  float a = ang * mix(0.45, 1.0, droop);   // uç daha çok döner → tahta değil kâğıt
  a += sin(ph * 1.9 + position.x * 5.0) * 0.06 * (0.25 + env) * droop;

  vec3 p = vec3(position.x * aSize.x, position.y * aSize.y, 0.0);
  float s = sin(a), c = cos(a);
  vec3 pr = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  pr.z += sin((position.x + 0.5) * 3.14159) * 0.05 * aSize.x * (0.35 + env) * droop;

  vec3 n = vec3(normal.x, normal.y * c - normal.z * s, normal.y * s + normal.z * c);

  vec4 wp = instanceMatrix * vec4(pr, 1.0);
  vWorld = wp.xyz;
  vec4 mv = modelViewMatrix * wp;
  vView = mv.xyz;
  vN = normalize(mat3(instanceMatrix) * n);
  gl_Position = projectionMatrix * mv;
}
`;

const YAPRAK_FS = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec2  uCell;
uniform vec3  uLight;
uniform vec3  uPaperA;
uniform vec3  uPaperB;
uniform vec3  uGlow;
uniform vec3  uInk;
uniform vec3  uFog;
uniform float uFogD;
uniform float uSoft;    // 1 = kameraya yakın, odak dışı katman

varying vec2  vUv;
varying vec3  vN;
varying vec3  vView;
varying vec3  vWorld;
varying float vTint;
varying vec3  vAtlas;

void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);

  // Ucuz translucency: önden aydınlanma + arkadan geçen ışık.
  float front = max(dot(N, uLight), 0.0);
  float back  = pow(max(dot(-N, uLight), 0.0), 2.0);

  // 0.60 taban her yaprağı duvarla aynı değere çıkarıp konfeti gibi düzlüyordu.
  // Taban düşük + arkadan geçen ışık güçlü → gökyüzüne denk gelen yaprak parlar,
  // duvara denk gelen yaprak koyu kalır: alan derinlik kazanır.
  vec3 paper = mix(uPaperA, uPaperB, vTint);
  vec3 col = paper * (0.42 + 0.62 * front) + uGlow * back * 1.05;

  // Ad yalnız yaprak kameraya düzleştiğinde okunur — etiket değil, olay.
  if (vAtlas.z > 0.5) {
    vec4 t = texture2D(uAtlas, vUv * uCell + vAtlas.xy);
    float show = smoothstep(0.55, 0.94, abs(dot(N, V)));
    col = mix(col, uInk, t.a * show * (1.0 - uSoft));
  }

  float alpha = 1.0;
  if (uSoft > 0.5) {
    // Odak dışı: kenar erir. 5 quad için gerçek DOF'a değmez.
    float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    alpha = smoothstep(0.0, 0.30, e) * 0.82;
    // Tarayıcıda görülen kusur: uFog'a doğru açılınca köşelerde BEYAZ LEKE
    // oluyordu — kâğıt değil, mercek kiri. Bu kâğıtlar aydınlık avluya karşı
    // duruyor: arkadan aydınlanan yakın kâğıt SİLUETTİR, koyulaşır. Koyu ön
    // plan aynı zamanda derinliği kuran şey.
    col = mix(col, uInk * 0.9, 0.34);
  }

  // FogExp2 ile birebir aynı formül (duvarlar MeshBasic + scene.fog kullanıyor).
  float fd = -vView.z;
  float f = 1.0 - exp(-uFogD * uFogD * fd * fd);
  col = mix(col, uFog, f);

  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

/* ── Gölge shader'ı ───────────────────────────────────────────────────────
 * Tarayıcıda görülen asıl kusur: kâğıtlar kadrajın üst çeyreğine sıkışmış bir
 * bant, alt %40 ise ÖLÜ boş zemindi. Metin bir hiçliğin üstünde duruyordu.
 * Çözüm perde/dolgu değil: kâğıtların ZATEN var olan ışığı. Güneş yukarı-arka-
 * soldan geldiği için her yaprağın gölgesi zemine, kameraya doğru düşer —
 * yani tam o ölü bölgeye. Rüzgâr cephesi geçerken benekler birlikte kayar:
 * sirkülasyon artık tavanda değil, ayağının dibinde de okunuyor.
 * Yaprak yan döndüğünde gölgesi incelir (|cos|) — gölge kâğıdı takip eder.
 */
const GOLGE_VS = /* glsl */ `
attribute vec2 aSize;
attribute vec3 aWobble;
attribute vec3 aPin;     // yaprağın askı noktası: faz KONUMDAN gelmeli

uniform float uTime;
uniform vec3  uWind;
uniform float uK;
uniform float uOmega;
uniform float uAmp;
uniform float uEnvK;

varying vec2  vUv;
varying float vDar;
varying vec3  vView;

void main() {
  vUv = uv;
  // Yaprakla BİREBİR aynı faz: gölge kendi hayatını yaşamasın. Zarf sabiti de
  // uniform üzerinden PAYLAŞILIYOR — iki shader'da ayrı ayrı yazılsa biri
  // ayarlanınca gölge yaprağından kopar.
  float ph  = dot(aPin, uWind) * uK - uTime * uOmega;
  float env = smoothstep(0.30, 1.0, sin(ph * uEnvK));
  float sway = sin(ph) * (0.05 + uAmp * env) * aWobble.y;
  float ang = aWobble.x + sway;

  float dar = 0.18 + 0.82 * abs(cos(ang)); // yan dönen kâğıt ince gölge bırakır
  vDar = dar;

  // Düzlem XY'de; zemine yatırmak için y → z.
  vec3 p = vec3(position.x * aSize.x, 0.0, position.y * aSize.y * dar);
  vec4 wp = instanceMatrix * vec4(p, 1.0);
  vec4 mv = modelViewMatrix * wp;
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const GOLGE_FS = /* glsl */ `
uniform vec3  uShadow;
uniform float uFogD;
uniform float uStrength;

varying vec2  vUv;
varying float vDar;
varying vec3  vView;

void main() {
  // Yumuşak elips: sert kenarlı gölge kâğıdı tahtaya çevirir.
  float d = length(vUv - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.15, d) * uStrength * (0.35 + 0.65 * vDar);

  // Uzaktaki gölge sisin içinde erir (zeminle aynı hava perspektifi).
  float fd = -vView.z;
  float f = 1.0 - exp(-uFogD * uFogD * fd * fd);
  a *= 1.0 - f;

  gl_FragColor = vec4(uShadow, a);
}
`;

type Yaprak = {
  x: number;
  y: number;
  z: number;
  egim: number; // ip teğeti (Z ekseni etrafında)
  sapma: number; // küçük Y sapması
  w: number;
  h: number;
  durgun: number; // ip ekseni etrafındaki durgun açı
  sertlik: number;
  ton: number;
  ad: number; // -1 = adsız
};

export function AvluSahnesi({
  adlar,
  yaziAilesi,
}: {
  adlar: readonly string[];
  yaziAilesi: string;
}) {
  const kapRef = useRef<HTMLDivElement>(null);
  // Prop kimliği her render'da değişmesin diye ref: sahne bir kez kurulur.
  const adlarRef = useRef(adlar);
  adlarRef.current = adlar;
  const adAnahtar = adlar.join("|");

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kaba = window.matchMedia("(pointer: coarse)").matches;
    const statik = azHareket;

    const en = kap.clientWidth || 1;
    const boy = kap.clientHeight || 1;
    const oran = en / boy;

    /* Avlunun genişliği kadraja bağlı: dikeyde daralıp ARALIK olur, yoksa yan
       duvarlar kadrajın dışına düşüp oda kayboluyor. İpler, catenary, yaprak
       dağılımı ve gölge kırpması — hepsi bundan türer. */
    const duvarX = oran < 1.05 ? DUVAR_X_DAR : DUVAR_X;

    const sahne = new THREE.Scene();
    sahne.fog = new THREE.FogExp2(new THREE.Color(RENK.sis).getHex(), SIS_YOGUNLUK);

    const kamera = new THREE.PerspectiveCamera(FOV, oran, 0.1, 90);
    kamera.position.set(0, KAMERA_Y, KAMERA_Z);
    kamera.lookAt(0, 2.45, -6);
    kamera.updateMatrixWorld();

    const cizer = new THREE.WebGLRenderer({
      antialias: !kaba,
      powerPreference: "high-performance",
    });
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap
    cizer.setSize(en, boy);
    cizer.setClearColor(new THREE.Color(RENK.gokAlt), 1);
    kap.appendChild(cizer.domElement);

    const atilacak: { dispose: () => void }[] = [];

    /* ── Kompozisyon hesabı: kâğıtlar bu ekran yüksekliğinin altına inemez ── */
    const esik = oran < 1.05 ? NDC_ESIK_DAR : NDC_ESIK;
    const nokta = new THREE.Vector3();
    const ndcY = (y: number, z: number) => nokta.set(0, y, z).project(kamera).y;
    /** ndcY(y,z) monoton artan → hedef NDC'yi veren dünya y'si. */
    const yIcin = (hedef: number, z: number) => {
      let lo = 0;
      let hi = 30;
      for (let i = 0; i < 30; i++) {
        const orta = (lo + hi) / 2;
        if (ndcY(orta, z) < hedef) lo = orta;
        else hi = orta;
      }
      return (lo + hi) / 2;
    };

    /* ── Gökyüzü: fotoğraf değil, tek gradyan düzlem ─────────────────── */
    const gokDoku = gokDokusu();
    // Boyut/konum gradyanın KULLANILAN aralığını belirliyor: 150×60 @ y=18 iken
    // duvar üstünün üstünde kalan bant gradyanın sadece soluk dibine denk
    // geliyordu → gök hiç mavi olmuyordu. 44 yükseklik @ y=10 ile görünen bant
    // (dünya y ≈ 8..26) gradyanın üst yarısına oturuyor.
    const gokGeo = new THREE.PlaneGeometry(200, 44);
    const gokMat = new THREE.MeshBasicMaterial({ map: gokDoku, fog: false, depthWrite: false });
    const gok = new THREE.Mesh(gokGeo, gokMat);
    gok.position.set(0, 10, -42);
    gok.renderOrder = -10;
    sahne.add(gok);
    atilacak.push(gokGeo, gokMat, gokDoku);

    /* ── Avlu: arka duvar + iki yan duvar + zemin ─────────────────────── */
    const arkaDoku = sivaDokusu(SIVA.arkaUst, SIVA.arkaAlt);
    const yanDoku = sivaDokusu(SIVA.yanUst, SIVA.yanAlt);
    // Zemin düzlemi -90° döndüğü için doku "üstü" uzak uca düşer.
    const zeminDoku = sivaDokusu(SIVA.zeminUzak, SIVA.zeminYakin);
    atilacak.push(arkaDoku, yanDoku, zeminDoku);

    const arkaGeo = new THREE.PlaneGeometry(duvarX * 2, DUVAR_Y);
    const arkaMat = new THREE.MeshBasicMaterial({ map: arkaDoku });
    const arka = new THREE.Mesh(arkaGeo, arkaMat);
    arka.position.set(0, DUVAR_Y / 2, ARKA_Z);
    sahne.add(arka);
    atilacak.push(arkaGeo, arkaMat);

    const yanGeo = new THREE.PlaneGeometry(ON_Z - ARKA_Z, DUVAR_Y);
    const yanMat = new THREE.MeshBasicMaterial({ map: yanDoku, side: THREE.DoubleSide });
    atilacak.push(yanGeo, yanMat);
    for (const yon of [-1, 1]) {
      const d = new THREE.Mesh(yanGeo, yanMat);
      d.position.set(yon * duvarX, DUVAR_Y / 2, (ON_Z + ARKA_Z) / 2);
      d.rotation.y = yon * -Math.PI * 0.5;
      sahne.add(d);
    }

    const zeminGeo = new THREE.PlaneGeometry(duvarX * 2, ON_Z - ARKA_Z);
    const zeminMat = new THREE.MeshBasicMaterial({ map: zeminDoku });
    const zemin = new THREE.Mesh(zeminGeo, zeminMat);
    zemin.rotation.x = -Math.PI / 2;
    zemin.position.set(0, 0, (ON_Z + ARKA_Z) / 2);
    sahne.add(zemin);
    atilacak.push(zeminGeo, zeminMat);

    /* ── İpler + yapraklar ────────────────────────────────────────────── */
    const hedefYaprak = kaba ? 380 : 720;
    const yapraklar: Yaprak[] = [];
    const ipNoktalari: number[] = [];

    // Adlı yapraklar orta derinliklere: hem okunur hem sahnenin içinde kalır.
    const adSayisi = adlarRef.current.length;
    let adSayac = 0;

    for (let i = 0; i < IP_SAYISI; i++) {
      const t = i / (IP_SAYISI - 1);
      const z = IP_Z_YAKIN + (IP_Z_UZAK - IP_Z_YAKIN) * t + (Math.random() - 0.5) * 0.5;
      // Gergin ip: sarkma azaldıkça çizgi çizgi kalır. Bol sarkma kadrajda
      // kemere dönüşüp yine halka okutuyordu.
      const sarkma = 0.16 + Math.random() * 0.26;
      const a = catenaryA(duvarX, sarkma);

      // İpin yüksekliği: kompozisyon eşiği ZORUNLU alt sınır, üstü serbest.
      const gerekli = yIcin(esik, z) + sarkma + YAPRAK_H * ADLI_KAT;
      const tavan = DUVAR_Y - 0.35;
      if (gerekli > tavan) continue; // bu derinlikte ip metnin üstünde kalamaz → yok
      // Kalan boşluğa orantılı dağıl: hepsi alt sınıra yığılırsa ipler tek bir
      // yatay raf olur ve o raf da kemer okur.
      const yTop = gerekli + Math.random() * (tavan - gerekli) * 0.8;

      // Zincir eğrisi: uçlarda yTop, ortada yTop - sarkma.
      const ipY = (x: number) => yTop - a * (Math.cosh(duvarX / a) - Math.cosh(x / a));

      // İp çizgisi
      const ORNEK = 26;
      const oy: number[] = [];
      for (let s = 0; s < ORNEK; s++) {
        const x = -duvarX + (2 * duvarX * s) / (ORNEK - 1);
        oy.push(x, ipY(x), z);
      }
      for (let s = 0; s < ORNEK - 1; s++) {
        ipNoktalari.push(oy[s * 3], oy[s * 3 + 1], oy[s * 3 + 2]);
        ipNoktalari.push(oy[s * 3 + 3], oy[s * 3 + 4], oy[s * 3 + 5]);
      }

      // Yapraklar ip boyunca
      const adet = Math.round((hedefYaprak / IP_SAYISI) * (0.7 + Math.random() * 0.6));
      for (let k = 0; k < adet; k++) {
        if (Math.random() < 0.12) continue; // boşluklar: dizilim makine gibi olmasın
        const u = (k + 0.5) / adet + (Math.random() - 0.5) * 0.5 / adet;
        const x = -duvarX * 0.94 + 2 * duvarX * 0.94 * u;
        const adli = adSayac < adSayisi * 2 && z < 0.5 && z > -8 && Math.random() < 0.055;
        const kat = adli ? ADLI_KAT : 0.82 + Math.random() * 0.4;
        yapraklar.push({
          x,
          y: ipY(x),
          z,
          egim: Math.atan(Math.sinh(x / a)),
          sapma: (Math.random() - 0.5) * 0.22,
          w: YAPRAK_W * kat,
          h: YAPRAK_H * kat,
          // Durgun açılar geniş dağılır: çoğu yaprak kameraya kapalı durur,
          // cephe geçerken sırayla 0'dan süzülüp adını gösterir.
          durgun: (Math.random() - 0.5) * 2.5,
          sertlik: 0.7 + Math.random() * 0.55,
          ton: Math.random(),
          ad: adli ? adSayac++ % adSayisi : -1,
        });
      }
    }

    const ipGeo = new THREE.BufferGeometry();
    ipGeo.setAttribute("position", new THREE.Float32BufferAttribute(ipNoktalari, 3));
    const ipMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(RENK.ip),
      transparent: true,
      opacity: 0.5,
    });
    sahne.add(new THREE.LineSegments(ipGeo, ipMat));
    atilacak.push(ipGeo, ipMat);

    /* ── Kameraya çok yakın, odak dışı yapraklar: UI'ı derinliğe gömer ── */
    const yakinlar: Yaprak[] = [];
    if (!kaba) {
      // Dünya x'i ile yerleştirmek işe yaramaz: bu derinlikte kadraj yarı
      // genişliği ~1.2 birim, ±2.2 frustum'un dışına düşüyordu. Kenar oranını
      // gerçek kadraj genişliğine çevir → her en/boy'da köşede kalırlar.
      const tanY = Math.tan((FOV * Math.PI) / 360);
      const kenar = [-0.92, -0.68, 0.72, 0.95, -1.0]; // 1 = kadrajın tam kenarı
      const derinlik = [5.35, 5.05, 5.45, 5.15, 4.6];
      for (let i = 0; i < 5; i++) {
        const z = derinlik[i];
        const yariEn = (KAMERA_Z - z) * tanY * oran;
        // Uzun ve aşağı sarkan: kadrajın üst köşesinden metnin yanına kadar
        // inerler. Tepe köşede kalınca hiçbir işe yaramıyorlardı — UI'ı derinliğe
        // gömen şey, metnin YANINDA önde duran bulanık kütle.
        const kat = 2.6 + Math.random() * 0.8;
        yakinlar.push({
          x: kenar[i] * yariEn,
          y: 3.0 + Math.random() * 0.12, // askı noktası her derinlikte kadrajın üstünde
          z,
          egim: (Math.random() - 0.5) * 0.2,
          sapma: (Math.random() - 0.5) * 0.4,
          w: YAPRAK_W * kat,
          h: YAPRAK_H * kat,
          durgun: (Math.random() - 0.5) * 1.4,
          sertlik: 0.8 + Math.random() * 0.4,
          ton: Math.random(),
          ad: -1,
        });
      }
    }

    /* ── Yaprak geometrisi + InstancedMesh'ler ────────────────────────── */
    const { doku: atlasDoku, ciz: atlasCiz } = adAtlasi(adlarRef.current.slice(0, 8), yaziAilesi);
    atilacak.push(atlasDoku);

    const ortakUniform = {
      uTime: { value: statik ? DONUK_AN : 0 },
      uWind: { value: RUZGAR },
      uK: { value: DALGA_K },
      uOmega: { value: DALGA_W },
      uEnvK: { value: ZARF_K },
      uAmp: { value: 0.92 },
      uAtlas: { value: atlasDoku },
      uCell: { value: new THREE.Vector2(0.25, 0.5) },
      uLight: { value: ISIK },
      uPaperA: { value: new THREE.Color(RENK.kagitA) },
      uPaperB: { value: new THREE.Color(RENK.kagitB) },
      uGlow: { value: new THREE.Color(RENK.isima) },
      uInk: { value: new THREE.Color(RENK.murekkep) },
      uFog: { value: new THREE.Color(RENK.sis) },
      uFogD: { value: SIS_YOGUNLUK },
    };

    /**
     * Bir yaprak katmanı kurar. Her katman KENDİ geometrisini alır: per-instance
     * attribute'lar geometriye yazılıyor, paylaşılan geometri iki mesh'te çakışır.
     */
    const kur = (liste: Yaprak[], soft: number) => {
      const geo = new THREE.PlaneGeometry(1, 1, 3, 5);
      geo.translate(0, -0.5, 0); // askı noktası orijinde, yaprak aşağı sarkar
      const mat = new THREE.ShaderMaterial({
        vertexShader: YAPRAK_VS,
        fragmentShader: YAPRAK_FS,
        side: THREE.DoubleSide,
        transparent: soft > 0.5,
        depthWrite: soft < 0.5,
        uniforms: { ...ortakUniform, uSoft: { value: soft } },
      });
      const mesh = new THREE.InstancedMesh(geo, mat, liste.length);
      mesh.frustumCulled = false; // shader köşeleri oynatıyor; bbox yalan söyler
      mesh.renderOrder = soft > 0.5 ? 10 : 0;

      const boyut = new Float32Array(liste.length * 2);
      const wobble = new Float32Array(liste.length * 3);
      const atlas = new Float32Array(liste.length * 3);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const p = new THREE.Vector3();
      const bir = new THREE.Vector3(1, 1, 1);

      liste.forEach((y, i) => {
        // Sadece dönme + öteleme: ölçek aSize ile shader'da, yoksa yaprak
        // ip ekseninde dönerken non-uniform ölçek onu yamultur.
        e.set(0, y.sapma, y.egim, "YZX");
        m.compose(p.set(y.x, y.y, y.z), q.setFromEuler(e), bir);
        mesh.setMatrixAt(i, m);
        boyut[i * 2] = y.w;
        boyut[i * 2 + 1] = y.h;
        wobble[i * 3] = y.durgun;
        wobble[i * 3 + 1] = y.sertlik;
        wobble[i * 3 + 2] = y.ton;
        if (y.ad >= 0) {
          atlas[i * 3] = (y.ad % 4) * 0.25;
          atlas[i * 3 + 1] = 1 - (Math.floor(y.ad / 4) + 1) * 0.5;
          atlas[i * 3 + 2] = 1;
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      geo.setAttribute("aSize", new THREE.InstancedBufferAttribute(boyut, 2));
      geo.setAttribute("aWobble", new THREE.InstancedBufferAttribute(wobble, 3));
      geo.setAttribute("aAtlas", new THREE.InstancedBufferAttribute(atlas, 3));
      sahne.add(mesh);
      atilacak.push(geo, mat);
      return mat;
    };

    const katmanlar = [kur(yapraklar, 0)];
    if (yakinlar.length) katmanlar.push(kur(yakinlar, 1));

    /* ── Zemin gölgeleri: ölü alt bölgeyi sahnenin KENDİ ışığı dolduruyor ── */
    const golgeKur = () => {
      // Yaprağı ışık boyunca y=0 düzlemine düşür: P - L * (P.y / L.y).
      const t0 = 1 / GOLGE_YON.y;
      const yerler: { x: number; z: number; w: number; h: number; y: Yaprak }[] = [];
      for (const y of yapraklar) {
        const t = y.y * t0;
        const fx = y.x - GOLGE_YON.x * t;
        const fz = y.z - GOLGE_YON.z * t;
        // Zeminin dışına, kameranın arkasına ya da duvarın ötesine düşenler yok.
        if (Math.abs(fx) > duvarX || fz > KAMERA_Z - 0.6 || fz < ARKA_Z) continue;
        // Yükseklik arttıkça gölge büyür ve yayılır (penumbra). 0.16 + 1.5 kat
        // benekleri birbirine yapıştırıp tek koyu lekeye çeviriyordu: ayrı ayrı
        // kâğıt gölgeleri okunmalı, gölet değil.
        const yay = 1 + y.y * 0.09;
        yerler.push({ x: fx, z: fz, w: y.w * yay * 1.1, h: y.h * yay * 1.1, y });
      }
      if (!yerler.length) return null;

      const geo = new THREE.PlaneGeometry(1, 1);
      const mat = new THREE.ShaderMaterial({
        vertexShader: GOLGE_VS,
        fragmentShader: GOLGE_FS,
        // DoubleSide ŞART: VS'te position.y'yi z'ye taşıyoruz, bu da tabanı
        // e_y→e_z yapıyor; normal (e_x×e_y=e_z) → e_x×e_z = -e_y oluyor. Yani
        // quad AŞAĞI bakıyor ve FrontSide onu tümden eliyordu — gölgeler hiç
        // çizilmiyordu (kırmızı testinde tek piksel bile çıkmadı).
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: ortakUniform.uTime,
          uWind: ortakUniform.uWind,
          uK: ortakUniform.uK,
          uOmega: ortakUniform.uOmega,
          uEnvK: ortakUniform.uEnvK,
          uAmp: ortakUniform.uAmp,
          uShadow: { value: new THREE.Color(RENK.golge) },
          uFogD: { value: SIS_YOGUNLUK },
          // 0.5 çok sertti: alt şeritteki künye okunmaz oldu. Benek zeminin
          // dokusu olmalı, üstüne serilen ikinci bir perde değil.
          uStrength: { value: 0.24 },
        },
      });
      const mesh = new THREE.InstancedMesh(geo, mat, yerler.length);
      mesh.frustumCulled = false;
      mesh.renderOrder = 1; // zeminden sonra, yapraklardan önce

      const boyut = new Float32Array(yerler.length * 2);
      const wobble = new Float32Array(yerler.length * 3);
      const pin = new Float32Array(yerler.length * 3);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const p = new THREE.Vector3();
      const bir = new THREE.Vector3(1, 1, 1);

      yerler.forEach((g, i) => {
        m.compose(p.set(g.x, 0.02, g.z), q.identity(), bir);
        mesh.setMatrixAt(i, m);
        boyut[i * 2] = g.w;
        boyut[i * 2 + 1] = g.h;
        wobble[i * 3] = g.y.durgun;
        wobble[i * 3 + 1] = g.y.sertlik;
        wobble[i * 3 + 2] = g.y.ton;
        // Faz yaprağın ASKI noktasından; gölgenin kendi konumundan değil.
        pin[i * 3] = g.y.x;
        pin[i * 3 + 1] = g.y.y;
        pin[i * 3 + 2] = g.y.z;
      });
      mesh.instanceMatrix.needsUpdate = true;
      geo.setAttribute("aSize", new THREE.InstancedBufferAttribute(boyut, 2));
      geo.setAttribute("aWobble", new THREE.InstancedBufferAttribute(wobble, 3));
      geo.setAttribute("aPin", new THREE.InstancedBufferAttribute(pin, 3));
      sahne.add(mesh);
      atilacak.push(geo, mat);
      return mat;
    };
    const golgeMat = golgeKur();
    if (golgeMat) katmanlar.push(golgeMat);

    // Fontlar yüklenince atlası yeniden çiz (canvas font yarışını kapat).
    let bitti = false;
    document.fonts?.ready.then(() => {
      if (bitti) return;
      atlasCiz();
      if (statik) cizer.render(sahne, kamera);
    });

    /* ── Döngü + kapılar ──────────────────────────────────────────────── */
    let id = 0;
    let gorunur = false;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const zamanYaz = (t: number) => {
      katmanlar.forEach((m) => (m.uniforms.uTime.value = t));
    };

    const ciz = () => {
      zamanYaz(saat.getElapsedTime());
      cizer.render(sahne, kamera);
      id = requestAnimationFrame(ciz);
    };
    const basla = () => {
      if (calisiyor || statik) return;
      calisiyor = true;
      id = requestAnimationFrame(ciz);
    };
    const dur = () => {
      if (!calisiyor) return;
      calisiyor = false;
      cancelAnimationFrame(id);
    };

    // reduced-motion: rAF HİÇ başlamaz. Rüzgâr fazı sabit, kompozisyon tam.
    if (statik) {
      zamanYaz(DONUK_AN);
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
      const w = kap.clientWidth;
      const h = kap.clientHeight;
      if (!w || !h) return;
      kamera.aspect = w / h;
      kamera.updateProjectionMatrix();
      cizer.setSize(w, h);
      if (statik || !calisiyor) cizer.render(sahne, kamera);
    };
    const ro = new ResizeObserver(boyutla);
    ro.observe(kap);

    return () => {
      bitti = true;
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      atilacak.forEach((o) => o.dispose());
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, [adAnahtar, yaziAilesi]);

  return <div ref={kapRef} className="avluTuval" aria-hidden="true" />;
}

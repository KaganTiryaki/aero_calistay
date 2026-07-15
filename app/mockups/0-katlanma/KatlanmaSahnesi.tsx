"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  NCREASE,
  NFOLD,
  NPERM,
  derinlikFragment,
  kagitFragment,
  kagitVertex,
} from "./katlanmaShader";

/*
 * KATLANMA — tek büyük beyaz sayfa, tek sert ışık.
 *
 * Harman: sayfa ekranı DOLDURUYOR, sahne UI'ın arkasında değil ALTINDA —
 * metin sayfanın üstüne basılı mürekkep. Okunabilirlik perdeyle değil fizikle:
 * kat çizgisi düzlemi ikiye böler, çizgiden uzak bölge DÜZ kalır → tek normal →
 * tek düz aydınlanma. Metin o düzlükte. Görsel olay (sırt, gölge, rim) kat
 * çizgisinin olduğu yerde, yani kenarlarda.
 *
 * Kalkan kanat kendi gölgesini metnin üstünden geçiriyor: scrim'in tersi —
 * gölge sahnenin kendi ışığından geliyor, uydurma bir gradyandan değil.
 *
 * Zorunlu kapılar: DPR cap · IntersectionObserver · visibilitychange ·
 * prefers-reduced-motion'da rAF hiç başlamaz (tek statik kare) · pointer:coarse'da
 * tessellation/gölge/PCF düşer + antialias kapanır · cleanup'ta tam dispose.
 */

const FOV = 38;
const BASE_DIST = 10.6;
const MIN_VIS_W = 7.2; // dar portrede kompozisyon ezilmesin diye kamerayı geri çek
const LOOK_Y = 0.1;

/*
 * Işık YALAYAN olmak zorunda: gölge uzunluğu = yükseklik * (yatay/dikey bileşen).
 * Eski (…, 0.68) → oran 0.73/0.68 ≈ 1.07, yani 2 birimlik kanat 2 birim gölge
 * atıyordu ve gölge kendi kenarında kalıyordu. Yeni z=0.51 → oran ≈ 1.7: aynı
 * kanat ~3.5 birim gölge atıyor ve kadrajın ortasına, metnin arkasına ULAŞIYOR.
 * Daha da yatık yapmak paper'ın düz alanını karartırdı (key = N·L = z) — 0.51,
 * "uzun gölge" ile "kâğıt beyaz kalsın"ın kesiştiği yer.
 */
const ISIK = new THREE.Vector3(-0.75, 0.42, 0.51).normalize();

const KIRIK_RISE = 2.5;
const KIRIK_HOLD = 45;
const KIRIK_FADE = 28;

type Cerceve = {
  hw: number;
  hh: number;
  ghw: number;
  ghh: number;
  pw: number; // sayfanın yarı ölçüsü
  ph: number;
  dikey: boolean;
};
type Kat = {
  zone: 0 | 1 | 2; // 0 · 1 = uzun kenarlar · 2 = geçiş (sayfayı boydan boya gezen sığ kat)
  j: number; // taban açıya eklenen jitter (zone 2'de mutlak açı)
  f0: number;
  f1: number;
  th: number;
  R: number;
  t0: number;
  rise: number;
  hold: number;
  fall: number;
  yazildi: boolean;
};
type Kirik = { ang: number; d: number; t0: number };

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const smooth = (t: number) => t * t * (3 - 2 * t);
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const rast = (a: number, b: number) => a + Math.random() * (b - a);

/** Dikdörtgenin destek fonksiyonu: ang yönünde dikdörtgene teğet çizginin mesafesi. */
const destek = (ang: number, hw: number, hh: number) =>
  hw * Math.abs(Math.cos(ang)) + hh * Math.abs(Math.sin(ang));

/** Tileable value noise — kâğıt fiberi için, doku dosyası yok. */
function kafes(per: number, seed: number) {
  const a = new Float32Array(per * per);
  let s = seed >>> 0;
  for (let i = 0; i < a.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    a[i] = s / 4294967296;
  }
  return a;
}

function kafesOrnek(a: Float32Array, per: number, x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = smooth(fx);
  const sy = smooth(fy);
  const g = (i: number, j: number) =>
    a[(((j % per) + per) % per) * per + (((i % per) + per) % per)];
  const v0 = g(x0, y0) * (1 - sx) + g(x0 + 1, y0) * sx;
  const v1 = g(x0, y0 + 1) * (1 - sx) + g(x0 + 1, y0 + 1) * sx;
  return v0 * (1 - sy) + v1 * sy;
}

/**
 * Kâğıt fiberi: anizotropik (fiberler yatay uzanır) yükseklik alanı → Sobel →
 * RG'de eğim. Tek tap'te normal sapması, dosya indirmeden.
 */
function fiberDokusu(size: number): THREE.CanvasTexture | null {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  const h = new Float32Array(size * size);
  const oktav = [
    { per: 32, amp: 1.0, sy: 3.2 },
    { per: 64, amp: 0.5, sy: 2.6 },
    { per: 128, amp: 0.25, sy: 2.0 },
  ];
  for (const o of oktav) {
    const lat = kafes(o.per, o.per * 7919 + 13);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // sy > 1 → örüntü y'de sıkışır, yani fiberler yatay uzar
        h[y * size + x] +=
          o.amp *
          kafesOrnek(lat, o.per, (x / size) * o.per, ((y / size) * o.per * o.sy) % o.per);
      }
    }
  }

  const img = ctx.createImageData(size, size);
  const at = (x: number, y: number) =>
    h[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      const i = (y * size + x) * 4;
      img.data[i] = clamp(dx * 0.5 + 0.5, 0, 1) * 255;
      img.data[i + 1] = clamp(dy * 0.5 + 0.5, 0, 1) * 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/**
 * Katlar her zaman çerçevenin UZUN kenarlarında yaşar: yatayda sol/sağ,
 * portrede üst/alt. Böylece metin sütunu hiçbir en-boy oranında ezilmiyor.
 */
function katAng(k: Kat, c: Cerceve) {
  if (k.zone === 2) return k.j;
  if (c.dikey) return (k.zone === 0 ? Math.PI / 2 : -Math.PI / 2) + k.j;
  return (k.zone === 0 ? Math.PI : 0) + k.j;
}

function yeniKat(zone: Kat["zone"], t: number): Kat {
  if (zone === 2) {
    // Geçiş katı: çok sığ (≈5°) ama sayfayı boydan boya geçer. İşi kompozisyon
    // değil TARİH: ortadan geçip metnin arkasına kalıcı bir kırık izi bırakıyor.
    // Sığ olduğu için ne okunabilirliği bozuyor ne de bir şeyi kapatıyor.
    return {
      zone,
      j: Math.random() * Math.PI * 2,
      f0: rast(-0.9, -0.35),
      f1: rast(0.35, 0.9),
      th: rast(0.05, 0.12) * (Math.random() < 0.5 ? -1 : 1),
      R: 0.55,
      t0: t,
      rise: rast(5, 7),
      hold: rast(9, 15),
      fall: rast(5, 7),
      yazildi: false,
    };
  }
  // DERİN kat: kat çizgisi çerçevenin kenarına yakın → kalkan kanat KISA →
  // 90°'yi geçince sayfanın uzak kenarı merkeze doğru geri yatıyor. Gölgesini
  // metnin üstüne düşüren tek konfigürasyon bu; sığ kat merkezden UZAĞA
  // katlandığı için gölgesi hep kendi kenarında kalıyor.
  // (Kat formülü th ∈ (0,π) için kanadın tamamını w>0'da tutuyor → kâğıt
  //  kendinden geçemez, yani derin açı matematiksel olarak güvenli.)
  const derin = Math.random() < 0.55;
  const f0 = derin ? rast(0.58, 0.9) : rast(0.04, 0.42);
  return {
    zone,
    // ±14° jitter: kat çizgileri paralel olmasın ama merkezdeki güvenli
    // dikdörtgeni destek fonksiyonu garanti etmeye devam etsin.
    j: rast(-0.24, 0.24),
    f0,
    f1: clamp(f0 + rast(-0.22, 0.22), derin ? 0.5 : 0.02, derin ? 0.95 : 0.55),
    th: derin ? rast(1.45, 2.1) : rast(0.32, 0.7),
    R: derin ? rast(0.34, 0.52) : rast(0.3, 0.5),
    t0: t,
    rise: rast(5, 7.5),
    hold: rast(5, 9),
    fall: rast(5, 7.5),
    yazildi: false,
  };
}

/**
 * Kalkan kanadın metne girmemesi için açı tavanı. Kanat 90°'yi geçince uzak
 * kenar merkeze doğru geri yatıyor; ne kadar geri yatabileceğini güvenli
 * dikdörtgen belirliyor. Yani derin kat serbest değil, geometriyle sınırlı.
 */
function katTheta(k: Kat, c: Cerceve, dLife: number) {
  if (k.zone === 2) return k.th;
  const ang = katAng(k, c);
  const paperR = destek(ang, c.pw, c.ph); // kanadın en uzak noktası
  const dSafe = destek(ang, c.ghw, c.ghh);
  const flap = Math.max(paperR - dLife, 0.2);
  let th = k.th;
  for (let i = 0; i < 32 && th > 0.32; i++) {
    const e = Math.max(flap - k.R * th, 0);
    const uu = k.R * Math.sin(th) + e * Math.cos(th);
    if (dLife + uu >= dSafe) break;
    th -= 0.06;
  }
  return Math.max(th, 0.32);
}

function katD(k: Kat, prog: number, c: Cerceve) {
  const f = k.f0 + (k.f1 - k.f0) * smooth(prog);
  const ang = katAng(k, c);
  if (k.zone === 2) return f * destek(ang, c.hw, c.hh);
  // Güvenli dikdörtgenin destek fonksiyonu = kalkan kanadın metne ASLA
  // giremeyeceğinin garantisi (perde değil, geometri).
  const dMin = destek(ang, c.ghw, c.ghh) + 0.18;
  const dMax = destek(ang, c.hw, c.hh);
  return dMin + Math.max(dMax - dMin, 0.4) * f;
}

/**
 * KALICI kat ağı — kompozisyonun bel kemiği.
 *
 * Neden var: katlar (uFold) geometrik olarak kadrajın DIŞ %45'inde yaşamak
 * zorunda (güvenli dikdörtgen sözü), kanat da dışa katlandığı için yükselen
 * geometri kadraj dışında kalıyor. Sonuç: merkezî %55 — yani metnin durduğu
 * yer — sonsuza kadar bomboş düz beyaz. Render bunu doğruladı: 13. saniyede
 * ekranda hiçbir şey yoktu.
 *
 * Çözüm perde değil, TARİH: sayfa daha önce katlanıp açılmış. Kat ağı kadrajı
 * boydan boya dolduruyor ama sayfayı DÜZ yüzeylere bölüyor — kırık çizgileri
 * ince (≈4px), yüzeylerin kendisi düz. Metin bir yüzeyin üstünde duruyor,
 * okunabilirlik yüzeyin düzlüğünden geliyor, boşluktan değil.
 *
 * İşaret sırası bilerek alternatif: vadi/sırt/vadi — hepsi aynı yöne kıvrılırsa
 * kabartma deseni gibi durur, katlanmış kâğıt gibi değil.
 */
function kalicAg(c: Cerceve, uCrease: THREE.Vector4[]) {
  // Konumlar sayfa yarı-ölçüsünün oranı (pw/ph), ±jitter ile "makineyle
  // katlanmış" olmaktan çıkıyor. Dikeyler |x| ≈ 0.29–0.35·visW'de, yani metin
  // sütununun (ghw = 0.26·visW) DIŞINDA: başlığı kesmiyor, çerçeveliyor.
  // 9 iz + diyagonaller ızgara/tel-kafes gibi duruyordu (render'da görüldü):
  // düzenli kafes = ucuz. 5'e indi ve düzenlilik kırıldı — sayfa "ikiye, sonra
  // tekrar ikiye katlanmış" okunuyor, "üstüne ızgara basılmış" değil.
  // Diyagonal SADECE bir tane: aksi hâlde kırık cam etkisi doğuyor.
  const ag: [number, number, number][] = [
    // [açı, konum oranı, işaret]  · açı 0 = dikey çizgi (normal = +x)
    [0, -0.53, 1],
    [0, 0.44, -1],
    [Math.PI / 2, -0.46, -1],
    [Math.PI / 2, 0.41, 1],
    [1.21, 0.58, -1],
  ];
  for (let i = 0; i < NPERM; i++) {
    const [a0, f, s] = ag[i % ag.length];
    const ang = a0 + rast(-0.05, 0.05);
    const yari = destek(ang, c.pw, c.ph);
    // güç 0.5–0.85: kalıcı ağ geçici izlerden daha SAKİN, yoksa yeni kat
    // açıldığında fark edilmiyor.
    uCrease[i].set(Math.cos(ang), Math.sin(ang), f * yari, s * rast(0.5, 0.85));
  }
}

function kirikGuc(k: Kirik | null, t: number) {
  if (!k) return 0;
  const a = t - k.t0;
  if (a < 0) return 0;
  const inn = smooth(clamp(a / KIRIK_RISE, 0, 1));
  const out = 1 - smooth(clamp((a - KIRIK_HOLD) / KIRIK_FADE, 0, 1));
  return inn * out;
}

export default function KatlanmaSahnesi() {
  const kapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)");
    const kaba = window.matchMedia("(pointer: coarse)");
    const statik = azHareket.matches;
    const hafif = kaba.matches;

    const SEG_X = hafif ? 132 : 320;
    const SEG_Y = hafif ? 84 : 200;
    const SM = hafif ? 512 : 1024;
    const NTAP = hafif ? 4 : 12;

    const sahne = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(
      FOV,
      Math.max(kap.clientWidth / Math.max(kap.clientHeight, 1), 0.01),
      0.1,
      120,
    );

    // WebGL context'i OLMAYABİLİR: GPU blocklist, sanal makine, --disable-gpu,
    // eski donanım. three bu durumda constructor'da throw ediyor; useEffect
    // içinde atılan hata React ağacını yukarı doğru çökertir → error boundary
    // devreye girer ve kullanıcı hero'nun tamamını (metin dahil) kaybeder.
    // Tarayıcıda bizzat görüldü: canvas yok + <body> tamamen boş.
    // Sahne süs, metin değil: WebGL yoksa sessizce çekiliyoruz ve CSS'teki
    // kâğıt zemini (#e8f1f2) + multiply mürekkep olduğu gibi kalıyor.
    let cizer: THREE.WebGLRenderer;
    try {
      cizer = new THREE.WebGLRenderer({
        antialias: !hafif,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap
    cizer.setSize(kap.clientWidth, kap.clientHeight);
    kap.appendChild(cizer.domElement);

    // ---- Gölge haritası (elle) — kalkan kanadın metne düşen gerçek gölgesi ---
    const golgeRT = new THREE.WebGLRenderTarget(SM, SM);
    golgeRT.texture.minFilter = THREE.NearestFilter;
    golgeRT.texture.magFilter = THREE.NearestFilter;
    // Derinlik dokusu sampler2D olarak okunuyor (karşılaştırma sampler'ı değil)
    // → NEAREST zorunlu; yumuşatmayı PCF kendisi yapıyor.
    const golgeDoku = new THREE.DepthTexture(SM, SM);
    golgeDoku.type = THREE.UnsignedIntType;
    golgeRT.depthTexture = golgeDoku;

    const isikKam = new THREE.OrthographicCamera(-12, 12, 12, -12, 0.1, 60);

    const fiber = fiberDokusu(256);

    // ---- Paylaşılan uniform'lar: kâğıt ve derinlik materyali AYNI nesneyi
    //      kullanıyor, yoksa gölge deforme olmamış düz düzlemden hesaplanır.
    const uPaper = { value: new THREE.Vector2(18, 11) };
    const uFold = {
      value: Array.from({ length: NFOLD }, () => new THREE.Vector4(1, 0, 1e9, 0)),
    };
    const uFoldR = {
      value: Array.from({ length: NFOLD }, () => new THREE.Vector4(0.4, 0, 0, 0)),
    };
    const uCrease = {
      value: Array.from({ length: NCREASE }, () => new THREE.Vector4(1, 0, 1e9, 0)),
    };

    const ortakDefines = { NFOLD, NCREASE };

    const kagitMat = new THREE.ShaderMaterial({
      // glslVersion bilerek boş: three zaten `#version 300 es`'e çeviriyor ama
      // GLSL3 verilirse gl_FragColor define'ını kaldırıyor. Boş bırakınca hem
      // ES 3.00 (const dizi + dinamik index) hem eski yazım geçerli.
      defines: { ...ortakDefines, NTAP },
      vertexShader: kagitVertex,
      fragmentShader: kagitFragment,
      // Kâğıdın iki yüzü var — derin kat arka yüzü kameraya çeviriyor.
      side: THREE.DoubleSide,
      uniforms: {
        uPaper,
        uFold,
        uFoldR,
        uCrease,
        // sigma (genişlik) / genlik. Max eğim ≈ genlik*0.61/sigma.
        //  0.026/0.05 → 0.3 (17°): görünmez. Sayfa bomboş A4 gibiydi.
        //  0.058/0.05 → 0.7 (35°): görünür AMA ince+sert = kâğıt kırığı değil
        //    ÇİZİK. Ekranda tel kafes/kırık cam gibi durdu (render'da görüldü).
        //  0.030/0.09 → 0.2 (12°) ama İKİ KAT GENİŞ: kırık artık bir çizgi
        //    değil, yumuşak bir sırt. Yalayan ışık geniş sırtı yine yakalıyor
        //    (çünkü gölge uzunluğu eğime değil ışığın yatıklığına bağlı),
        //    ama yüzey kâğıt gibi duruyor.
        uCreaseShape: { value: new THREE.Vector2(0.09, 0.03) },
        uCam: { value: new THREE.Vector3() },
        uLight: { value: ISIK.clone() },
        uLightMat: { value: new THREE.Matrix4() },
        uShadow: { value: golgeDoku },
        uFiber: { value: fiber },
        uShadowTexel: { value: new THREE.Vector2(1 / SM, 1 / SM) },
        uFiberScale: { value: new THREE.Vector2(0.62, 0.62) },
        uFiberAmp: { value: 0.045 },
        // Cockle: gerçek kâğıt hiç düz değildir. Düşük frekanslı hafif
        // dalgalanma olmadan kanatlar tek renk üçgen gibi duruyor — ışığın
        // yüzeyde gezinmesi için tek gereken bu.
        uCockleScale: { value: new THREE.Vector2(0.055, 0.045) },
        uCockleAmp: { value: 0.07 },
        uShadowRadius: { value: 8 },
        uShadowBias: { value: 0.0008 },
        uShadowNB: { value: 0.06 },
        // Gölge dibi 0 değil: beyaz kâğıt gölgede de AYDINLIK kalır. Metin
        // gölgenin içine girse bile kontrast korunur — perde gerekmiyor.
        // 0.3 → 0.22: gölge artık gerçekten gölge. Düz kâğıt ~0.90, gölge ~0.55
        // luminans; #073f49 mürekkep (~0.06) ikisinde de rahat okunuyor.
        uShadowFloor: { value: 0.22 },
        uAlbedo: { value: new THREE.Color(0.94, 0.96, 0.96) },
        // Key GÜÇLÜ ve nötr, fill ZAYIF ve teal. Tersi (zayıf key + doygun
        // fill) bütün sayfayı cyan'a boyuyordu — reddedilen "şeker-cyan
        // duvar kağıdı" tam olarak bu. Hiyerarşi renkten değil: kâğıt beyaz,
        // sadece GÖLGELERİ teal.
        // Işık yatıklaşınca (z 0.68→0.51) düz alanın key'i N·L = 0.51'e düştü;
        // kâğıdı beyaz tutmak için key'i 1.52 → 2.0 çıkarmak ZORUNLU.
        uKey: { value: new THREE.Color(2.0, 1.98, 1.9) },
        // Fill = markanın girdiği tek yer. Gölgede key sönüyor, geriye fill
        // kalıyor → gölgeler teal, ışık alan yüzeyler beyaz.
        // DİKKAT: yukarı bakan ters yüzlerde (derin kanadın sırtı) key=0 olduğu
        // için renk ≈ uSky + uBack'e düşüyor; uSky doygunsa orası düpedüz cyan
        // bir blok oluyor. Render'da sol kenarda görüldü. 0.22/0.27 → 0.16/0.19:
        // gölge hâlâ teal okunuyor, blok ise doygun cyan olmaktan çıkıyor.
        uSky: { value: new THREE.Color(0.055, 0.16, 0.19) },
        uGround: { value: new THREE.Color(0.018, 0.07, 0.095) },
        uRim: { value: new THREE.Color(0.03, 0.1, 0.13) },
        // Arkadan sızan ışık (kâğıt yarı geçirgen). Key sönen ters yüzlerde
        // GERİYE SADECE BU + fill kalıyor, yani doygunsa o yüzey saf cyan bir
        // leke oluyor: render'da sol üstte tam olarak reddedilen "şeker-cyan
        // duvar kağıdı" lekesi çıktı. Hem kıstım hem desatüre ettim — kâğıt
        // arkadan aydınlanınca KREM olur, turkuaz değil.
        uBack: { value: new THREE.Color(0.14, 0.17, 0.16) },
        uExp: { value: 1.0 },
        uGrain: { value: 0.012 },
        uTime: { value: 0 },
      },
    });

    const derinlikMat = new THREE.ShaderMaterial({
      defines: ortakDefines,
      vertexShader: kagitVertex,
      fragmentShader: derinlikFragment,
      uniforms: { uPaper, uFold, uFoldR },
      side: THREE.DoubleSide,
    });

    const geo = new THREE.PlaneGeometry(1, 1, SEG_X, SEG_Y);
    const kagit = new THREE.Mesh(geo, kagitMat);
    kagit.frustumCulled = false; // vertex shader deforme ediyor, bounding sphere yalan söyler
    sahne.add(kagit);

    const cerceve: Cerceve = { hw: 6, hh: 3.5, ghw: 3.2, ghh: 3.1, pw: 8, ph: 4.6, dikey: false };
    const katlar: Kat[] = [
      { ...yeniKat(0, 0), t0: -3 },
      { ...yeniKat(1, 0), t0: -11 },
      { ...yeniKat(2, 0), t0: -7 },
    ];
    const kirikler: (Kirik | null)[] = Array.from({ length: NCREASE }, () => null);

    // Ring buffer SADECE [NPERM, NCREASE) üstünde: kalıcı ağ ezilmemeli.
    const kirikYaz = (ang: number, d: number, t: number) => {
      let bi = NPERM;
      let bs = Infinity;
      for (let i = NPERM; i < NCREASE; i++) {
        const s = kirikGuc(kirikler[i], t);
        if (s < bs) {
          bs = s;
          bi = i;
        }
      }
      kirikler[bi] = { ang, d, t0: t };
    };

    const katlariYaz = (t: number) => {
      for (let i = 0; i < katlar.length; i++) {
        const k = katlar[i];
        const a = t - k.t0;
        const T1 = k.rise;
        const T2 = T1 + k.hold;
        const T3 = T2 + k.fall;

        let e = 0;
        if (a >= T1 && a < T2) e = 1;
        else if (a >= 0 && a < T1) e = smoother(a / T1);
        else if (a >= T2 && a < T3) e = 1 - smoother((a - T2) / k.fall);

        const d = katD(k, clamp(a / T3, 0, 1), cerceve);
        const ang = katAng(k, cerceve);
        // Ömür boyunca en riskli d (en içerideki) ile tavanı hesapla: açı
        // gezinirken metnin üstüne taşma ihtimali kalmasın.
        const th = katTheta(k, cerceve, Math.min(katD(k, 0, cerceve), katD(k, 1, cerceve)));

        // Kat açılırken kırık izini yaz: sayfa yaşadığını taşıyor.
        if (a >= T2 && !k.yazildi) {
          kirikYaz(ang, d, t);
          k.yazildi = true;
        }
        if (a >= T3) {
          katlar[i] = yeniKat(k.zone, t);
          continue;
        }
        uFold.value[i].set(Math.cos(ang), Math.sin(ang), d, th * e);
        uFoldR.value[i].set(k.R, 0, 0, 0);
      }
      // [0, NPERM) kalıcı ağ — boyutla() yazdı, dokunma.
      for (let i = NPERM; i < NCREASE; i++) {
        const c = kirikler[i];
        const s = kirikGuc(c, t);
        // Geçici izler sırt (−) yönünde: yeni açılan kat kalıcı ağın vadi/sırt
        // ritmine katılıyor, üstüne ayrı bir katman gibi binmiyor.
        if (c && s > 0) uCrease.value[i].set(Math.cos(c.ang), Math.sin(c.ang), c.d, -s);
        else uCrease.value[i].set(1, 0, 1e9, 0);
      }
    };

    /** reduced-motion BASE katman: hareket sonradan eklenen şey, tersi değil. */
    const statikKur = () => {
      // Tek dramatik poz: sol kanat yüksek (uzun gölge metnin üstünden geçer),
      // sağ kanat alçak (parlak sırt), bir de ortadan geçen sığ kat.
      const poz: [Kat["zone"], number, number, number][] = [
        [0, -0.17, 0.78, 1.95], // sol: derin kat — uzak kenar metne doğru geri yatıyor
        [1, 0.13, 0.26, 0.5], // sağ: sığ kat — ışık gören parlak sırt
        [2, 1.94, -0.12, 0.09], // ortadan geçen sığ kat
      ];
      poz.forEach(([zone, j, f, th], i) => {
        const k: Kat = { ...katlar[i], zone, j, f0: f, f1: f, th, R: zone === 2 ? 0.55 : 0.42 };
        const ang = katAng(k, cerceve);
        const d = katD(k, 0, cerceve);
        uFold.value[i].set(Math.cos(ang), Math.sin(ang), d, katTheta(k, cerceve, d));
        uFoldR.value[i].set(k.R, 0, 0, 0);
      });
      // Kalıcı ağın ÜSTÜNE birkaç geçici iz: statik karede de sayfanın
      // yaşanmışlığı görünsün. Ring buffer bloğuna yazılıyor ([NPERM, …)).
      const izler: [number, number][] = [
        [Math.PI - 0.3, 0.42],
        [0.22, 0.5],
        [1.7, -0.16],
        [2.5, 0.3],
      ];
      izler.forEach(([ang, f], i) => {
        if (NPERM + i >= NCREASE) return;
        uCrease.value[NPERM + i].set(
          Math.cos(ang),
          Math.sin(ang),
          f * destek(ang, cerceve.hw, cerceve.hh),
          -0.9,
        );
      });
    };

    // ---- Fare parallax: sadece pointer:fine, çok küçük -------------------
    const hedef = { x: 0, y: 0 };
    const yumusak = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedef.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedef.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !hafif) {
      window.addEventListener("pointermove", fareOynat, { passive: true });
    }

    let mesafe = BASE_DIST;

    const boyutla = () => {
      const w = kap.clientWidth;
      const h = kap.clientHeight;
      if (!w || !h) return;
      const aspect = w / h;
      const tanY = Math.tan((FOV * Math.PI) / 360);

      // Dar portrede kompozisyon ezilmesin: minimum görünür genişliği koru.
      mesafe = Math.max(BASE_DIST, MIN_VIS_W / (2 * tanY * aspect));
      const visH = 2 * mesafe * tanY;
      const visW = visH * aspect;

      // Güvenli dikdörtgen = mürekkebin kapladığı alan. Katlar buraya asla
      // giremez; CSS'teki sütun genişliğiyle bilerek aynı orana bağlı.
      cerceve.hw = visW / 2;
      cerceve.hh = visH / 2;
      cerceve.dikey = aspect < 0.95;
      cerceve.ghw = visW * (cerceve.dikey ? 0.45 : 0.26);
      cerceve.ghh = visH * (cerceve.dikey ? 0.3 : 0.44);

      // Sayfa çerçeveden %32 büyük. Düzken dış kenar kadraj dışında (ekranı
      // aşan tek büyük sayfa), ama kanat KISA kalıyor — derin kat sayfanın
      // uzak kenarını merkeze doğru geri yatırabilsin diye. %50'de kanat
      // devasa oluyor ve kalkınca kadrajı yiyor.
      uPaper.value.set(visW * 1.32, visH * 1.32);
      cerceve.pw = uPaper.value.x / 2;
      cerceve.ph = uPaper.value.y / 2;

      const r = 0.5 * Math.hypot(uPaper.value.x, uPaper.value.y) + 1.5;
      isikKam.left = -r;
      isikKam.right = r;
      isikKam.top = r;
      isikKam.bottom = -r;
      isikKam.near = 0.1;
      isikKam.far = 4 * r;
      isikKam.position.copy(ISIK).multiplyScalar(2 * r);
      isikKam.lookAt(0, 0, 0);
      isikKam.updateProjectionMatrix();
      isikKam.updateMatrixWorld();
      kagitMat.uniforms.uLightMat.value.multiplyMatrices(
        isikKam.projectionMatrix,
        isikKam.matrixWorldInverse,
      );

      kamera.aspect = aspect;
      kamera.updateProjectionMatrix();
      cizer.setSize(w, h);

      // Kalıcı ağ sayfa ölçüsüne bağlı → uPaper kesinleştikten SONRA kurulmalı.
      kalicAg(cerceve, uCrease.value);

      // statikKur() eskiden boyutla()'dan ÖNCE çağrılıyordu: katları hardcoded
      // varsayılan çerçeveye (hw:6, hh:3.5 …) göre hesaplayıp bırakıyordu,
      // sonra boyutla() çerçeveyi gerçek viewport'la değiştiriyor ama katları
      // yeniden hesaplamıyordu. Yani reduced-motion'da tek statik kare YANLIŞ
      // çerçeveye göre kuruluyordu (kat metnin üstüne düşebilir ya da kadraj
      // dışında kalabilirdi) ve resize'da hiç güncellenmiyordu.
      if (statik) {
        statikKur();
        kare(0);
      }
    };

    const kare = (t: number) => {
      kamera.position.set(0.85 + yumusak.x * 0.25, -1.15 - yumusak.y * 0.2, mesafe);
      kamera.lookAt(0, LOOK_Y, 0);
      kagitMat.uniforms.uCam.value.copy(kamera.position);
      kagitMat.uniforms.uTime.value = t;

      // 1) Işıktan derinlik → 2) kamera. Aynı uniform'lar, aynı deformasyon.
      sahne.overrideMaterial = derinlikMat;
      cizer.setRenderTarget(golgeRT);
      cizer.clear();
      cizer.render(sahne, isikKam);
      sahne.overrideMaterial = null;
      cizer.setRenderTarget(null);
      cizer.render(sahne, kamera);
    };

    let id = 0;
    let gorunur = false;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const ciz = () => {
      const t = saat.getElapsedTime();
      yumusak.x += (hedef.x - yumusak.x) * 0.03;
      yumusak.y += (hedef.y - yumusak.y) * 0.03;
      katlariYaz(t);
      kare(t);
      id = requestAnimationFrame(ciz);
    };

    const basla = () => {
      if (calisiyor || statik) return;
      calisiyor = true;
      id = requestAnimationFrame(ciz);
    };
    const dur = () => {
      calisiyor = false;
      cancelAnimationFrame(id);
    };

    boyutla(); // kalıcı ağı + (statikse) statik pozu gerçek çerçeveye göre kurar

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

    const ro = new ResizeObserver(boyutla);
    ro.observe(kap);

    return () => {
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", fareOynat);
      geo.dispose();
      kagitMat.dispose();
      derinlikMat.dispose();
      fiber?.dispose();
      golgeDoku.dispose();
      golgeRT.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return (
    <div ref={kapRef} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />
  );
}

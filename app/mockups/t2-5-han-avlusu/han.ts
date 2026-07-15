/*
 * HAN AVLUSU — ortak sabitler, mimari ölçüler, prosedürel doku ve dalga alanı.
 *
 * Buradaki her şey hem CPU (etiket ışığı) hem GPU (shader) tarafında aynı
 * matematikle çalışır: dalga ikizi TS + GLSL olarak iki kez yazılıdır.
 */

import * as THREE from "three";

/* ══ PALET ═══════════════════════════════════════════════════════════════
 * Tek hue ailesi. Sıcak hiçbir değer yok: fener sarı olamayacağı için
 * SICAKLIK TAMAMEN KESİLDİ — taşın albedosu koyu teal, ışığın rengi soğuk
 * beyaz. "Gece" hissi renk sıcaklığından değil, DEĞERDEN geliyor: avlu tabanı
 * altı metre aşağıda ve sisin dibinde.
 * En koyu değer #073F49 civarı — saf siyah yok (hemisphere'in yer rengi taban).
 */
export const PALET = {
  // Albedo NEDEN daha açık: eskiden #1b555f idi ve ışığın rengiyle aynı hue
  // ailesindeydi. Koyu+doygun albedo × koyu+doygun ışık = kanal ÇARPIMI sıfıra
  // gidiyordu; ölçülen sonuç rgb(0,0,5) — yani SAF SİYAH, palet kilidinin tam
  // ihlali. Teal ışıktan gelmeli, taştan değil: taş açılıp bir tık nötrleşti,
  // sahnenin rengi hemisphere + fener + dalgadan geliyor.
  tas: "#2e6f78", // çeper taşı albedosu
  zemin: "#164a55", // avlu tabanı — çeperden bilinçli daha koyu (metnin zemini)
  sis: "#0a3841", // yükseklik sisinin rengi = arka planın dibi
  gokUst: "#14515e", // saçağın üstünde kalan gökyüzü şeridi
  gokIsik: "#a4d7e3", // hemisphere: açık avludan düşen soğuk gök ışığı
  // Yerden dönen ışık. #073f49 DENENDİ VE BOZUKTU: bounce diye anılıyordu ama
  // fiziksel olarak bounce değildi — aşağı bakan her yüz (saçak altı, korkuluk)
  // siyaha çöküyordu. Islak, gök ışığı alan avlu tabanı gerçekte bu kadar ışık
  // döndürür. Palet tabanı (#073F49) artık bir RENK değil, ölçülen ALT SINIR.
  yerIsik: "#2c7d84",
  fener: "#dff4fb", // fenerin ışığı: soğuk beyaz
  fenerCam: "#8fe3f2",
  dalga: "#6fe0f0", // gözleri sırayla yıkayan ışık
} as const;

/* ══ MİMARİ (metre) ══════════════════════════════════════════════════════
 * Avlu dikdörtgeni: kemer cepheleri x=±14, z=±12.
 * Üst kat galerisi avluya 1.6 m taşar (cantilever) — kamera o taşmanın
 * köşesinde, korkuluğun başında durur. Böylece kamera avluda "uçmaz",
 * gerçekten galerinin üstündedir; ve avlu dikdörtgeninin YAKIN iki kenarı
 * kadrajın altından kesilir → dikdörtgen asla kapanmaz.
 */
export const AVLU_X = 14;
export const AVLU_Z = 12;
export const DUVAR_KAL = 0.55;
export const OYUK_DER = 3.2;

export const ZEMIN_BOY = 5.0; // zemin kat kemer duvarı boyu
export const GALERI_Y = 5.2; // üst kat döşemesi
export const UST_BOY = 4.4;
export const SACAK_Y = GALERI_Y + UST_BOY + 0.3; // 9.9
export const TASMA = 1.6;
export const KORKULUK_Y = 1.05;
export const KORKULUK_KAL = 0.3;

// kemer gözü profili (yerel): sivri kemer — han/kervansaray dili.
export const GOZ_GEN = 4.0;
export const GOZ_ACIK = 2.9;
export const Z_AYAK = 2.6; // zemin kat kemer omuzu
export const Z_TEPE = 4.35; // zemin kat kemer tepesi
export const U_AYAK = 2.3;
export const U_TEPE = 3.85;

/* Kamera: köşe taşmasında, korkuluğa yaslanmış göz hizası.
 * 6.9 − 0 = 6.9 m: metnin ALTINDA tam olarak bu kadar karanlık taş var.
 *
 * x=13.2 (tam köşe) DENENDİ VE BOZUKTU: o kadar oblik bir bakışta sağ kanat
 * kadrajın dörtte birini kaplayan, ışık almayan, palet dışı bir kara kama
 * oluyordu; ve uzak kanat kısalıp 7 gözün son üçü mimarinin BİTTİĞİ yere
 * düşüyordu — etiketler mimariden koparak boşlukta asılı kalıyordu.
 * x=7.5: hâlâ köşedeyiz (korkuluk köşesi ve babası ön planda), ama uzak kanat
 * kadrajı taşıyor ve 7 göz de gerçekten gözlerin üstünde duruyor.
 *
 * z: güverte z ∈ [10.4, 12] arası; 11.0'de kamera korkuluğun neredeyse
 * ÜSTÜNDE duruyordu ve korkuluk frustum'un altına düşüp tamamen kayboluyordu —
 * yani planın "yakın parallaks katmanı" hiç yoktu. 11.4 onu 1 m öne alıyor:
 * kadrajın alt bandına giriyor, CTA'nın altında kalıyor. */
export const KAMERA = { x: 7.5, y: 6.85, z: 11.4 } as const;
export const BAKIS = { x: -1.5, y: 1.4, z: -11.0 } as const;

/* Fener: uzak köşede, ALÇAKTA (y=3.15) ve taşmanın altında. Işığı zemine
 * yayılmıyor çünkü decay=2 ile hızla ölüyor; yaptığı iş köşedeki gözlerin
 * derinliğini yıkamak. Kadrajın en uzak ve en derin parlak notası. */
export const FENER = { x: -12.9, y: 3.15, z: -10.9 } as const;

const UZUN_X = [-12, -8, -4, 0, 4, 8, 12] as const; // z-kanatları: 7 göz
const UZUN_Z = [-10, -6, -2, 2, 6, 10] as const; // x-kanatları: 6 göz

/* Kanat başına dalga faz kayması. Dalga her kanatta KENDİ ekseninde ilerler;
 * kanatlar birbirine bağlanmaz. Neden: avlu çeperinde dolanan tek bir ışık
 * = yasaklı halka/yörünge okumasının dikdörtgen versiyonu olurdu. */
const KANAT_KAY = [0.0, 0.43, 0.79, 0.21] as const;

export type Goz = {
  x: number;
  y: number;
  z: number;
  ry: number;
  s: number;
  kat: number;
};

/** 4 kanat × 2 kat = 48 göz. Hepsi tek InstancedMesh. */
export function gozListesi(): Goz[] {
  const out: Goz[] = [];
  for (let kat = 0; kat < 2; kat++) {
    const y = kat === 0 ? 0 : GALERI_Y;
    for (const x of UZUN_X) {
      out.push({ x, y, z: -AVLU_Z, ry: 0, s: (x + 14) / 24 + KANAT_KAY[0], kat });
      out.push({ x, y, z: AVLU_Z, ry: Math.PI, s: (14 - x) / 24 + KANAT_KAY[3], kat });
    }
    for (const z of UZUN_Z) {
      out.push({ x: -AVLU_X, y, z, ry: Math.PI / 2, s: (12 - z) / 24 + KANAT_KAY[1], kat });
      out.push({ x: AVLU_X, y, z, ry: -Math.PI / 2, s: (z + 12) / 24 + KANAT_KAY[2], kat });
    }
  }
  return out;
}

/* Disiplin adları YALNIZCA uzak kanadın üst kat gözlerine, sırayla.
 * 7 göz = 7 disiplin: rakam zorlanmadı, kanat uzunluğu (28 m / 4 m aralık)
 * zaten 7 veriyor. Çember dizilimi değil — tek doğru üzerinde bir liste. */
export function etiketNoktalari() {
  return UZUN_X.map((x, i) => ({
    x,
    y: GALERI_Y + 1.95,
    z: -AVLU_Z + 0.05,
    s: (x + 14) / 24 + KANAT_KAY[0],
    sira: i,
  }));
}

/* ══ DALGA ═══════════════════════════════════════════════════════════════
 * Işık gözlerde DURMUYOR, aralarından geçiyor: iki farklı frekansta ilerleyen
 * sinüs. Baş/kuyruk yok, sıfırlanma anı yok → döngü görünmüyor.
 * s birimi ≈ metre/24, yani dalga boyu ~25 m: kanat başına kabaca tek kabarma.
 */
export const DALGA_GLSL = /* glsl */ `
  float hanDalgasi(float s, float t) {
    float a = sin(s * 6.0 - t * 0.62);
    float b = sin(s * 2.7 + t * 0.29 + 1.7) * 0.45;
    return smoothstep(0.15, 0.95, a + b);
  }
`;

function yumusakBasamak(a: number, b: number, x: number) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/** GLSL ikizi — etiket ışığı için CPU tarafında birebir aynı alan. */
export function hanDalgasi(s: number, t: number) {
  const a = Math.sin(s * 6.0 - t * 0.62);
  const b = Math.sin(s * 2.7 + t * 0.29 + 1.7) * 0.45;
  return yumusakBasamak(0.15, 0.95, a + b);
}

/* ══ PROSEDÜREL DOKU ═════════════════════════════════════════════════════
 * Doku dosyası YOK. Değer gürültüsü + derz (moloz taş sıra) → yükseklik alanı
 * → merkezi farkla normal haritası. Aynı alandan pürüzlülük haritası.
 */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sarmalanabilir (tileable) değer gürültüsü. */
function degerGurultu(boy: number, hucre: number, tohum: number) {
  const rnd = mulberry32(tohum);
  const g = new Float32Array(hucre * hucre);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const out = new Float32Array(boy * boy);
  for (let y = 0; y < boy; y++) {
    const fy = (y / boy) * hucre;
    const y0 = Math.floor(fy) % hucre;
    const y1 = (y0 + 1) % hucre;
    const ty = fy - Math.floor(fy);
    const sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < boy; x++) {
      const fx = (x / boy) * hucre;
      const x0 = Math.floor(fx) % hucre;
      const x1 = (x0 + 1) % hucre;
      const tx = fx - Math.floor(fx);
      const sx = tx * tx * (3 - 2 * tx);
      const a = g[y0 * hucre + x0] * (1 - sx) + g[y0 * hucre + x1] * sx;
      const b = g[y1 * hucre + x0] * (1 - sx) + g[y1 * hucre + x1] * sx;
      out[y * boy + x] = a * (1 - sy) + b * sy;
    }
  }
  return out;
}

const DOKU_BOY = 256;

function yukseklikAlani() {
  const n1 = degerGurultu(DOKU_BOY, 8, 1301);
  const n2 = degerGurultu(DOKU_BOY, 19, 5507);
  const n3 = degerGurultu(DOKU_BOY, 47, 9109);
  const h = new Float32Array(DOKU_BOY * DOKU_BOY);
  const KURS = 6; // yatay taş sırası
  const BLOK = 4; // sıra başına blok
  for (let y = 0; y < DOKU_BOY; y++) {
    const v = y / DOKU_BOY;
    const kurs = Math.floor(v * KURS);
    const kayma = (kurs % 2) * 0.5; // şaşırtmalı örgü
    const by = v * KURS - kurs;
    for (let x = 0; x < DOKU_BOY; x++) {
      const i = y * DOKU_BOY + x;
      const u = x / DOKU_BOY;
      const bxRaw = u * BLOK + kayma;
      const bx = bxRaw - Math.floor(bxRaw);
      const derz = Math.min(
        yumusakBasamak(0, 0.045, bx),
        yumusakBasamak(0, 0.045, 1 - bx),
        yumusakBasamak(0, 0.055, by),
        yumusakBasamak(0, 0.055, 1 - by),
      );
      const gren = n1[i] * 0.5 + n2[i] * 0.32 + n3[i] * 0.18;
      h[i] = gren * 0.42 + derz * 0.58;
    }
  }
  return h;
}

export type TasDokulari = { normal: THREE.Texture; puruz: THREE.Texture };

export function tasDokulari(): TasDokulari {
  const h = yukseklikAlani();
  const B = DOKU_BOY;
  const at = (x: number, y: number) => h[((y + B) % B) * B + ((x + B) % B)];

  const nBuf = new Uint8Array(B * B * 4);
  const pBuf = new Uint8Array(B * B * 4);
  const GUC = 3.4;
  for (let y = 0; y < B; y++) {
    for (let x = 0; x < B; x++) {
      const i = (y * B + x) * 4;
      const dx = (at(x + 1, y) - at(x - 1, y)) * GUC;
      const dy = (at(x, y + 1) - at(x, y - 1)) * GUC;
      const len = Math.hypot(dx, dy, 1);
      nBuf[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      nBuf[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      nBuf[i + 2] = (1 / len) * 0.5 * 255 + 127.5;
      nBuf[i + 3] = 255;
      // derz ve gren çukurları daha pürüzlü: ıslak taşın parlaklığı
      // düzlüklerde toplanıyor. Planar reflection yok — gerek de yok.
      const p = 0.52 + (1 - h[y * B + x]) * 0.44;
      const v = Math.min(p, 1) * 255;
      pBuf[i] = v;
      pBuf[i + 1] = v;
      pBuf[i + 2] = v;
      pBuf[i + 3] = 255;
    }
  }

  const yap = (buf: Uint8Array) => {
    const t = new THREE.DataTexture(buf, B, B, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace; // ham veri — sRGB dönüşümü YOK
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  };
  return { normal: yap(nBuf), puruz: yap(pBuf) };
}

/** Saçağın üstünde kalan gök şeridi. Düz renk değil ki kadraj bandı gibi durmasın. */
export function arkaPlanDokusu() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, PALET.gokUst);
  g.addColorStop(0.55, PALET.sis);
  g.addColorStop(1, "#072f38");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ══ GEOMETRİ ════════════════════════════════════════════════════════════ */

/** Sivri kemerli göz duvarı. Yerel +z = avlu yönü; duvar z ∈ [-kal, 0]. */
export function gozGeometrisi(boy: number, ayak: number, tepe: number) {
  const s = new THREE.Shape();
  s.moveTo(-GOZ_GEN / 2, 0);
  s.lineTo(GOZ_GEN / 2, 0);
  s.lineTo(GOZ_GEN / 2, boy);
  s.lineTo(-GOZ_GEN / 2, boy);
  s.closePath();

  const a = GOZ_ACIK / 2;
  const d = new THREE.Path();
  d.moveTo(-a, 0);
  d.lineTo(-a, ayak);
  // İki yay tepede TEĞET KIRILARAK buluşuyor → sivri kemer. Yuvarlak kemer
  // Roma/kilise okur; han değil.
  d.quadraticCurveTo(-a, tepe * 0.94, 0, tepe);
  d.quadraticCurveTo(a, tepe * 0.94, a, ayak);
  d.lineTo(a, 0);
  d.closePath();
  s.holes.push(d);

  const g = new THREE.ExtrudeGeometry(s, {
    depth: DUVAR_KAL,
    bevelEnabled: false,
    curveSegments: 14,
  });
  g.rotateY(Math.PI); // ön yüz z=0'da ve +z'ye (avluya) baksın
  g.computeVertexNormals();
  return g;
}

/** Gözün ardındaki oyuk: BackSide kutu → içi olan gerçek bir hacim. */
export function oyukGeometrisi(tepe: number) {
  const g = new THREE.BoxGeometry(GOZ_ACIK, tepe, OYUK_DER);
  g.translate(0, tepe / 2, -DUVAR_KAL - OYUK_DER / 2);
  return g;
}

/** Moloz taş bloğunun hedef boyu (m). Doku bir tur attığında bu kadar yer kaplar. */
export const TAS_OLCEK = 1.15;

/*
 * BoxGeometry'nin UV'si her yüzde 0..1'dir — yüzün METRE cinsinden boyunu
 * bilmez. Doku tekrarını malzemede sabitlemek (repeat=1.6) bu yüzden ÇALIŞMAZ:
 * 24.8 m'lik korkulukta da, 0.5 m'lik babada da 1.6 tur atar. Korkulukta bu,
 * ~15 m'de bir taş sırası demek → kadrajın EN YAKIN nesnesi dokusuz, düz bir
 * siluet olarak okur (ölçülen: standart sapma 4.7 = olaysız).
 *
 * Çözüm: tekrarı malzemeden geometriye taşı. Her yüzü kendi metre boyuna göre
 * ölçekle → taş her yerde aynı fiziksel boyda. Malzemenin repeat'i (1,1) kalır.
 *
 * BoxGeometry yüz sırası sabittir: px, nx, py, ny, pz, nz — her biri 4 vertex.
 * Düzlem eksenleri: px/nx → (z,y) · py/ny → (x,z) · pz/nz → (x,y).
 */
export function kutuUV(g: THREE.BufferGeometry, en: number, boy: number, der: number) {
  const uv = g.getAttribute("uv");
  if (!uv) return g;
  const k = TAS_OLCEK;
  const yuzler: [number, number][] = [
    [der / k, boy / k], // px
    [der / k, boy / k], // nx
    [en / k, der / k], // py
    [en / k, der / k], // ny
    [en / k, boy / k], // pz
    [en / k, boy / k], // nz
  ];
  for (let yuz = 0; yuz < 6; yuz++) {
    const [su, sv] = yuzler[yuz];
    for (let i = yuz * 4; i < yuz * 4 + 4; i++) {
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
  }
  uv.needsUpdate = true;
  return g;
}

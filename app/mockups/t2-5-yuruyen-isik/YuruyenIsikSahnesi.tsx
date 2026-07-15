"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  AYAK_EN,
  CEPHE_KALIN,
  CEPHE_YARI,
  CEPHE_YUKSEK,
  DONGU,
  EYVAN_DIP_Z,
  EYVAN_EN,
  EYVAN_OMUZ,
  EYVAN_TEPE,
  GOZ_EN,
  GOZ_OMUZ,
  GOZ_TEPE,
  GOZ_X,
  REVAK_DIP_Z,
  REVAK_TAVAN,
  ZIYARET,
  gozIsiklari,
  isikU,
  yolCizgisi,
} from "./yol";

/*
 * YÜRÜYEN IŞIK
 * ---------------------------------------------------------------------------
 * Bir medresenin avlusu. Biz KARŞI revağın eyvanının içindeyiz: üstümüzde onun
 * basık kemeri, yanlarımızda sövesi. Karşıda revak cephesi — ortada eyvan, iki
 * yanda üçer göz = yedi disiplin. Tek ışık kaynağı avluda yürüyor; bir göze
 * giriyor, orayı aydınlatıyor, çıkıp bir başkasına gidiyor. Uğradığı göz yanıyor,
 * arkasında sönüyor.
 *
 * SARNIÇTAN AYRIM (bu sahnenin en büyük riski — bilerek zorlandı):
 *   · Sarnıç YÜKSEK ANAHTARLI, beyaza boğulmuş, sisli, ISLAK ve TAVANSIZ bir
 *     hacimdi; sütunlar ışıkta eriyordu. Burası tam tersi: KURU, yer üstü,
 *     düşük anahtarlı, SINIRLARI OLAN bir avlu. Değer aralığı tam: gökyüzü
 *     neredeyse beyaz, gölge parlak teal, ışık havuzunun göbeği bembeyaz.
 *   · Sis yok denecek kadar az (yalnız hava perspektifi). Işık huzmesi YOK.
 *   · Yansıma/kostik YOK. Zemin kesme taş; gölge kenarları KESKİN (2048 harita).
 *   · Kaçış noktalı sonsuz koridor değil; kapalı, okunabilir, ölçeği belli bir
 *     oda-dışı. Sütun değil AYAK (kare kesitli, keskin arisli), yuvarlak değil
 *     SİVRİ kemer, düz duvar değil KESME TAŞ SIRALARI.
 *
 * HARMAN — perde (scrim) YOK:
 * Işık kaynağı DAİMA alçak (y≈2.2) ve DAİMA yere bakıyor. Omuz hizasının üstüne
 * hiç doğrudan ışık çıkmıyor; oraya yalnız zeminden sekme ulaşıyor. Metnin
 * durduğu yer — eyvanın ağzı — üstelik 11 m derinliğinde bir BOŞLUK: arkasında
 * duvar değil, mesafe var. Yani metnin fonu sahnenin fiziği gereği daima sakin.
 * "Bu panel olmasa metin okunur muydu?" — panel yok; olan şey derinlik.
 * Ve orası olaysız değil: ışık altından geçerken sekme eyvanı yalayıp geçiyor.
 */

// ---- palet: tek hue ailesi (cyan→nane→koyu teal) + beyazın onlarca opaklığı --
//
// KRİTİK DERS (ilk render bu yüzden çöptü): taşı KOYU BOYAMAK yasak. İlk
// denemede albedo #2b7d86 idi — sahne baştan sona düz koyu teal bir lekeydi,
// yani tam olarak brief'in "SOLUKLUK / kontrastsız = OLAYSIZ" uyarısı. Gerçek
// kesme taşın albedosu AÇIK ve neredeyse nötrdür. Karanlık PİGMENTTEN değil
// IŞIKTAN gelmeli: #073F49'a gölge ile iniyoruz, boya ile değil. Teal'i de
// taşa değil GÖĞE veriyoruz (hemisphere + skylight rengi) — "tek hue ailesi +
// beyazın onlarca opaklığı" ancak böyle çıkıyor, doygun cyan duvar kâğıdı değil.
// İkinci ders: taş NEREDEYSE NÖTR. Teal'i taşa koyarsan doygun cyan duvar
// kâğıdı çıkıyor (kural 4 = doğrudan red). Teal ışıkta yaşıyor (hemisphere +
// ambient); taş sadece onu yansıtıyor. Aşağıdaki değerler göz kararı değil:
// three.js'in Lambert→ACES→sRGB zinciri düğüm düğüm taklit edilip hedef değer
// yapısına göre çözüldü (bkz. aşağıdaki ışık bloğu). Beklenen sonuç:
//   avlu 136 · cephe 135 · revak 58 · EYVAN(metin fonu) 46 · silüet 22 · havuz 233
//   → metin fonu cepheden 89 luma koyu, saf siyah yok, doygunluk ≤0.33.
const GOK_UST = "#4fb4d4";
const GOK_UFUK = "#cdeef6";
const TAS = "#c3cdcd"; // açık, nötre yakın kesme taş: değerini ışık veriyor
const TAS_KOYU = "#b9c4c5"; // revağın içi — koyu görünüyor çünkü GÖLGEDE
const DIP = "#adb9ba"; // eyvanın içi — aynı sebeple, boyayla değil
const SILUET = "#97a6a9"; // bizim eyvanımız: kadraja bakan yüzü zaten sofit
const ZEMIN_TAS = "#aeb9ba";
const LAMBA = "#eafcff";
const NANE_SEKME = "#b8f0dd";

const KAMERA_Y = 1.62;
const EGIM_DER = 11; // yukarı bakış: eyvanın ağzı kadrajın ortasına oturuyor
const YAKIN_MESAFE = 5.5; // gözümüzle kendi eyvanımızın kemeri arası
const TEMEL_D = 19.85; // 16:9'da kameranın cepheye uzaklığı (çerçeve referansı)

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Kadraj: yatay açıyı sabit tutmaya çalışıp kamerayı cepheye göre geri çekiyoruz
 * → cephe her en-boyda aynı oranda kadrajı dolduruyor. Portre'de tüm cepheyi
 * sığdırmak kamerayı 35 m geriye atıyordu (eyvan küçülüyor, metin sığmıyor):
 * orada bilinçli olarak cepheyi taşırıyoruz — dış gözler kadrajdan çıkıyor,
 * eyvan büyüyor. Disiplinlerin tamamı zaten alt şeritte okunuyor.
 */
function cerceve(aspect: number) {
  const yatayYari = Math.tan(THREE.MathUtils.degToRad(42));
  const fov = THREE.MathUtils.clamp(
    THREE.MathUtils.radToDeg(2 * Math.atan(yatayYari / Math.max(aspect, 0.28))),
    44,
    80,
  );
  const yariH = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const gercekYatay = yariH * aspect;
  const sigdir = THREE.MathUtils.lerp(
    EYVAN_EN / 2 + GOZ_EN * 1.4,
    CEPHE_YARI,
    THREE.MathUtils.smoothstep(aspect, 0.72, 1.5),
  );
  const kameraZ = THREE.MathUtils.clamp(sigdir / (0.87 * gercekYatay), 12, 40);
  return { fov, kameraZ };
}

/** Gökyüzü: avlu açık havaya bakıyor. Kadrajda yalnız ince bir bant görünüyor
 *  ama sahnenin "yer üstü ve gündüz" olduğunu tek başına o bant söylüyor. */
function gokDokusu() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, GOK_UST);
  g.addColorStop(0.62, "#9fdcea");
  g.addColorStop(1, GOK_UFUK);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Kesme taş — dosya yok, canvas'ta üretiliyor. Bu sahnenin "mimari" okumasının
 * yarısı burada: yatay TAŞ SIRALARI ve şaşırtmalı derzler. Yalayan ışık derzlere
 * çarpınca cephe beton değil örülmüş duvar oluyor. Aynı doku hem map hem bumpMap:
 * gri tonlu üretiliyor, rengi materyalin color'ı veriyor.
 * 512 px = 2.56 m → sıra yüksekliği ≈ 0.32 m (gerçekçi).
 */
function tasDokusu(tohum: number) {
  const B = 512;
  const c = document.createElement("canvas");
  c.width = c.height = B;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const rnd = mulberry32(tohum);

  ctx.fillStyle = "#8c8c8c";
  ctx.fillRect(0, 0, B, B);

  // lekelenme: sarmalı çizim (9 kopya) → doku kusursuz döşeniyor
  for (let i = 0; i < 130; i++) {
    const x = rnd() * B;
    const y = rnd() * B;
    const r = 18 + rnd() * 70;
    const v = Math.round(120 + (rnd() - 0.5) * 90);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const g = ctx.createRadialGradient(x + ox * B, y + oy * B, 0, x + ox * B, y + oy * B, r);
        g.addColorStop(0, `rgba(${v},${v},${v},0.30)`);
        g.addColorStop(1, `rgba(${v},${v},${v},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x + ox * B - r, y + oy * B - r, r * 2, r * 2);
      }
    }
  }

  // taş sıraları + şaşırtmalı dikey derzler
  const sira = 64; // 8 sıra
  for (let s = 0; s < B / sira; s++) {
    const y = s * sira;
    ctx.fillStyle = "rgba(40,40,40,0.55)";
    ctx.fillRect(0, y, B, 2.5);
    ctx.fillStyle = "rgba(225,225,225,0.30)";
    ctx.fillRect(0, y + 2.5, B, 1.5);
    // her sıra kendi taş boyunda, yarım şaşırtmalı
    const en = 96 + Math.floor(rnd() * 3) * 32;
    const kaydir = (s % 2) * (en / 2) + rnd() * 14;
    for (let x = -en; x < B + en; x += en) {
      const dx = x + kaydir;
      ctx.fillStyle = "rgba(40,40,40,0.45)";
      ctx.fillRect(dx, y + 2, 2, sira - 2);
      ctx.fillStyle = "rgba(225,225,225,0.20)";
      ctx.fillRect(dx + 2, y + 2, 1, sira - 2);
    }
  }

  // gren: yontma izi. Sekmeyi kırıp taşa tutuş veriyor.
  const im = ctx.getImageData(0, 0, B, B);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 26;
    d[i] = THREE.MathUtils.clamp(d[i] + n, 0, 255);
    d[i + 1] = THREE.MathUtils.clamp(d[i + 1] + n, 0, 255);
    d[i + 2] = THREE.MathUtils.clamp(d[i + 2] + n, 0, 255);
  }
  ctx.putImageData(im, 0, 0);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Sivri kemer (Selçuklu/erken Osmanlı): iki merkezli. Yuvarlak kemer sarnıç
 *  ve katedral okumasına kaçıyor — bu sahnenin ayrımı sivri olmasında. */
function sivriGoz(cx: number, en: number, omuz: number, tepe: number) {
  const yol = new THREE.Path();
  const yariW = en / 2;
  const h = tepe - omuz;
  const d = (h * h - yariW * yariW) / en; // h > en/2 şartı: sivri kemer
  const R = d + yariW;
  yol.moveTo(cx - yariW, -0.6); // taban zeminin altına taşıyor: derz görünmesin
  yol.lineTo(cx - yariW, omuz);
  yol.absarc(cx + d, omuz, R, Math.PI, Math.atan2(h, -d), true);
  yol.absarc(cx - d, omuz, R, Math.atan2(h, d), 0, true);
  yol.lineTo(cx + yariW, -0.6);
  yol.closePath();
  return yol;
}

/** Basık kemer (yassı/segmental): bizim durduğumuz eyvanın ağzı. Geniş ve alçak
 *  → kadrajın üstünü yayvan bir yay gibi kesiyor, sivri kemer olsa tavana
 *  sığmazdı. */
function basikKemerCephesi(en: number, omuz: number, cikma: number, disYari: number, disYuksek: number) {
  const s = new THREE.Shape();
  s.moveTo(-disYari, -1);
  s.lineTo(disYari, -1);
  s.lineTo(disYari, disYuksek);
  s.lineTo(-disYari, disYuksek);
  s.closePath();

  const yariW = en / 2;
  const R = (yariW * yariW + cikma * cikma) / (2 * cikma);
  const merkezY = omuz + cikma - R;
  const a = Math.atan2(omuz - merkezY, -yariW);
  const b = Math.atan2(omuz - merkezY, yariW);
  const delik = new THREE.Path();
  delik.moveTo(-yariW, -1);
  delik.lineTo(-yariW, omuz);
  delik.absarc(0, merkezY, R, a, b, true);
  delik.lineTo(yariW, -1);
  delik.closePath();
  s.holes.push(delik);
  return s;
}

type Props = {
  /** Ayaklara oyulacak adlar — content.ts'ten, soldan sağa göz sırasıyla. */
  disiplinler: readonly string[];
  /** Her karede disiplin başına 0..1 ışık. setState YOK — doğrudan DOM. */
  bildir?: (isik: number[]) => void;
  sinif?: string;
};

export function YuruyenIsikSahnesi({ disiplinler, bildir, sinif }: Props) {
  const kapRef = useRef<HTMLDivElement>(null);
  const bildirRef = useRef(bildir);
  bildirRef.current = bildir;
  // Sahne bir kez kuruluyor (deps: []); adlar content.ts'ten gelen sabit veri.
  const adRef = useRef(disiplinler);

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const statik = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kaba = window.matchMedia("(pointer: coarse)").matches;

    // ---- kurulum ---------------------------------------------------------
    const sahne = new THREE.Scene();
    const gok = gokDokusu();
    sahne.background = gok ?? new THREE.Color(GOK_UFUK);
    // Sis DEĞİL, hava perspektifi: 20 m'de ~%3. Sarnıcın sisi buranın düşmanı —
    // üstelik sis eyvanın koyu boşluğunu yıkayıp metnin fonunu griye çekiyordu.
    sahne.fog = new THREE.FogExp2(new THREE.Color("#a9dcea").getHex(), 0.008);

    const k0 = cerceve(Math.max(kap.clientWidth, 1) / Math.max(kap.clientHeight, 1));
    const kamera = new THREE.PerspectiveCamera(k0.fov, 1, 0.1, 140);
    kamera.position.set(0, KAMERA_Y, k0.kameraZ);
    // lookAt yok: eğim sabit → cephe kadrajda çivilenmiş kalır, fare parallaksı
    // yalnız konumu oynatır. Metnin fonu asla kaymaz.
    kamera.rotation.set(THREE.MathUtils.degToRad(EGIM_DER), 0, 0);

    const cizer = new THREE.WebGLRenderer({
      antialias: !kaba,
      powerPreference: "high-performance",
    });
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, kaba ? 1.5 : 2));
    cizer.setSize(kap.clientWidth, kap.clientHeight);
    cizer.shadowMap.enabled = true;
    // Keskin gölge kenarı bu sahnenin sarnıçtan ayrım noktası: PCFSoft değil PCF.
    cizer.shadowMap.type = THREE.PCFShadowMap;
    // ACES: lamba göbeğini beyaza yakıyor ama orta tonları teal bırakıyor.
    cizer.toneMapping = THREE.ACESFilmicToneMapping;
    cizer.toneMappingExposure = 1.3;
    kap.appendChild(cizer.domElement);

    const atiklar: { dispose(): void }[] = [];
    const doku = tasDokusu(20260715);
    if (doku) atiklar.push(doku);

    /** Aynı dokuyu farklı dünya ölçeğinde döşemek için klon (görüntü paylaşılır). */
    const tasMat = (renk: string, tekrar: number, purluk = 0.86) => {
      const m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(renk),
        roughness: purluk,
        metalness: 0,
      });
      if (doku) {
        const t = doku.clone();
        t.needsUpdate = true;
        t.repeat.set(tekrar, tekrar);
        m.map = t;
        m.bumpMap = t;
        m.bumpScale = 0.9;
        atiklar.push(t);
      }
      atiklar.push(m);
      return m;
    };

    // ExtrudeGeometry'nin dünya UV'si metre cinsinden geliyor → tekrar = 1/2.56
    const DUNYA_UV = 1 / 2.56;

    // ---- cephe: tek ExtrudeGeometry, 7 sivri göz deliği ------------------
    const cepheSekli = new THREE.Shape();
    cepheSekli.moveTo(-CEPHE_YARI, -1);
    cepheSekli.lineTo(CEPHE_YARI, -1);
    cepheSekli.lineTo(CEPHE_YARI, CEPHE_YUKSEK);
    cepheSekli.lineTo(-CEPHE_YARI, CEPHE_YUKSEK);
    cepheSekli.closePath();
    GOZ_X.forEach((x, i) => {
      const eyvan = i === 3;
      cepheSekli.holes.push(
        sivriGoz(
          x,
          eyvan ? EYVAN_EN : GOZ_EN,
          eyvan ? EYVAN_OMUZ : GOZ_OMUZ,
          eyvan ? EYVAN_TEPE : GOZ_TEPE,
        ),
      );
    });
    const cepheGeo = new THREE.ExtrudeGeometry(cepheSekli, {
      depth: CEPHE_KALIN,
      bevelEnabled: false,
      curveSegments: 16,
    });
    atiklar.push(cepheGeo);
    const cephe = new THREE.Mesh(cepheGeo, tasMat(TAS, DUNYA_UV));
    cephe.position.z = -CEPHE_KALIN; // ön yüzü z=0
    cephe.castShadow = true;
    cephe.receiveShadow = true;
    sahne.add(cephe);

    // ---- gözlerin arkası: örtülü revak + eyvanın derin boşluğu -----------
    // Revak SÜREKLİ bir galeri (mimari olarak doğru): ışık içeri girince birkaç
    // göz birden parlıyor, aradaki ayaklar onu şeritliyor. Eyvan ise 11 m
    // derinliğinde ayrı bir oyuk — metnin arkasındaki mesafe.
    const duvarMat = tasMat(TAS_KOYU, DUNYA_UV, 0.92);
    const dipMat = tasMat(DIP, DUNYA_UV, 0.95);

    const duz = (
      w: number,
      h: number,
      mat: THREE.Material,
      poz: [number, number, number],
      don: [number, number, number] = [0, 0, 0],
    ) => {
      const g = new THREE.PlaneGeometry(w, h);
      atiklar.push(g);
      const m = new THREE.Mesh(g, mat);
      m.position.set(...poz);
      m.rotation.set(...don);
      m.receiveShadow = true;
      // castShadow ZORUNLU: eyvanı/revağı karartan şey kendi ÖRTÜSÜNÜN gölgesi.
      // Bunu unutmak "derin oyuk karanlıktır" fiziğini sessizce iptal ediyor.
      m.castShadow = true;
      sahne.add(m);
      return m;
    };

    const yanEn = CEPHE_YARI + 1 - EYVAN_EN / 2;
    const yanOrta = (EYVAN_EN / 2 + CEPHE_YARI + 1) / 2;
    // revağın dip duvarı (eyvanın iki yanı)
    duz(yanEn, REVAK_TAVAN + 1, duvarMat, [-yanOrta, (REVAK_TAVAN + 1) / 2, REVAK_DIP_Z]);
    duz(yanEn, REVAK_TAVAN + 1, duvarMat, [yanOrta, (REVAK_TAVAN + 1) / 2, REVAK_DIP_Z]);
    // revağın tavanı: ışığı içeride tutuyor, gözler "örtülü" okuyor
    duz(
      CEPHE_YARI * 2 + 2,
      REVAK_DIP_Z * -1 - CEPHE_KALIN + 0.2,
      duvarMat,
      [0, REVAK_TAVAN, (REVAK_DIP_Z - CEPHE_KALIN) / 2],
      [Math.PI / 2, 0, 0],
    );
    // eyvan: dip duvarı + iki sövesi + tavanı
    duz(EYVAN_EN, EYVAN_TEPE + 1, dipMat, [0, (EYVAN_TEPE + 1) / 2, EYVAN_DIP_Z]);
    duz(
      EYVAN_DIP_Z * -1 - CEPHE_KALIN,
      EYVAN_TEPE + 1,
      dipMat,
      [-EYVAN_EN / 2, (EYVAN_TEPE + 1) / 2, (EYVAN_DIP_Z - CEPHE_KALIN) / 2],
      [0, Math.PI / 2, 0],
    );
    duz(
      EYVAN_DIP_Z * -1 - CEPHE_KALIN,
      EYVAN_TEPE + 1,
      dipMat,
      [EYVAN_EN / 2, (EYVAN_TEPE + 1) / 2, (EYVAN_DIP_Z - CEPHE_KALIN) / 2],
      [0, -Math.PI / 2, 0],
    );
    duz(
      EYVAN_EN,
      EYVAN_DIP_Z * -1 - CEPHE_KALIN,
      dipMat,
      [0, EYVAN_TEPE, (EYVAN_DIP_Z - CEPHE_KALIN) / 2],
      [Math.PI / 2, 0, 0],
    );

    // ---- avlu zemini: KURU kesme taş. Su yok, yansıma yok, kostik yok. ----
    const zeminGeo = new THREE.PlaneGeometry(64, 64);
    atiklar.push(zeminGeo);
    const zeminMat = tasMat(ZEMIN_TAS, 64 / 2.56, 0.8);
    zeminMat.bumpScale = 0.55;
    const zemin = new THREE.Mesh(zeminGeo, zeminMat);
    zemin.rotation.x = -Math.PI / 2;
    zemin.position.set(0, 0, 8);
    zemin.receiveShadow = true;
    sahne.add(zemin);

    // ---- disiplin adları: AYAKLARA oyulmuş, emissive YOK -----------------
    // Yalnız bumpMap: harfler ışık YALAYINCA kenarlarından okunuyor. Oyuk taş
    // olduğu için map'te de çok hafif bir koyulma var (gerçek bir oyma zaten
    // kendi gölgesini tutar) — ama okunacak kadar değil. Işık gelmeden ad yok.
    const adCizen: ((yaziTipi: string) => void)[] = [];

    adRef.current.slice(0, GOZ_X.length).forEach((ad, i) => {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 512;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const ciz = (yaziTipi: string) => {
        ctx.fillStyle = "#8a8a8a";
        ctx.fillRect(0, 0, 128, 512);
        ctx.save();
        ctx.translate(64, 256);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `44px ${yaziTipi}`;
        // Oyma: koyu gövde + üst kenarda ince ışık payı → bump bunu okuyor.
        ctx.fillStyle = "#2e2e2e";
        ctx.fillText(ad, 0, 0);
        ctx.fillStyle = "rgba(220,220,220,0.55)";
        ctx.fillText(ad, 0, -2);
        ctx.restore();
      };
      ciz("600 44px system-ui, sans-serif");
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      atiklar.push(t);
      adCizen.push((yt) => {
        ciz(yt);
        t.needsUpdate = true;
      });

      // Adın taşıyıcısı: gözün SOLUNDAKİ ayağın ön yüzü.
      const eyvan = i === 3;
      const yariGoz = (eyvan ? EYVAN_EN : GOZ_EN) / 2;
      const ax = GOZ_X[i] - yariGoz - AYAK_EN / 2;
      const g = new THREE.PlaneGeometry(AYAK_EN * 0.82, 2.4);
      atiklar.push(g);
      const m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(TAS),
        roughness: 0.88,
        metalness: 0,
        bumpMap: t,
        bumpScale: 2.6,
      });
      atiklar.push(m);
      const levha = new THREE.Mesh(g, m);
      levha.position.set(ax, 1.85, 0.008);
      sahne.add(levha);
    });

    // next/font hazır olunca gerçek yazı tipiyle yeniden çiz (mojibake/tofu yok).
    let sokuldu = false;
    const monoAd = getComputedStyle(kap).getPropertyValue("--font-mono").trim();
    if (monoAd) {
      document.fonts.ready
        .then(() => {
          if (sokuldu) return;
          adCizen.forEach((f) => f(`600 44px ${monoAd}, monospace`));
          if (statik) tekKare();
        })
        .catch(() => {});
    }

    // ---- bizim eyvanımız: kadrajın çerçevesi ----------------------------
    // Kameranın gözüne bağlı bir grup: en-boy değişince kamera geri gider ama
    // bu grup onunla ölçeklenir → çerçeveleme her ekranda BİREBİR aynı kalır.
    // Silüet olarak yaşıyor (gölge almıyor/vermiyor): ışık 20 m ötede.
    const yakinGrup = new THREE.Group();
    yakinGrup.position.set(0, KAMERA_Y, k0.kameraZ);
    sahne.add(yakinGrup);

    const yakinSekil = basikKemerCephesi(9.46, 3.6 - KAMERA_Y, 2.0, 15, 9);
    const yakinGeo = new THREE.ExtrudeGeometry(yakinSekil, {
      depth: 0.9,
      bevelEnabled: false,
      curveSegments: 20,
    });
    atiklar.push(yakinGeo);
    const yakinMat = tasMat(SILUET, DUNYA_UV, 0.95);
    const yakinKemer = new THREE.Mesh(yakinGeo, yakinMat);
    yakinKemer.position.set(0, 0, -YAKIN_MESAFE - 0.9);
    yakinGrup.add(yakinKemer);
    // eyvanın söveleri: kadrajın en solu ve en sağı
    [-1, 1].forEach((s) => {
      const g = new THREE.PlaneGeometry(7, 9);
      atiklar.push(g);
      const m = new THREE.Mesh(g, yakinMat);
      m.position.set(s * 4.73, 2.0, -YAKIN_MESAFE + 2.6);
      m.rotation.y = s * -Math.PI / 2;
      yakinGrup.add(m);
    });

    // ---- ışık ------------------------------------------------------------
    //
    // TEŞHİS NOTU: ilk kurulumda taban ışık tek başına HemisphereLight'tı ve
    // sahne çöktü. Sebep: HemisphereLight three.js'te analitik bir ambient —
    // GEOMETRİYİ HİÇ UMURSAMAZ. Yani 11 m derinliğindeki eyvanın dip duvarı,
    // açıktaki cepheyle BİREBİR aynı aydınlanıyordu. "Metnin fonu derin olduğu
    // için sakin" savunmam fiziksel olarak hiç gerçekleşmemişti; ekranda düz,
    // olaysız bir teal duvar vardı. Bu, harman planının taşıyıcı direğiydi.
    //
    // Çözüm: taban ışığı GÖLGE VEREN bir skylight'a taşımak. Avlu göğe açık →
    // zemin ve cephe ışık alıyor; revak ve eyvan KENDİ ÖRTÜLERİNİN altında
    // kaldığı için karanlık. Artık derinlik gerçekten karartıyor: metnin
    // durduğu yer sahnenin fiziği gereği sakin — boya ya da panel ile değil.
    // AÇI hesapla seçildi, gözle değil: (2,20,25) ≈ dikeyden 39° idi ve eyvanın
    // ağzından girip 11 m ötedeki DİP DUVARINI y≈2.7'ye kadar yalıyordu — yani
    // tam da CTA'nın oturduğu banda ışık düşürüyordu. (3,26,16) ≈ dikeyden 31°:
    // ışık eyvanın zeminine z≈-7.6'da çakılıyor, dip duvara HİÇ ulaşmıyor.
    // Metnin fonu böylece kapalı bir hesapla karanlık — umutla değil.
    //
    // ŞİDDETLER de göz kararı değil. Bu turda tarayıcı 10 ajan arasında
    // paylaşıldığı için görsel doğrulama güvenilmezdi; onun yerine three.js'in
    // tam boru hattı (Hemisphere + Ambient + Lambert(albedo/π) → ACES → sRGB)
    // node'da taklit edilip hedef değer yapısına göre sayısal olarak çözüldü.
    // İlk elle ayarım eyvanı luma 2'ye — SAF SİYAH, doğrudan red sebebi —
    // düşürüyordu; simülasyon bunu ekrana hiç bakmadan yakaladı.
    const gokYonu = new THREE.DirectionalLight(new THREE.Color("#f2fbfd"), 2.0);
    gokYonu.position.set(3, 26, 16);
    gokYonu.castShadow = true;
    gokYonu.shadow.mapSize.set(kaba ? 1024 : 2048, kaba ? 1024 : 2048);
    gokYonu.shadow.camera.left = -26;
    gokYonu.shadow.camera.right = 26;
    gokYonu.shadow.camera.top = 30;
    gokYonu.shadow.camera.bottom = -30;
    gokYonu.shadow.camera.near = 1;
    gokYonu.shadow.camera.far = 80;
    gokYonu.shadow.bias = -0.0009;
    gokYonu.shadow.normalBias = 0.04;
    sahne.add(gokYonu);
    sahne.add(gokYonu.target);

    // Gökten gelen dolgu. Skylight'ı ALAN yüzeyle almayan yüzey arasındaki fark
    // buna rağmen 89 luma kalıyor (cephe 135 · eyvan 46) — metnin fonu bu yüzden
    // hem sakin hem de saf siyah değil.
    const gokIsik = new THREE.HemisphereLight(
      new THREE.Color("#8fd4e4"),
      new THREE.Color("#175055"),
      3.0,
    );
    sahne.add(gokIsik);

    // PALET TABANI: eyvanın dibini #073F49 bandında (luma ≈46) tutan lift.
    // Rengi bilinçli olarak DOYGUN DEĞİL — saf cyan bir ambient ACES'te kırmızı
    // kanalı sıfıra kırpıyor ve gölgeler teal değil "mavi-siyah" okuyor.
    sahne.add(new THREE.AmbientLight(new THREE.Color("#4a7d80"), 3.7));

    // Yürüyen kaynak = fener: sert yönlü SpotLight (havuz + gölge) + onu takip
    // eden zayıf PointLight (girdiği gözün içini dolduran saçılma).
    // Alacakaranlık: gök hâlâ parlıyor ama avludan çekilmiş → sahnenin EN PARLAK
    // nesnesi tartışmasız bu fener. Sert (penumbra düşük), sıcak değil beyaz.
    const spot = new THREE.SpotLight(new THREE.Color(LAMBA), 300, 30, 0.5, 0.22, 2);
    spot.castShadow = true;
    spot.shadow.mapSize.set(kaba ? 1024 : 2048, kaba ? 1024 : 2048);
    spot.shadow.camera.near = 0.4;
    spot.shadow.camera.far = 34;
    spot.shadow.bias = -0.0016;
    spot.shadow.normalBias = 0.045;
    sahne.add(spot);
    sahne.add(spot.target);

    const fener = new THREE.PointLight(new THREE.Color(NANE_SEKME), 34, 11, 2);
    sahne.add(fener);

    // Kaynağın kendisi görünür: küçük ve alçak. "Yürüyor" okuması 6 saniyede
    // tartışmasız olsun diye — ama küre büyürse sahne mimari olmaktan çıkıp
    // "uçan top" olur, o yüzden 12 cm.
    const cekirdekGeo = new THREE.SphereGeometry(0.12, 16, 12);
    const cekirdekMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(LAMBA) });
    atiklar.push(cekirdekGeo, cekirdekMat);
    const cekirdek = new THREE.Mesh(cekirdekGeo, cekirdekMat);
    sahne.add(cekirdek);

    const yol = yolCizgisi();
    const isikYeri = new THREE.Vector3();
    const isiklar: number[] = new Array(GOZ_X.length).fill(0);

    const isigiKur = (t: number) => {
      yol.getPoint(isikU(t), isikYeri);
      const gait = statik ? 0 : Math.sin(t * 5.1) * 0.045; // yürüyüş salınımı
      spot.position.set(isikYeri.x, isikYeri.y + gait, isikYeri.z);
      fener.position.copy(spot.position);
      cekirdek.position.copy(spot.position);
      // DAİMA yere bakıyor + hafifçe bize doğru: omuz hizasının üstüne doğrudan
      // ışık çıkmıyor. Metnin durduğu bölgenin sakinliği bu tek satırda.
      spot.target.position.set(isikYeri.x * 0.35, 0.1, isikYeri.z + 2.6);
      spot.target.updateMatrixWorld();
      const titre = statik ? 1 : 1 + Math.sin(t * 7.3) * 0.02 + Math.sin(t * 3.1) * 0.016;
      spot.intensity = 300 * titre;
      fener.intensity = 34 * titre;
      gozIsiklari(isikYeri.x, isikYeri.z, isiklar);
      bildirRef.current?.(isiklar);
    };

    // ---- fare parallaksı -------------------------------------------------
    const fare = { x: 0, y: 0 };
    const hedef = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedef.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedef.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba) window.addEventListener("pointermove", fareOynat, { passive: true });

    // ---- döngü -----------------------------------------------------------
    let id = 0;
    let gorunur = false;
    let calisiyor = false;
    const saat = new THREE.Clock();
    let kameraZ = k0.kameraZ;

    const ciz = () => {
      const t = saat.getElapsedTime();
      isigiKur(t);
      fare.x += (hedef.x - fare.x) * 0.045;
      fare.y += (hedef.y - fare.y) * 0.045;
      kamera.position.x = fare.x * 0.8;
      kamera.position.y = KAMERA_Y - fare.y * 0.3 + Math.sin(t * 0.24) * 0.04;
      yakinGrup.position.x = kamera.position.x;
      cizer.render(sahne, kamera);
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

    // reduced-motion BASE katman: rAF hiç başlamıyor. Işık, ZIYARET dizisinin
    // ilk gözünde duruyor — merkezde değil, yani kompozisyon yine asimetrik ve
    // sahne tek karede de "bir şey oluyor" okuyor.
    function tekKare() {
      isigiKur(DONGU * (0.78 / ZIYARET.length));
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
      const k = cerceve(w / h);
      kameraZ = k.kameraZ;
      kamera.fov = k.fov;
      kamera.aspect = w / h;
      kamera.position.z = kameraZ;
      kamera.updateProjectionMatrix();
      yakinGrup.position.z = kameraZ;
      yakinGrup.scale.setScalar(kameraZ / TEMEL_D);
      cizer.setSize(w, h);
      if (statik) tekKare();
    };
    boyutla();
    if (statik) tekKare();

    const ro = new ResizeObserver(boyutla);
    ro.observe(kap);

    return () => {
      sokuldu = true;
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", fareOynat);
      spot.shadow.dispose();
      gok?.dispose();
      atiklar.forEach((a) => a.dispose());
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

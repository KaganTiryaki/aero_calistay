"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  COOKIE_FRAGMENT,
  COOKIE_VERTEX,
  DERINLIK,
  DURGUN_T,
  EN_YARI,
  KABURGA_SAYI,
  TABLA_Y,
  TEL_SAYI,
  Z_BOLUM,
  Z_BOYUN,
  Z_KUYRUK,
  kesit,
  telGenlikleri,
  zdenS,
} from "./ses";

/*
 * SES GÖVDESİ
 * ---------------------------------------------------------------------------
 * Kamera bir udun rezonans gövdesinin İÇİNDE, mimari ölçekte. Yukarıda ses
 * tablası (tavan), altta ve iki yanda kaburgalar (tekne) boyuna doğru
 * daralarak bir apsise kapanıyor. Tek ışık kadraj DIŞINDAKİ gülden (rozet)
 * geliyor: çember hiç görünmüyor, yalnız döktüğü dantel.
 *
 * Fikir: tek bir tel duyulmaz, onu duyulur kılan gövdedir. Sayfa ekip
 * başvurusu topluyor — birey topluluk içinde duyulur hâle gelir.
 *
 * OKUNABİLİRLİK (reddedilen beyaz perdenin tam tersi):
 *   Metin, tablanın altındaki dev gergi kirişinin tekneye düşürdüğü gölgede
 *   duruyor. Bu bir panel DEĞİL çünkü (a) kirişin kendisi kadrajda görünüyor,
 *   (b) gölge teknenin eğri yüzeyinde büküldüğü için düz kenarlı değil,
 *   (c) kenarları penumbralı. "Bu katman olmasa metin okunur muydu?" → gölge
 *   zaten orada, çünkü kirişi görüyorsun.
 *
 * Yasaklı motiflere karşı: halka/yörünge yok (gül kadraj dışında), god-ray
 * yok, kaustik yok, tel-kafes küre yok, sıcak/bej yok, saf siyah yok
 * (en koyu değer sis rengi #08424E'de tabanlanıyor).
 */

// ---- palet (tek hue ailesi: teal→cyan + beyazın onlarca opaklığı) ---------
const SIS = 0x08424e; // gövdenin havası; sahnenin EN KOYU değeri

/*
 * PALET — rengi ALBEDO değil IŞIK taşıyor.
 *
 * İlk iki denemede ahşabı doygun teal boyadım (#1f5b60 → #235f68). İkisi de
 * battı: doygun teal albedo × teal ışık, kırmızı kanalı sıfıra yakın tuttuğu
 * için dantelin çekirdeği #6FE0F0'a ASLA çıkamıyordu (ölçüldü: R:G ≈ 0.04
 * olması gereken 0.18 yerine) — sahne ya yeşile kaçtı ya simsiyah kaldı.
 *
 * Tek ışıklı bir sahnede doğru olan: albedo DOYGUNSUZ, mavi-gri bir değer
 * olsun; teal→cyan hue'yu ışık ve ortam versin. Aydınlanan yüz ışığın rengine
 * (#6FE0F0), gölgede kalan yüz ortamın rengine (#073F49) yaklaşsın. Sıcak
 * hiçbir şey yok: bunlar bej değil, mavi-gri.
 */
const AHSAP_A = 0x56767e; // kaburga tonu — mavi-gri, ASLA sıcak/bej
const AHSAP_B = 0x4e7a72; // komşu kaburga, naneye bir tık (yeşile DEĞİL)
const TABLA_RENK = 0x44666e;
const KIRIS_RENK = 0x2c4a52;
// Ortam gölgedeki teknenin değerini #073F49'a oturtuyor (albedo × ortam / π
// hesaplanarak seçildi, göz kararı değil). Sahnenin en koyu yeri burası.
const AMBIYANS = 0x4defff;

/*
 * IŞIK RİGİ — kadraj denetimiyle seçildi (tarayıcısız ışın izleme, bkz. not).
 * Işık gülün ÜSTÜNDE (rozet = tablada bir delik) ve GERİYE tarıyor: kaynak
 * kirişin ilerisinde, koni kameraya doğru yatıyor.
 *
 * Neden geriye: ışık kirişin tam tepesinde olsaydı gölgesi ekranda kirişin
 * hemen dibine düşer, ikisi TEK koyu kütle olarak okunurdu — yani tam da
 * reddedilen panelin ta kendisi. Geriye tarayan ışıkta gölge kirişten kopup
 * kadrajın alt yarısına atılıyor; arada AYDINLIK taban kalıyor. Kiriş ile
 * gölgesi arasındaki bu boşluk, gölgenin bir panel değil bir GÖLGE olduğunu
 * gösteren şey.
 */
const ISIK = new THREE.Vector3(0, 13.0, 9);
const ISIK_HEDEF = new THREE.Vector3(0, -1.5, 1);
const KONI = 0.5; // spot yarı açısı (rad) — havuzun kenarı kadrajda kalsın

// ---- gergi kirişi (bas barı) --------------------------------------------
const KIRIS_Z0 = 4.2;
const KIRIS_Z1 = 6.6;
const KIRIS_UST = 5.6;
const KIRIS_ALT = 1.8; // x=0'daki en alçak nokta; uçlara doğru kemerleniyor
const KIRIS_YARI = 8.4; // yarı açıklık

// ---- kamera --------------------------------------------------------------
// Eğim -20°: teknenin dibi cepheye yakın görünsün. Düz bakışta taban aşırı
// kısalıyor ve gölge bandı ekranda 5 satırlık bir şeride çöküyordu.
const KAMERA_Y = 3.6;
const KAMERA_Z = -9;
const EGIM_DER = -20;

/** Deterministik gürültü — her yüklemede aynı kadraj. */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1B değer gürültüsü: kaburga boyunca ahşap damarı. Doku dosyası yok. */
function damar(x: number, tohum: number) {
  const p = x + tohum * 137.13;
  const i = Math.floor(p);
  const f = p - i;
  const u = f * f * (3 - 2 * f);
  const h = (n: number) => {
    const s = Math.sin(n * 12.9898 + tohum * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  return h(i) * (1 - u) + h(i + 1) * u;
}

/** Kirişin alt kemeri: ortada derin, uçlarda sığ. Hem gerçek luthier işi
 *  (traşlanmış bar) hem de mimari okuma (kemer). Düz kenar = panel riski. */
function kirisAlt(x: number) {
  const n = Math.min(Math.abs(x) / KIRIS_YARI, 1);
  const k = Math.pow(Math.max(1 - n * n, 0), 0.35);
  return TABLA_Y - ((TABLA_Y - KIRIS_ALT) * k + 0.14);
}

/**
 * Kadraj: dikey FOV en-boya göre açılır ama sınırlanır. Dar ekranda gövde
 * daralmasın diye kamera geri de çekiliyor.
 */
function cerceve(aspect: number) {
  const yatayYari = Math.tan(THREE.MathUtils.degToRad(30));
  const fov = THREE.MathUtils.clamp(
    THREE.MathUtils.radToDeg(2 * Math.atan(yatayYari / Math.max(aspect, 0.35))),
    48,
    72,
  );
  const geri = THREE.MathUtils.clamp((1.6 - Math.min(aspect, 1.6)) * 2.4, 0, 3.2);
  return { fov, kameraZ: KAMERA_Z - geri };
}

// ---- tekne: 21 lofted kaburga -------------------------------------------
/**
 * Kesit yarım elips; her kaburga o elipsin bir KİRİŞİ (düz), yani tekne
 * fasetli. Normaller kaburga genişliğince SABİT, z boyunca yumuşak → her
 * kaburga ışığı kendi değerinde tutuyor. Ritim buradan geliyor; pürüzsüz bir
 * kabuk "eğri bir mağara" olurdu (fikrin en büyük riski).
 *
 * Genişlik boyunca 4 vertex: 0, 0.055, 0.945, 1 → dıştaki dar çiftler keskin
 * bir dikiş çizgisi (bağa/filet), ortadaki geniş yüz temiz kalıyor.
 */
function tekneGeometrisi() {
  const U = [0, 0.055, 0.945, 1];
  const rnd = mulberry32(20260715);
  const konum: number[] = [];
  const normal: number[] = [];
  const renk: number[] = [];
  const indeks: number[] = [];

  const cA = new THREE.Color().setHex(AHSAP_A, THREE.SRGBColorSpace);
  const cB = new THREE.Color().setHex(AHSAP_B, THREE.SRGBColorSpace);
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const n = new THREE.Vector3();
  const ref = new THREE.Vector3();

  const nokta = (phi: number, z: number, jit: number, hedef: THREE.Vector3) => {
    const k = kesit(zdenS(z)) * jit;
    hedef.set(EN_YARI * k * Math.cos(phi), TABLA_Y - DERINLIK * k * Math.sin(phi), z);
    return hedef;
  };

  const boy = Z_BOYUN - Z_KUYRUK;

  for (let r = 0; r < KABURGA_SAYI; r++) {
    const phiLo = (r * Math.PI) / KABURGA_SAYI;
    const phiHi = ((r + 1) * Math.PI) / KABURGA_SAYI;
    const phiMid = (phiLo + phiHi) / 2;
    // kaburga başına: ton + çok küçük yarıçap sapması. Kusursuz klon = CG kokar.
    const t = rnd();
    const jit = 1 + (rnd() - 0.5) * 0.012;
    const tohum = rnd() * 100;
    c.copy(cA).lerp(cB, t);
    const ton = 0.74 + rnd() * 0.34;
    const taban = r * (Z_BOLUM + 1) * U.length;

    for (let j = 0; j <= Z_BOLUM; j++) {
      const z = Z_KUYRUK + (boy * j) / Z_BOLUM;

      // normal: kaburga yüzünün gerçek eğimi (across × along), analitik
      nokta(phiLo, z, jit, a);
      nokta(phiHi, z, jit, v);
      a.subVectors(v, a); // across
      const dz = 0.12;
      nokta(phiMid, Math.min(z + dz, Z_BOYUN), jit, b);
      nokta(phiMid, Math.max(z - dz, Z_KUYRUK), jit, v);
      b.sub(v); // along
      n.crossVectors(b, a).normalize();
      // içeri baksın: kamera teknenin İÇİNDE
      ref.set(-Math.cos(phiMid) / EN_YARI, Math.sin(phiMid) / DERINLIK, 0).normalize();
      if (n.dot(ref) < 0) n.negate();

      // damar kaburga BOYUNCA uzanıyor (gerçek tekne çıtası gibi)
      const g = 0.90 + damar(z * 0.55, tohum) * 0.18 + damar(z * 2.4, tohum + 7) * 0.05;

      for (let u = 0; u < U.length; u++) {
        nokta(phiLo + (phiHi - phiLo) * U[u], z, jit, v);
        konum.push(v.x, v.y, v.z);
        normal.push(n.x, n.y, n.z);
        const dikis = u === 0 || u === U.length - 1 ? 0.40 : 1;
        const m = ton * g * dikis;
        renk.push(c.r * m, c.g * m, c.b * m);
      }

      if (j < Z_BOLUM) {
        for (let u = 0; u < U.length - 1; u++) {
          const i0 = taban + j * U.length + u;
          const i1 = i0 + 1;
          const i2 = i0 + U.length;
          const i3 = i2 + 1;
          // Sarım İÇERİ bakacak şekilde: analitik normal her yerde dışarıyı
          // gösteriyordu ve ref testiyle çevriliyor → sarım da çevrilmeli,
          // yoksa FrontSide teknenin içini (yani gördüğümüz her şeyi) eler.
          indeks.push(i0, i1, i2, i1, i3, i2);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(konum, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(renk, 3));
  geo.setIndex(indeks);
  return geo;
}

/** Ses tablası: tavan. Altından bakıyoruz → normal aşağı. Damar z boyunca
 *  düz ve ince (dilme ladin). Işık ÜSTÜNDE olduğu için tabla spot'tan hiç
 *  ışık almaz — doğru: sadece tekneden sekmiş dolaylı ışığı alıyor. */
function tablaGeometrisi() {
  const MX = 96;
  const MZ = 60;
  const konum: number[] = [];
  const normal: number[] = [];
  const renk: number[] = [];
  const indeks: number[] = [];
  const c = new THREE.Color().setHex(TABLA_RENK, THREE.SRGBColorSpace);
  const boy = Z_BOYUN - Z_KUYRUK;

  for (let j = 0; j <= MZ; j++) {
    const z = Z_KUYRUK + (boy * j) / MZ;
    const w = EN_YARI * kesit(zdenS(z));
    for (let i = 0; i <= MX; i++) {
      const x = -w + 2 * w * (i / MX);
      konum.push(x, TABLA_Y, z);
      normal.push(0, -1, 0);
      const g = 0.82 + damar(x * 3.1, 3) * 0.26 + damar(x * 11.0, 9) * 0.08;
      renk.push(c.r * g, c.g * g, c.b * g);
    }
    if (j < MZ) {
      for (let i = 0; i < MX; i++) {
        const i0 = j * (MX + 1) + i;
        const i1 = i0 + 1;
        const i2 = i0 + MX + 1;
        const i3 = i2 + 1;
        indeks.push(i0, i1, i2, i1, i3, i2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(konum, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(renk, 3));
  geo.setIndex(indeks);
  return geo;
}

/** Gergi kirişi: tablanın altında asılı, tekneyi rimden rime geçen dev kiriş.
 *  Alt kenarı kemerli → gölgesinin kenarı da kemerli. */
function kirisGeometrisi() {
  const MX = 64;
  const konum: number[] = [];
  const indeks: number[] = [];
  // her x için 4 nokta: ön-üst, ön-alt, arka-alt, arka-üst
  for (let i = 0; i <= MX; i++) {
    const x = -KIRIS_YARI + 2 * KIRIS_YARI * (i / MX);
    const alt = kirisAlt(x);
    konum.push(x, KIRIS_UST, KIRIS_Z0);
    konum.push(x, alt, KIRIS_Z0);
    konum.push(x, alt, KIRIS_Z1);
    konum.push(x, KIRIS_UST, KIRIS_Z1);
  }
  for (let i = 0; i < MX; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    // ön yüz (kameraya bakan), alt yüz, arka yüz
    indeks.push(a + 0, b + 0, a + 1, a + 1, b + 0, b + 1);
    indeks.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    indeks.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(konum, 3));
  geo.setIndex(indeks);
  geo.computeVertexNormals();
  return geo;
}

type Props = {
  /** Her karede 7 telin genliği. setState YOK — doğrudan DOM. */
  bildir?: (genlik: number[]) => void;
  sinif?: string;
};

export function SesGovdesiSahnesi({ bildir, sinif }: Props) {
  const kapRef = useRef<HTMLDivElement>(null);
  const bildirRef = useRef(bildir);
  bildirRef.current = bildir;

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const statik = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kaba = window.matchMedia("(pointer: coarse)").matches;

    const sahne = new THREE.Scene();
    sahne.background = new THREE.Color().setHex(SIS, THREE.SRGBColorSpace);
    sahne.fog = new THREE.FogExp2(SIS, 0.019);

    const k0 = cerceve(Math.max(kap.clientWidth, 1) / Math.max(kap.clientHeight, 1));
    const kamera = new THREE.PerspectiveCamera(k0.fov, 1, 0.1, 120);
    kamera.position.set(0, KAMERA_Y, k0.kameraZ);
    // lookAt yok: eğim sabit → kiriş ve gölge bandı kadrajda çivilenmiş kalır.
    // YXZ şart: three kamerası varsayılan olarak -z'ye bakar, gövde ise +z'ye
    // doğru boyuna daralıyor. Önce π yaw (Y), SONRA eğim (X) → hem +z'ye bakar
    // hem eğim bozulmaz. Düz XYZ'de yaw eğimi aynalayıp kadrajı çeviriyordu.
    kamera.rotation.order = "YXZ";
    kamera.rotation.set(THREE.MathUtils.degToRad(EGIM_DER), Math.PI, 0);

    const cizer = new THREE.WebGLRenderer({
      antialias: !kaba,
      powerPreference: "high-performance",
    });
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, kaba ? 1.5 : 2));
    cizer.setSize(kap.clientWidth, kap.clientHeight);
    cizer.toneMapping = THREE.ACESFilmicToneMapping;
    cizer.toneMappingExposure = 1.0;
    // Gölge haritası YOK: bütün engeller cookie'de. Bkz. ses.ts.
    kap.appendChild(cizer.domElement);

    // ---- cookie: her karede shader'la üretilen tek doku -------------------
    const cBoy = kaba ? 256 : 512;
    const hedef = new THREE.WebGLRenderTarget(cBoy, cBoy, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    // colorSpace bilinçli olarak ham: three spotLightMap'i dönüştürmeden
    // ışık rengiyle çarpıyor → doğrusal uzayda yazıyoruz.
    hedef.texture.colorSpace = THREE.NoColorSpace;
    hedef.texture.wrapS = THREE.ClampToEdgeWrapping;
    hedef.texture.wrapT = THREE.ClampToEdgeWrapping;

    const cookieMat = new THREE.ShaderMaterial({
      uniforms: {
        uGenlik: { value: new Array(TEL_SAYI).fill(0) },
        uVLo: { value: 0.3 },
        uVHi: { value: 0.6 },
        uPenumbra: { value: 0.045 },
        uParlak: { value: 1 },
      },
      vertexShader: COOKIE_VERTEX,
      fragmentShader: COOKIE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    const cookieSahne = new THREE.Scene();
    const cookieKam = new THREE.Camera();
    const cookieGeo = new THREE.PlaneGeometry(2, 2);
    const cookieMesh = new THREE.Mesh(cookieGeo, cookieMat);
    cookieMesh.frustumCulled = false; // tam ekran dörtgen: kamera kutusuna göre elenmesin
    cookieSahne.add(cookieMesh);
    // Geliştirici gözü: ?cookie=1 ile dokunun kendisi ekrana basılır.
    const cookieAyikla = new URLSearchParams(window.location.search).has("cookie");

    // ---- tek ışık: kadraj dışındaki gül ----------------------------------
    // Yoğunluk kandela; mesafe sönümü 1/d² (havuz merkezi d≈15 → /226).
    // 4200, dantelin çekirdeğini #6FE0F0 civarına oturtacak şekilde
    // hesaplandı: diffuse = dotNL·ışık·I·(1/d²)·cookie·albedo/π.
    const spot = new THREE.SpotLight(0xdff8ff, 4200, 0, KONI, 1, 2);
    spot.position.copy(ISIK);
    spot.target.position.copy(ISIK_HEDEF);
    spot.map = hedef.texture;
    sahne.add(spot);
    sahne.add(spot.target);

    // Ortam: gölgedeki teknenin değerini #073F49'a tabanlar — saf siyah YOK.
    // three ortamı da albedo/π ile çarpıyor; 0.9 bu yüzden 3 kat yetersizdi.
    sahne.add(new THREE.AmbientLight(AMBIYANS, 1.0));
    /*
     * "Sekme" dolgu ışığı KALDIRILDI. İki nedenle:
     *  1. Bug: (0, -1, 7)'de duruyordu, tekne dibi ise y≈-1.5 → aradaki mesafe
     *     0.5, decay=2 ile 1/d² = 4 kat GÜÇLENİYORDU. Tabanı beyaza patlatan
     *     şey buydu; spot değil.
     *  2. Zaten gereksiz: -20° eğimde ses tablası hiç kadraja girmiyor, oysa
     *     bu ışık yalnızca tablanın altını aydınlatmak için vardı.
     * Sonuç sahnenin lehine: gerçekten TEK ışık kaynağı kaldı.
     */

    // ---- gövde -----------------------------------------------------------
    const tekneGeo = tekneGeometrisi();
    const tekneMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.62,
      metalness: 0,
      side: THREE.FrontSide,
    });
    sahne.add(new THREE.Mesh(tekneGeo, tekneMat));

    const tablaGeo = tablaGeometrisi();
    const tablaMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0,
      side: THREE.FrontSide,
    });
    sahne.add(new THREE.Mesh(tablaGeo, tablaMat));

    const kirisGeo = kirisGeometrisi();
    const kirisMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHex(KIRIS_RENK, THREE.SRGBColorSpace),
      roughness: 0.7,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    sahne.add(new THREE.Mesh(kirisGeo, kirisMat));

    // ---- kirişin cookie'deki siluetı -------------------------------------
    /*
     * Kiriş x boyunca uzanıyor ve ışık x=0'da → siluetinin kenarları, ışığı
     * içeren ve x yönünü barındıran düzlemlerdir; projektif dönüşüm doğruyu
     * doğruya taşıdığı için cookie'de u eksenine PARALEL iki doğru olurlar.
     * Yani silueti iki skaler (vLo, vHi) tam tanımlıyor.
     * Kemerli alt kenar bu skalerlere x=0'daki (en alçak) noktasıyla giriyor:
     * ışık havuzu zaten x≈0 çevresinde yoğun, uçlarda ışık yok — yaklaşımın
     * hatası görünmediği yerde kalıyor.
     */
    const kirisBandi = () => {
      spot.updateMatrixWorld();
      spot.target.updateMatrixWorld();
      spot.shadow.updateMatrices(spot);
      const m = spot.shadow.matrix;
      const p = new THREE.Vector4();
      let lo = Infinity;
      let hi = -Infinity;
      const alt = kirisAlt(0);
      for (const y of [alt, KIRIS_UST]) {
        for (const z of [KIRIS_Z0, KIRIS_Z1]) {
          p.set(0, y, z, 1).applyMatrix4(m);
          const v = p.y / p.w;
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
      }
      cookieMat.uniforms.uVLo.value = lo;
      cookieMat.uniforms.uVHi.value = hi;
      // Penumbra rozetin AÇIKLIK genişliğinden geliyor: gül nokta değil, geniş
      // bir delik. Kenarın yumuşaklığı uydurma değil, açıklığın açısal boyu.
      cookieMat.uniforms.uPenumbra.value = 0.052;
    };
    kirisBandi();

    // ---- fare parallaksı --------------------------------------------------
    const fare = { x: 0, y: 0 };
    const hedefFare = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedefFare.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedefFare.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba) {
      window.addEventListener("pointermove", fareOynat, { passive: true });
    }

    // ---- döngü ------------------------------------------------------------
    const genlik = new Array(TEL_SAYI).fill(0);
    const cizKare = (t: number) => {
      telGenlikleri(t, genlik);
      cookieMat.uniforms.uGenlik.value = genlik;
      // gövde rezonansı: toplam genlikle çok hafif nabız. Tek "büyük efekt" yok.
      let top = 0;
      for (let i = 0; i < TEL_SAYI; i++) top += genlik[i];
      cookieMat.uniforms.uParlak.value = 0.94 + (top / TEL_SAYI) * 0.20;

      cizer.setRenderTarget(hedef);
      cizer.render(cookieSahne, cookieKam);
      cizer.setRenderTarget(null);
      if (cookieAyikla) cizer.render(cookieSahne, cookieKam);
      else cizer.render(sahne, kamera);
      bildirRef.current?.(genlik);
    };

    let id = 0;
    let gorunur = false;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const ciz = () => {
      const t = saat.getElapsedTime();
      fare.x += (hedefFare.x - fare.x) * 0.04;
      fare.y += (hedefFare.y - fare.y) * 0.04;
      kamera.position.x = fare.x * 0.7;
      kamera.position.y = KAMERA_Y - fare.y * 0.3 + Math.sin(t * 0.21) * 0.04;
      cizKare(t);
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

    // reduced-motion BASE katman: rAF hiç başlamaz, tek statik kare.
    if (statik) cizKare(DURGUN_T);

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
      kamera.fov = k.fov;
      kamera.aspect = w / h;
      kamera.position.z = k.kameraZ;
      kamera.updateProjectionMatrix();
      cizer.setSize(w, h);
      if (statik) cizKare(DURGUN_T);
    };
    boyutla();
    const ro = new ResizeObserver(boyutla);
    ro.observe(kap);

    return () => {
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", fareOynat);
      tekneGeo.dispose();
      tekneMat.dispose();
      tablaGeo.dispose();
      tablaMat.dispose();
      kirisGeo.dispose();
      kirisMat.dispose();
      cookieGeo.dispose();
      cookieMat.dispose();
      hedef.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

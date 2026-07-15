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
 * OKUNABİLİRLİK — "ışığın ulaşmadığı yer" (perde/panel/scrim DEĞİL):
 *   Gül kadrajın alt yarısının üstünde ve neredeyse DİK aşağı bakıyor. Işık
 *   havuzu bu yüzden kadrajın dibine çivilenmiş: göbeği dantel, eteği yukarı
 *   doğru sönen düz bir rampa. Metin, rampanın bittiği yerde — teknenin ışık
 *   ULAŞMAYAN derinliğinde — duruyor. Kaldırılacak bir katman yok.
 *
 *   ÖNCEKİ TUR NEDEN BATTI (ölçümle): ışık geriye, teknenin dibine YALAYARAK
 *   tarıyordu. Koninin +θ kenarı neredeyse dikey, -θ kenarı neredeyse yatay →
 *   havuz z ekseninde -15.5'ten +8.9'a smear oluyor, ekranın %48-100'ünü
 *   yiyordu. Koniyi daraltmak çözmüyordu: +z kenarını %76'ya çekmek için
 *   θ=0.06° gerekiyordu, yani kalem ışını. Çözüm koni değil AÇI: kaynağı
 *   havuzun tam üstüne alıp dikleştirdik (eğim 5.7°), koni artık yalayan
 *   açıları hiç görmüyor.
 *
 * Yasaklı motiflere karşı: halka/yörünge yok (gül kadraj dışında), god-ray
 * yok, kaustik yok, tel-kafes küre yok, sıcak/bej yok, saf siyah yok.
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

/*
 * ORTAM — AmbientLight DEĞİL, HemisphereLight. Bu sahnenin en önemli ikinci
 * kararı; nedeni ölçümde ortaya çıktı.
 *
 * SORUN: düz AmbientLight her yüzeye AYNI ışınımı verir. Tek nokta ışık koca
 * teknenin yalnız dibine yetişebildiği için kadrajın üst üçte ikisi %100 ortam
 * ışığındaydı → her kaburga aynı değerde. Ölçüm acımasızdı: ekranın %3'ünden
 * %63'üne kadar HER satır mean 60-63, max 70-72. 10 değerlik bir bantta düz bir
 * duvar. Kural (d) tam olarak bunu yasaklıyor: kontrastsız sahne "sakin" değil
 * OLAYSIZ okur. Dantel perdesini, düz bir teal duvar kâğıdıyla takas etmiştim.
 *
 * ÇÖZÜM ve neden ikinci ışık DEĞİL: bu odanın en parlak yüzeyi tabandaki
 * girih havuzu. Gerçek bir mekânda dolaylı ışık oradan, yani AŞAĞIDAN gelir;
 * karanlık tavan ise neredeyse hiçbir şey geri vermez. HemisphereLight tam
 * bunu modelliyor — yeni bir kaynak eklemiyor, VAR OLAN tek kaynağın sekmesini
 * yönlü hâle getiriyor: yukarı bakan yüzeyler (teknenin dibi, metnin durduğu
 * yer) sönük gökten; aşağı bakan yüzeyler (kaburgaların üst kıvrımı, tavan)
 * parlak havuz sekmesinden besleniyor.
 *
 * Kadrajdaki karşılığı bedava geliyor: merkez (dip) sakin ve koyu, kenarlara
 * doğru kaburgalar modelleniyor. Vinyet efektle değil, NORMALLE geliyor.
 */
/*
 * GOK'ün DEĞERİ ölçümle ayarlandı, göz kararıyla değil. İlk deneme (0x2e6b73
 * × 1.7) modellemeyi getirdi ama sahneyi çukura düşürdü: metin bölgesi mean
 * 15-25, en koyu piksel #000405 — yani neredeyse SAF SİYAH, reddedilen "dip
 * kapısı #000" hatasının ta kendisi. Taban ~2.4 kat kaldırıldı.
 *
 * Hedef bilerek KOYU (mean ~30-45), aydınlık değil: tek ışıklı bir mekânın
 * gövdesi karanlıktır ve beyaz tipografi orada 10:1'in üstünde okur. Kuralın
 * "en koyu değer #073F49" dediği şey sahnenin ortalaması değil TABANI — yani
 * hiçbir yerde siyah çukur olmasın. #073F49'un kendisi de zaten R/B ≈ 0.10'luk
 * bir renk; gölgedeki kırmızının düşük kalması hue'nun doğru olduğunu gösterir,
 * yeter ki sıfıra çakılmasın.
 */
/*
 * GOK'ün KIRMIZISI ayrı bir hikâye ve bu sahnenin en ince hatasıydı.
 *
 * Ölçüm: metin bölgesi #012F35 çıkıyordu, yani R/G = 0.015. Oysa paletin en
 * koyu teali #073F49'un R/G'si 0.111, #0E4A46'nınki 0.189 — sahne paletten
 * YEDİ KAT daha doygundu. Kanvasın %56'sında kırmızı kanal tam olarak SIFIRDI.
 *
 * Sebep tone mapping: ACES'in çıkış matrisi R = 1.605a − 0.531b − 0.074c.
 * Yeterince doygun bir cyan'da bu ifade NEGATİFE düşüyor ve saturate() onu
 * sıfıra kırpıyor. Yani "doygun cyan" burada bir üslup tercihi değil, gamut
 * dışına taşma; kurucunun iki denemesinin "batmasının" (kendi ifadesi) sebebi
 * de buydu — teşhisi doğruydu, ölçüsü yoktu.
 *
 * Düzeltme SEVİYEYE değil ORANA: 0x42 → 0x66 yalnız kırmızıyı kaldırıyor,
 * G ve B kanalları bit düzeyinde aynı kalıyor (modelde çıkış 35,45 → 35,45),
 * yani sahnenin parlaklığı ve kontrastı hiç değişmiyor; yalnız hue paletin
 * içine dönüyor. Isınma yok: R hâlâ G'nin ~%15'i, sonuç koyu teal.
 */
const GOK = 0x66868f; // yukarı bakan yüzeyler — sönük tavanın verdiği az şey
const YER = 0xa6f0ff; // aşağı bakan yüzeyler — girih havuzunun sekmesi
const ORTAM_SIDDET = 2.8;

/*
 * IŞIK RİGİ — ölçümle seçildi (bkz. dosya başındaki not).
 * Gül (rozet) havuzun tam üstünde, tablanın üstünden neredeyse DİK aşağı
 * bakıyor: eğim yalnız 5.7° (kaynak 0,12.5,-3.5 → hedef 0,-2.5,-2.0).
 *
 * Neden dik: koni yalayan açıları görmesin. Eski rigde koni dikey ile 57°
 * arasını tarıyordu, havuz ekranın yarısına yayılıyordu. Dik konide havuz
 * ekranda kompakt: çekirdek ~%75-100, eteği ~%62'ye kadar sönüyor.
 *
 * 5.7° eğim sıfır DEĞİL, çünkü tam dikey bakışta three'nin lookAt'i
 * (forward ∥ up) dejenere olur ve cookie'nin u/v ekseni rastgele döner —
 * 7 telin gölgesi gövde boyunca (z) değil rastgele bir yöne uzanırdı.
 */
const ISIK = new THREE.Vector3(0, 12.5, -3.5);
const ISIK_HEDEF = new THREE.Vector3(0, -2.5, -2.0);
const KONI = 0.34; // spot yarı açısı (rad)

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
        // Dikiş 0.40 → 0.58: 0.40'ta dikiş çizgileri sahnenin en koyu pikseliydi
        // (ölçüm: #000D0E, kırmızı kanal sıfır — palet dışı). Zaten koyu bir
        // gövdede albedoyu 0.40'la çarpmak siyah üretiyordu. 0.58 dikişi hâlâ
        // dikiş bırakıyor (kaburga yüzü ile arasında ~1.7 kat fark var) ama
        // tabanı tealde tutuyor. Kaburga ritmi bu çizgiden değil, yüzler
        // arasındaki ton farkından geliyor — kaybedilen bir şey yok.
        const dikis = u === 0 || u === U.length - 1 ? 0.58 : 1;
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
    // Eski rigde ışık tabana ~29° eğik çarpıyordu (dotNL 0.87); şimdi dik
    // çarpıyor (dotNL≈0.99) → aynı şiddet daha parlak. Ölçümle 4200 → 3000:
    // çekirdek hâlâ #6FE0F0'a çıkıyor ama etek görünürlük eşiğinin altına
    // düşüyor, yani dantel metin bölgesine sızmıyor.
    const spot = new THREE.SpotLight(0xdff8ff, 3000, 0, KONI, 1, 2);
    spot.position.copy(ISIK);
    spot.target.position.copy(ISIK_HEDEF);
    spot.map = hedef.texture;
    sahne.add(spot);
    sahne.add(spot.target);

    // Yönlü sekme (bkz. GOK/YER notu). Saf siyah YOK: en koyu yüzey bile
    // GOK'ten pay alıyor, dolayısıyla taban değeri #073F49 civarında kalıyor.
    sahne.add(new THREE.HemisphereLight(GOK, YER, ORTAM_SIDDET));
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
      cookieGeo.dispose();
      cookieMat.dispose();
      hedef.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

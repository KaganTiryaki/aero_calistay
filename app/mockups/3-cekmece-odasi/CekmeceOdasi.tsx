"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/*
 * ÇEKMECE ODASI — AERO'nun WebGL sahnesi.
 *
 * Kamera, dört duvarı zeminden tavana kartoteks çekmecesi olan aydınlık bir
 * odanın ortasında. Ara sıra bir çekmece açılıyor, içinden bir kâğıt fişi
 * süzülüp odayı geçiyor, karşı duvarda başka bir çekmeceye giriyor.
 *
 * "Sirkülasyon"un arşivdeki gerçek anlamı bu: bir kaydın bir yerden çıkıp
 * başka bir yere geçmesi. Burada mecaz değil, tek tek sayılabilen bir olay.
 *
 * HARMAN: Oda derin. Yan duvarlar perspektifte ekranın KENARLARINA süpürülür —
 * ızgara yoğunluğu orada toplanır. Uzak duvar tam merkezde kalır ve sis onu düz
 * soluk bir düzleme indirir: metin tam oraya, odanın ortasındaki havaya oturur.
 * Perde/scrim yok — okunabilirlik odanın kendi ışık ve derinlik tasarımından.
 *
 * Zorunlular: DPR cap · IntersectionObserver ile ekran dışında duraklat ·
 * visibilitychange'de duraklat · prefers-reduced-motion'da rAF hiç başlamaz
 * (tek statik kare) · pointer:coarse'da instance düşür + antialias kapat ·
 * cleanup'ta dispose.
 */

// ---- Oda ------------------------------------------------------------------
// Oda kasten derin ve yüksek: derinlik sisin çalışması için, yükseklik zeminin
// kadrajı yemesin diye. Duvarlar hâkim, zemin/tavan sadece odayı kapatır.
const ODA_W = 26;
const ODA_H = 18;
const ODA_D = 46;
const W2 = ODA_W / 2;
const H2 = ODA_H / 2;
const D2 = ODA_D / 2;

const CEK_DERIN = 0.22; // çekmecenin duvardan çıkıntısı
const ACILMA = 0.52; // açılınca kayacağı mesafe
const YUZ_ORAN = 0.87; // hücrenin ne kadarı yüz — kalanı derz (gölge çizgisi)

const FIS_G = 1.05;
const FIS_Y = 0.7;

const SIS_YOG = 0.042;

/**
 * Toplamalı (additive) katmanların mesafe sönümü.
 *
 * three'nin sisi fragmanı `mix(renk, sisRengi, oran)` ile karıştırır. Sis rengi
 * PARLAK (#dbeae9) olduğu için toplamalı bir katmanda uzak parıltı sönmez —
 * tersine ekrana parlak sis rengi EKLER: fiş/çekmece parıltısı uzakta nane
 * olmaktan çıkıp BEYAZ lekeye döner. Üstelik "uzak" demek perspektifte "ekranın
 * ortası" demek, yani tam metnin arkası. Bu yüzden toplamalı materyallerde sis
 * KAPALI; sönümü fog eğrisinin kendisiyle elle uyguluyoruz: uzaktaki ışık
 * toplamaya daha az katkı verir → metnin arkası kendiliğinden sakinleşir.
 */
const sisSonum = (d: number, yog: number) => Math.exp(-((d * yog) ** 2));

// Okuma bandı: metnin oturduğu hacim. Fiş yolları buranın ETRAFINDAN dolanır.
const BAND = { x: 6.9, y: 4.5, z: -6 };

// ---- Palet: tek hue ailesi. Aksan yalnız açılan çekmecenin astarından. -----
// Derz kasten AÇIK: koyu derz uzak duvarda sisi yenip ızgarayı metnin arkasında
// diri tutuyordu. Yakındaki kabartma zaten ışığın yalamasından geliyor — derzin
// karanlığa ihtiyacı yok. Böylece uzak duvar sisle düz soluk düzleme iniyor.
const RENK_KOVUK = new THREE.Color("#5f8482"); // duvar düzlemi = derz gölgesi
const RENK_CEKMECE = new THREE.Color("#e7eeed");
const RENK_ZEMIN = new THREE.Color("#dae7e6");
const RENK_TAVAN = new THREE.Color("#eef5f4");
const RENK_KULP = new THREE.Color("#88a3a3");
const RENK_ASTAR = new THREE.Color("#43d6a8"); // nane
const RENK_ISIK = new THREE.Color("#35c8e6"); // cyan taşma
const RENK_SIS = new THREE.Color("#dbeae9");
const RENK_FIS = new THREE.Color("#fcfefe");

type DuvarSpec = {
  merkez: THREE.Vector3;
  u: THREE.Vector3; // ızgaranın sağ ekseni
  n: THREE.Vector3; // odanın içine bakan normal
  genislik: number; // u boyunca
  yukseklik: number; // +Y boyunca
  sutun: number;
  satir: number;
};

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Kartoteks yüzü için ucuz AO: kenarlara doğru koyulaşan vinyet. Dosya yok. */
function yuzDokusu() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 64, 64);
  // kademeden gelen AO: dört kenardan içeri doğru koyu
  const kenar = ctx.createLinearGradient(0, 0, 0, 64);
  kenar.addColorStop(0, "rgba(30,60,62,0.42)");
  kenar.addColorStop(0.18, "rgba(30,60,62,0)");
  kenar.addColorStop(0.82, "rgba(30,60,62,0)");
  kenar.addColorStop(1, "rgba(30,60,62,0.3)");
  ctx.fillStyle = kenar;
  ctx.fillRect(0, 0, 64, 64);
  const yan = ctx.createLinearGradient(0, 0, 64, 0);
  yan.addColorStop(0, "rgba(30,60,62,0.34)");
  yan.addColorStop(0.16, "rgba(30,60,62,0)");
  yan.addColorStop(0.84, "rgba(30,60,62,0)");
  yan.addColorStop(1, "rgba(30,60,62,0.34)");
  ctx.fillStyle = yan;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Açılan çekmeceden taşan ışık için yumuşak radyal doku. */
function tasmaDokusu() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.35, "rgba(255,255,255,0.3)");
  g.addColorStop(0.7, "rgba(255,255,255,0.07)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Fiş: kartoteks kartı. Okunurluğu HALEDEN değil kendi yüzünden gelir —
 * cetvel çizgileri ve keskin kenar kartı sisin içinde bile "kart" olarak
 * tutar. Üst kenardaki nane sekme, kartın çıktığı çekmecenin astarıyla aynı
 * renk: "bu, o çekmeceden çıkan şey" bağını renk kurar, parlaklık değil.
 */
function fisDokusu() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 88;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 128, 88);
  // nane sekme: kartın üst şeridi
  ctx.fillStyle = "#43d6a8";
  ctx.fillRect(0, 0, 128, 10);
  // cetvel çizgileri: kartı kart yapan şey — bilerek koyu.
  ctx.fillStyle = "rgba(18,58,62,0.5)";
  for (let i = 0; i < 5; i++) {
    const y = 24 + i * 12;
    ctx.fillRect(12, y, i === 0 ? 58 : 96 - (i % 2) * 22, 2.4);
  }
  // kenar: silüeti keskinleştirir, kart soluk duvarın önünde kaybolmaz.
  ctx.strokeStyle = "rgba(18,58,62,0.5)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 125, 85);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const kis = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** cubic-bezier(0.16,1,0.3,1) hissi: çekmece çıkarken hızlı, otururken sakin. */
const yumusa = (x: number) => {
  const t = kis(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
/** 0'dan t0'da başlayıp d sürede 1'e çıkan rampa. */
const rampa = (t: number, t0: number, d: number) => yumusa((t - t0) / d);

export function CekmeceOdasi() {
  const kapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)");
    const kaba = window.matchMedia("(pointer: coarse)").matches;
    const statik = azHareket.matches;

    // Çizer EN ÖNCE kurulur: WebGL yoksa (kapalı / sürücü / bağlam sınırı aşıldı)
    // hiçbir kaynak ayırmadan sessizce çekiliriz. Oda dekor, iş CTA'da — sahne
    // kurulamıyorsa sayfa yine de okunur kalsın, hata ekranı basmasın.
    let cizer: THREE.WebGLRenderer;
    try {
      cizer = new THREE.WebGLRenderer({
        antialias: !kaba,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap
    cizer.setSize(kap.clientWidth, kap.clientHeight);
    kap.appendChild(cizer.domElement);

    const yuzDoku = yuzDokusu();
    const tasmaDoku = tasmaDokusu();
    const fisDoku = fisDokusu();

    const sahne = new THREE.Scene();
    sahne.background = RENK_SIS.clone();
    // Uzak duvar (metnin arkası) ~%84 sisli, kameranın yanındaki yan duvarlar
    // ~%26: ızgara yoğunluğu çevrede diri, merkez düz ve sakin.
    sahne.fog = new THREE.FogExp2(RENK_SIS.getHex(), SIS_YOG);

    const kamera = new THREE.PerspectiveCamera(
      55,
      kap.clientWidth / Math.max(kap.clientHeight, 1),
      0.1,
      200,
    );
    kamera.position.set(0, 0, 9);

    /**
     * Portre kadrajda sis. Oda 46 derin ama dar kadrajda yatay görüş ~27°'ye
     * iniyor: yan duvarlar kadraja MATEMATİKSEL olarak giremiyor (girmeleri için
     * 54+ birim mesafe gerekirdi), yani mobilde ekranda gördüğümüz şey uzak
     * duvarın kendisi. %84 sis onu düz bir düzleme indirince oda tamamen
     * kayboluyor, geriye soluk bir yıkama kalıyordu. Dar kadrajda sisi hafiflet:
     * uzak duvarın ızgarası — yani odanın ta kendisi — geri gelsin. Izgara zaten
     * düşük kontrastlı olduğu için metin önünde okunmaya devam ediyor.
     * (FOV'u büyütmek işe yaramaz: oda 18 yüksek, geniş dikey FOV yalnızca boş
     * tavan/zemin getirir — denendi, kadraj bozuldu.)
     */
    let sisYog = SIS_YOG;
    const sisAyarla = () => {
      sisYog = kamera.aspect < 1 ? 0.03 : SIS_YOG;
      (sahne.fog as THREE.FogExp2).density = sisYog;
    };

    // ---- Işık: tek geniş soft directional + ambient. Post yok. -------------
    sahne.add(new THREE.AmbientLight(0xdbeeee, 0.75));
    const gok = new THREE.HemisphereLight(0xeafafa, 0x86a8a8, 0.55);
    sahne.add(gok);
    const anaIsik = new THREE.DirectionalLight(0xffffff, 1.15);
    anaIsik.position.set(0.35, 1, 0.75);
    sahne.add(anaIsik);

    // ---- Duvarlar ---------------------------------------------------------
    // Hücre ~1.53 × 0.82 → yüz 1.33 × 0.71: kartoteks çekmecesi enine uzun.
    // Kare yüz "dolap/kilitli kutu" gibi okunuyordu, kartoteks gibi değil.
    // Yan duvarlar 30 sütun (derinlik boyunca) → perspektifte ekranın
    // kenarlarına süpürülür. Uzak duvar 17 sütun, merkezde sise gömülür.
    const duvarlar: DuvarSpec[] = [
      {
        merkez: V(0, 0, -D2),
        u: V(1, 0, 0),
        n: V(0, 0, 1),
        genislik: ODA_W,
        yukseklik: ODA_H,
        sutun: 17,
        satir: 22,
      },
      {
        merkez: V(-W2, 0, 0),
        u: V(0, 0, -1),
        n: V(1, 0, 0),
        genislik: ODA_D,
        yukseklik: ODA_H,
        sutun: 30,
        satir: 22,
      },
      {
        merkez: V(W2, 0, 0),
        u: V(0, 0, 1),
        n: V(-1, 0, 0),
        genislik: ODA_D,
        yukseklik: ODA_H,
        sutun: 30,
        satir: 22,
      },
    ];
    // Arka duvar kameranın gerisinde: salınımda kenardan sızar, fiş oradan da
    // gelebilir. Dokunmatikte tamamen düşer.
    if (!kaba) {
      duvarlar.push({
        merkez: V(0, 0, D2),
        u: V(-1, 0, 0),
        n: V(0, 0, -1),
        genislik: ODA_W,
        yukseklik: ODA_H,
        sutun: 17,
        satir: 22,
      });
    }

    const N = duvarlar.reduce((a, d) => a + d.sutun * d.satir, 0);

    // Instance başına taban veri — açılma anında matris buradan yeniden kurulur.
    const bazPoz = new Float32Array(N * 3); // hücrenin duvar yüzeyindeki merkezi
    const bazNorm = new Float32Array(N * 3);
    const bazOlcek = new Float32Array(N * 2); // yüz genişlik / yükseklik
    const bazBaz = new Float32Array(N * 9); // u, v, n bazı
    const duvarIdx: number[][] = duvarlar.map(() => []);

    const m4 = new THREE.Matrix4();
    const olcekM = new THREE.Matrix4();
    const yardimciV = new THREE.Vector3();

    // ---- Kabuk: 4 duvar düzlemi + zemin + tavan, tek InstancedMesh --------
    const kabukGeo = new THREE.PlaneGeometry(1, 1);
    const kabukMat = new THREE.MeshStandardMaterial({
      roughness: 0.95,
      metalness: 0,
    });
    const kabukSayi = duvarlar.length + 2;
    const kabuk = new THREE.InstancedMesh(kabukGeo, kabukMat, kabukSayi);
    duvarlar.forEach((d, i) => {
      m4.makeBasis(d.u, V(0, 1, 0), d.n);
      m4.multiply(olcekM.makeScale(d.genislik, d.yukseklik, 1));
      m4.setPosition(d.merkez);
      kabuk.setMatrixAt(i, m4);
      kabuk.setColorAt(i, RENK_KOVUK);
    });
    // zemin
    m4.makeBasis(V(1, 0, 0), V(0, 0, -1), V(0, 1, 0));
    m4.multiply(olcekM.makeScale(ODA_W, ODA_D, 1));
    m4.setPosition(V(0, -H2, 0));
    kabuk.setMatrixAt(duvarlar.length, m4);
    kabuk.setColorAt(duvarlar.length, RENK_ZEMIN);
    // tavan
    m4.makeBasis(V(1, 0, 0), V(0, 0, 1), V(0, -1, 0));
    m4.multiply(olcekM.makeScale(ODA_W, ODA_D, 1));
    m4.setPosition(V(0, H2, 0));
    kabuk.setMatrixAt(duvarlar.length + 1, m4);
    kabuk.setColorAt(duvarlar.length + 1, RENK_TAVAN);
    kabuk.instanceMatrix.needsUpdate = true;
    if (kabuk.instanceColor) kabuk.instanceColor.needsUpdate = true;
    sahne.add(kabuk);

    // ---- Çekmece yüzleri + kulp çıtaları ----------------------------------
    const cekGeo = new THREE.BoxGeometry(1, 1, CEK_DERIN);
    const cekMat = new THREE.MeshStandardMaterial({
      color: RENK_CEKMECE,
      map: yuzDoku ?? undefined,
      roughness: 0.82,
      metalness: 0.02,
    });
    const cekmeceler = new THREE.InstancedMesh(cekGeo, cekMat, N);
    cekmeceler.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const kulpGeo = new THREE.BoxGeometry(1, 1, 0.055);
    const kulpMat = new THREE.MeshStandardMaterial({
      color: RENK_KULP,
      roughness: 0.45,
      metalness: 0.35,
    });
    const kulplar = new THREE.InstancedMesh(kulpGeo, kulpMat, N);
    kulplar.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    let k = 0;
    const uV = new THREE.Vector3();
    const vV = V(0, 1, 0);
    const nV = new THREE.Vector3();
    duvarlar.forEach((d, di) => {
      const hg = d.genislik / d.sutun;
      const hy = d.yukseklik / d.satir;
      const fg = hg * YUZ_ORAN;
      const fy = hy * YUZ_ORAN;
      for (let c = 0; c < d.sutun; c++) {
        for (let r = 0; r < d.satir; r++) {
          const uOfs = ((c + 0.5) / d.sutun - 0.5) * d.genislik;
          const vOfs = ((r + 0.5) / d.satir - 0.5) * d.yukseklik;
          const p = d.merkez
            .clone()
            .addScaledVector(d.u, uOfs)
            .addScaledVector(vV, vOfs);

          p.toArray(bazPoz, k * 3);
          d.n.toArray(bazNorm, k * 3);
          bazOlcek[k * 2] = fg;
          bazOlcek[k * 2 + 1] = fy;
          d.u.toArray(bazBaz, k * 9);
          vV.toArray(bazBaz, k * 9 + 3);
          d.n.toArray(bazBaz, k * 9 + 6);
          duvarIdx[di].push(k);
          k++;
        }
      }
    });

    /** Bir çekmeceyi (gövde + kulp) verilen açıklıkta yerine yazar. */
    const cekmeceYaz = (i: number, acik: number) => {
      uV.fromArray(bazBaz, i * 9);
      nV.fromArray(bazBaz, i * 9 + 6);
      vV.fromArray(bazBaz, i * 9 + 3);
      const fg = bazOlcek[i * 2];
      const fy = bazOlcek[i * 2 + 1];
      yardimciV.fromArray(bazPoz, i * 3);

      const d = CEK_DERIN / 2 + acik * ACILMA;
      m4.makeBasis(uV, vV, nV);
      m4.multiply(olcekM.makeScale(fg, fy, 1));
      m4.setPosition(
        yardimciV.x + nV.x * d,
        yardimciV.y + nV.y * d,
        yardimciV.z + nV.z * d,
      );
      cekmeceler.setMatrixAt(i, m4);

      // kulp: yüzün alt-ortasında, gövdeden 0.03 önde
      const kd = CEK_DERIN + 0.03 + acik * ACILMA;
      const ky = -fy * 0.24;
      m4.makeBasis(uV, vV, nV);
      m4.multiply(olcekM.makeScale(fg * 0.44, fy * 0.15, 1));
      m4.setPosition(
        yardimciV.x + nV.x * kd + vV.x * ky,
        yardimciV.y + nV.y * kd + vV.y * ky,
        yardimciV.z + nV.z * kd + vV.z * ky,
      );
      kulplar.setMatrixAt(i, m4);
    };

    for (let i = 0; i < N; i++) cekmeceYaz(i, 0);
    cekmeceler.instanceMatrix.needsUpdate = true;
    kulplar.instanceMatrix.needsUpdate = true;
    sahne.add(cekmeceler);
    sahne.add(kulplar);

    // ---- Olay havuzu: aynı anda birkaç çekmece ----------------------------
    const OLAY = kaba ? 4 : 6;

    // Astar: açılan çekmecenin ardında duvara oturan nane dikdörtgeni.
    const astarGeo = new THREE.PlaneGeometry(1, 1);
    const astarMat = new THREE.MeshBasicMaterial({ fog: true });
    const astarlar = new THREE.InstancedMesh(astarGeo, astarMat, OLAY * 2);
    astarlar.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    sahne.add(astarlar);

    // Taşma: açık çekmecenin çevresine sızan ışık. Çekmecenin önünde durur ki
    // komşu yüzler tarafından kesilmesin — silüetin dışında hale bırakır.
    const tasmaGeo = new THREE.PlaneGeometry(1, 1);
    const tasmaMat = new THREE.MeshBasicMaterial({
      map: tasmaDoku ?? undefined,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false, // bkz. sisSonum: additive + fog = uzakta beyaz leke
    });
    const tasmalar = new THREE.InstancedMesh(tasmaGeo, tasmaMat, OLAY * 2);
    tasmalar.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    tasmalar.renderOrder = 3;
    sahne.add(tasmalar);

    // Fiş: olay başına bir kart.
    const fisGeo = new THREE.PlaneGeometry(1, 1);
    const fisMat = new THREE.MeshStandardMaterial({
      color: RENK_FIS,
      map: fisDoku ?? undefined,
      side: THREE.DoubleSide,
      roughness: 0.7,
      metalness: 0,
      // Emissive YOK: kendi kendine parlayan kart = parlayan parçacık. Kart
      // odanın ışığıyla aydınlanır, kendi ışığıyla değil.
    });
    const fisler = new THREE.InstancedMesh(fisGeo, fisMat, OLAY);
    fisler.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    sahne.add(fisler);

    // Fişin kendi ışığı: beyaz kart, kemik beyazı duvarın önünde kayboluyordu —
    // olay okunmayınca fikir jenerik parçacığa düşer. Kartın arkasındaki bu
    // yumuşak nane hale onu odanın her yerinde takip edilebilir kılar; astarla
    // aynı renk olduğu için "çekmeceden çıkan şey" bağı da kuruluyor.
    const fisIsikGeo = new THREE.PlaneGeometry(1, 1);
    const fisIsikMat = new THREE.MeshBasicMaterial({
      map: tasmaDoku ?? undefined,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false, // bkz. sisSonum
    });
    const fisIsiklari = new THREE.InstancedMesh(fisIsikGeo, fisIsikMat, OLAY);
    fisIsiklari.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    fisIsiklari.renderOrder = 2;
    sahne.add(fisIsiklari);

    const sifir = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < OLAY * 2; i++) {
      astarlar.setMatrixAt(i, sifir);
      astarlar.setColorAt(i, RENK_KOVUK);
      tasmalar.setMatrixAt(i, sifir);
      tasmalar.setColorAt(i, new THREE.Color(0, 0, 0));
    }
    for (let i = 0; i < OLAY; i++) {
      fisler.setMatrixAt(i, sifir);
      fisIsiklari.setMatrixAt(i, sifir);
      fisIsiklari.setColorAt(i, new THREE.Color(0, 0, 0));
    }
    if (astarlar.instanceColor) astarlar.instanceColor.needsUpdate = true;
    if (tasmalar.instanceColor) tasmalar.instanceColor.needsUpdate = true;
    if (fisIsiklari.instanceColor) fisIsiklari.instanceColor.needsUpdate = true;

    // ---- Yol üretimi: okuma bandı keep-out hacmi --------------------------
    const bandIhlal = (x: number, y: number, z: number) =>
      Math.abs(x) < BAND.x && Math.abs(y) < BAND.y && z > BAND.z;

    const bez = (
      out: THREE.Vector3,
      p0: THREE.Vector3,
      k1: THREE.Vector3,
      k2: THREE.Vector3,
      p3: THREE.Vector3,
      t: number,
    ) => {
      const s = 1 - t;
      const a = s * s * s;
      const b = 3 * s * s * t;
      const c = 3 * s * t * t;
      const d = t * t * t;
      return out.set(
        a * p0.x + b * k1.x + c * k2.x + d * p3.x,
        a * p0.y + b * k1.y + c * k2.y + d * p3.y,
        a * p0.z + b * k1.z + c * k2.z + d * p3.z,
      );
    };

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const zOf = (i: number) => bazPoz[i * 3 + 2];

    /** Listeden koşulu sağlayan rastgele bir instance seç. */
    const sec = (liste: number[], kosul?: (i: number) => boolean) => {
      for (let d = 0; d < 48; d++) {
        const i = liste[(Math.random() * liste.length) | 0];
        if (!kosul || kosul(i)) return i;
      }
      return liste[(Math.random() * liste.length) | 0];
    };

    const SOL = 1;
    const SAG = 2;
    const UZAK = 0;

    type Olay = {
      kaynak: number;
      hedef: number;
      t: number;
      sure: number;
      bekle: number;
      faz: number;
      p0: THREE.Vector3;
      p3: THREE.Vector3;
      k1: THREE.Vector3;
      k2: THREE.Vector3;
      son: number;
    };

    const orn = new THREE.Vector3();

    /** Eğri okuma bandına giriyor mu? Uçlar duvarda (|x| büyük), orta önemli. */
    const yolTemiz = (o: Olay) => {
      for (let s = 1; s < 16; s++) {
        bez(orn, o.p0, o.k1, o.k2, o.p3, s / 16);
        if (bandIhlal(orn.x, orn.y, orn.z)) return false;
      }
      return true;
    };

    /**
     * Son çare: DÖRT kontrol noktasının da z'si bandın gerisinde. Bézier eğrisi
     * kontrol noktalarının konveks kabuğunu terk edemez; dolayısıyla eğrinin
     * hiçbir noktasında z > BAND.z olamaz — ihlal matematiksel olarak imkânsız.
     */
    const guvenliYol = (o: Olay) => {
      const derin = (i: number) => zOf(i) < BAND.z - 3;
      const sol = Math.random() < 0.5;
      o.kaynak = sec(duvarIdx[sol ? SOL : SAG], derin);
      o.hedef = sec(duvarIdx[sol ? SAG : SOL], derin);
      const n0 = new THREE.Vector3().fromArray(bazNorm, o.kaynak * 3);
      const n3 = new THREE.Vector3().fromArray(bazNorm, o.hedef * 3);
      o.p0.fromArray(bazPoz, o.kaynak * 3).addScaledVector(n0, CEK_DERIN + ACILMA);
      o.p3.fromArray(bazPoz, o.hedef * 3).addScaledVector(n3, CEK_DERIN + ACILMA);
      o.k1.copy(o.p0).addScaledVector(n0, rnd(3.2, 6.5));
      o.k2.copy(o.p3).addScaledVector(n3, rnd(3.2, 6.5));
      o.k1.y += rnd(-2.2, 2.6);
      o.k2.y += rnd(-2.2, 2.6);
      o.k1.z = Math.min(o.k1.z, BAND.z - rnd(3, 8));
      o.k2.z = Math.min(o.k2.z, BAND.z - rnd(3, 8));
    };

    /**
     * Çift seçimi yolu YAPISAL olarak banttan uzak tutar:
     *  A — karşı yan duvarlar, ikisi de derinde: eğri odayı sisin içinden geçer,
     *      metnin ARKASINDA kalır.
     *  B — aynı yan duvar, biri yakın biri uzak: eğri odaya taşar ama |x| büyük
     *      kalır; metnin ÖNÜNDEN, kenardan, iri ve yakın geçer.
     *  C — uzak duvarın iki ucu: eğri kameraya doğru şişer, yine derinde kalır.
     * Kontrol noktaları itilir; band temizse true döner, değilse REDDEDİLİR.
     */
    const yolDene = (o: Olay) => {
      const tip = Math.random();
      let kay: number;
      let hed: number;

      if (tip < 0.42) {
        // A — karşıdan karşıya, derin
        const sol = Math.random() < 0.5;
        const a = sol ? SOL : SAG;
        const b = sol ? SAG : SOL;
        kay = sec(duvarIdx[a], (i) => zOf(i) < -7);
        hed = sec(duvarIdx[b], (i) => zOf(i) < -7);
      } else if (tip < 0.78) {
        // B — aynı yan duvar boyunca, kenarda, kameraya yakın.
        // Kaynak kadrajın İÇİNDE kalmalı (kamera z=9): z>8 seçilirse çekmece
        // kameranın arkasında açılır, "nereden çıktı" okunmaz ve fiş jenerik
        // parçacığa düşer — fikrin tamamı bu okunurluğa bağlı.
        const a = Math.random() < 0.5 ? SOL : SAG;
        kay = sec(duvarIdx[a], (i) => zOf(i) > -1 && zOf(i) < 7);
        hed = sec(duvarIdx[a], (i) => zOf(i) < zOf(kay) - 11);
      } else {
        // C — uzak duvarın bir ucundan öbürüne
        kay = sec(duvarIdx[UZAK], (i) => bazPoz[i * 3] < -3);
        hed = sec(duvarIdx[UZAK], (i) => bazPoz[i * 3] > 3);
        if (Math.random() < 0.5) {
          const g = kay;
          kay = hed;
          hed = g;
        }
      }

      o.kaynak = kay;
      o.hedef = hed;

      const n0 = new THREE.Vector3().fromArray(bazNorm, kay * 3);
      const n3 = new THREE.Vector3().fromArray(bazNorm, hed * 3);
      o.p0.fromArray(bazPoz, kay * 3).addScaledVector(n0, CEK_DERIN + ACILMA);
      o.p3.fromArray(bazPoz, hed * 3).addScaledVector(n3, CEK_DERIN + ACILMA);

      const s1 = rnd(3.2, 6.5);
      const s2 = rnd(3.2, 6.5);
      o.k1.copy(o.p0).addScaledVector(n0, s1);
      o.k2.copy(o.p3).addScaledVector(n3, s2);
      // hafif dikey yay: fiş süzülüyor, ray üstünde gitmiyor
      o.k1.y += rnd(-2.2, 2.6);
      o.k2.y += rnd(-2.2, 2.6);

      // Güvenlik ağı: banda giren kontrol noktasını derinliğe it.
      for (let deneme = 0; deneme < 5; deneme++) {
        if (yolTemiz(o)) return true;
        if (bandIhlal(o.k1.x, o.k1.y, o.k1.z)) o.k1.z = BAND.z - rnd(2, 6);
        if (bandIhlal(o.k2.x, o.k2.y, o.k2.z)) o.k2.z = BAND.z - rnd(2, 6);
        o.k1.z -= 3.5;
        o.k2.z -= 3.5;
      }
      return yolTemiz(o);
    };

    const yolKur = (o: Olay) => {
      // ÖNCEDEN: 5 denemede temizlenmezse ihlalli yol yine de kullanılıyordu —
      // fiş başlığın üstünden geçebiliyordu. Artık ihlalli yol REDDEDİLİR;
      // hiçbir aday tutmazsa garantili derin yola düşülür.
      let tamam = false;
      for (let deneme = 0; deneme < 6 && !tamam; deneme++) tamam = yolDene(o);
      if (!tamam) guvenliYol(o);

      o.t = 0;
      o.sure = rnd(2.6, 4.2);
      o.bekle = rnd(0.4, 3.4);
      o.faz = Math.random() * 6.28;
      o.son = 0.9 + o.sure + 1.4 + o.bekle;
    };

    const olaylar: Olay[] = [];
    for (let i = 0; i < OLAY; i++) {
      const o: Olay = {
        kaynak: 0,
        hedef: 0,
        t: 0,
        sure: 3,
        bekle: 1,
        faz: 0,
        p0: new THREE.Vector3(),
        p3: new THREE.Vector3(),
        k1: new THREE.Vector3(),
        k2: new THREE.Vector3(),
        son: 6,
      };
      yolKur(o);
      // havuzu yay: hepsi aynı anda açılmasın
      o.t = (i / OLAY) * o.son;
      olaylar.push(o);
    }

    // ---- Olay çizimi ------------------------------------------------------
    const KAY_AC = 0;
    const AC_SURE = 0.75;
    const FIS_T0 = 0.9;

    const acikluk = (o: Olay, kaynakMi: boolean) => {
      if (kaynakMi) {
        const kapa = FIS_T0 + o.sure * 0.4;
        return kis(rampa(o.t, KAY_AC, AC_SURE) - rampa(o.t, kapa, 0.85));
      }
      const ac = FIS_T0 + o.sure * 0.5;
      const kapa = FIS_T0 + o.sure + 0.45;
      return kis(rampa(o.t, ac, AC_SURE) - rampa(o.t, kapa, 0.85));
    };

    const c1 = new THREE.Color();
    const sonumV = new THREE.Vector3(); // sisSonum ölçümü — kare başına ayırma yok
    const p = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const teget = new THREE.Vector3();
    const xEks = new THREE.Vector3();
    const yEks = new THREE.Vector3();
    const zEks = new THREE.Vector3();
    const rotM = new THREE.Matrix4();

    /** Astar + taşma: çekmecenin arkasındaki nane. Oda'nın tek renk kaynağı. */
    const isikYaz = (slot: number, cekIdx: number, acik: number) => {
      if (acik < 0.002) {
        astarlar.setMatrixAt(slot, sifir);
        tasmalar.setMatrixAt(slot, sifir);
        return;
      }
      uV.fromArray(bazBaz, cekIdx * 9);
      vV.fromArray(bazBaz, cekIdx * 9 + 3);
      nV.fromArray(bazBaz, cekIdx * 9 + 6);
      const fg = bazOlcek[cekIdx * 2];
      const fy = bazOlcek[cekIdx * 2 + 1];
      yardimciV.fromArray(bazPoz, cekIdx * 3);

      // astar: duvar yüzeyinde, yüzden hafif küçük (kapalıyken görünmesin)
      m4.makeBasis(uV, vV, nV);
      m4.multiply(olcekM.makeScale(fg * 0.97, fy * 0.97, 1));
      m4.setPosition(
        yardimciV.x + nV.x * 0.008,
        yardimciV.y + nV.y * 0.008,
        yardimciV.z + nV.z * 0.008,
      );
      astarlar.setMatrixAt(slot, m4);
      c1.copy(RENK_KOVUK).lerp(RENK_ASTAR, yumusa(acik));
      astarlar.setColorAt(slot, c1);

      // taşma: açık çekmecenin önünde yüzen hale
      const td = CEK_DERIN + ACILMA * 0.75;
      const tx = yardimciV.x + nV.x * td;
      const ty = yardimciV.y + nV.y * td;
      const tz = yardimciV.z + nV.z * td;
      m4.makeBasis(uV, vV, nV);
      m4.multiply(olcekM.makeScale(fg * 3.4, fy * 3.8, 1));
      m4.setPosition(tx, ty, tz);
      tasmalar.setMatrixAt(slot, m4);
      const tSonum = sisSonum(
        kamera.position.distanceTo(sonumV.set(tx, ty, tz)),
        sisYog,
      );
      c1.copy(RENK_ASTAR)
        .lerp(RENK_ISIK, 0.45)
        .multiplyScalar(acik * acik * 0.85 * tSonum);
      tasmalar.setColorAt(slot, c1);
    };

    /** Fişi bezier üstünde konumlandır + çırpınma. */
    const fisYaz = (slot: number, o: Olay, ilerleme: number) => {
      if (ilerleme <= 0 || ilerleme >= 1) {
        fisler.setMatrixAt(slot, sifir);
        fisIsiklari.setMatrixAt(slot, sifir);
        return;
      }
      const e = yumusa(ilerleme);
      bez(p, o.p0, o.k1, o.k2, o.p3, e);
      bez(p2, o.p0, o.k1, o.k2, o.p3, Math.min(e + 0.02, 1));
      teget.subVectors(p2, p).normalize();
      if (teget.lengthSq() < 0.0001) teget.set(1, 0, 0);

      // Kartın yüzü kameraya dönük dursun, gövdesi gidiş ekseninde uzansın.
      zEks.subVectors(kamera.position, p).normalize();
      xEks.copy(teget);
      yEks.crossVectors(zEks, xEks).normalize();
      if (yEks.lengthSq() < 0.0001) yEks.set(0, 1, 0);
      zEks.crossVectors(xEks, yEks).normalize();

      // çırpınma: gidiş ekseni etrafında sallanma — kâğıt kendini gösterip saklar
      const cirp = Math.sin(o.t * 7.5 + o.faz) * 0.55 * Math.sin(Math.PI * e);
      m4.makeBasis(xEks, yEks, zEks);
      m4.multiply(rotM.makeRotationX(cirp));
      m4.multiply(olcekM.makeScale(FIS_G, FIS_Y, 1));
      m4.setPosition(p);
      fisler.setMatrixAt(slot, m4);

      // Hale kartın ARKASINDA durur. Kartla aynı noktada dururken hale saydam
      // olduğu için karttan SONRA çiziliyordu ve eşit derinlikte depth testi
      // geçip en parlak merkezini kartın yüzüne boyuyordu: cetvel çizgileri
      // siliniyor, kart "parlayan benek"e düşüyordu — kaçmamız gereken tuzak.
      // Kartın arkasına itilince kendi silüeti merkezi kesiyor, dışarıda
      // yalnızca ince bir ışık kenarı kalıyor: kart kart olarak okunuyor.
      const sonme = Math.sin(Math.PI * kis(ilerleme));
      m4.makeBasis(xEks, yEks, zEks);
      m4.multiply(olcekM.makeScale(FIS_G * 2.1, FIS_Y * 2.6, 1));
      m4.setPosition(
        p.x - zEks.x * 0.09,
        p.y - zEks.y * 0.09,
        p.z - zEks.z * 0.09,
      );
      fisIsiklari.setMatrixAt(slot, m4);
      c1.copy(RENK_ASTAR)
        .lerp(RENK_ISIK, 0.4)
        .multiplyScalar(
          0.3 * sonme * sisSonum(kamera.position.distanceTo(p), sisYog),
        );
      fisIsiklari.setColorAt(slot, c1);
    };

    const kareYaz = (dt: number) => {
      for (let i = 0; i < OLAY; i++) {
        const o = olaylar[i];
        o.t += dt;
        if (o.t > o.son) yolKur(o);

        const ak = acikluk(o, true);
        const ah = acikluk(o, false);
        cekmeceYaz(o.kaynak, ak);
        cekmeceYaz(o.hedef, ah);
        isikYaz(i * 2, o.kaynak, ak);
        isikYaz(i * 2 + 1, o.hedef, ah);
        fisYaz(i, o, (o.t - FIS_T0) / o.sure);
      }
      cekmeceler.instanceMatrix.needsUpdate = true;
      kulplar.instanceMatrix.needsUpdate = true;
      astarlar.instanceMatrix.needsUpdate = true;
      tasmalar.instanceMatrix.needsUpdate = true;
      fisler.instanceMatrix.needsUpdate = true;
      fisIsiklari.instanceMatrix.needsUpdate = true;
      if (astarlar.instanceColor) astarlar.instanceColor.needsUpdate = true;
      if (tasmalar.instanceColor) tasmalar.instanceColor.needsUpdate = true;
      if (fisIsiklari.instanceColor) fisIsiklari.instanceColor.needsUpdate = true;
    };

    // ---- Kamera: birkaç derece salınım + ince işaretçide parallax ----------
    const fare = { x: 0, y: 0 };
    const hedefF = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedefF.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedefF.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba) {
      window.addEventListener("pointermove", fareOynat, { passive: true });
    }

    const bak = new THREE.Vector3();
    const kameraYaz = (t: number) => {
      fare.x += (hedefF.x - fare.x) * 0.035;
      fare.y += (hedefF.y - fare.y) * 0.035;
      kamera.position.set(
        Math.sin(t * 0.11) * 0.85 + fare.x * 1.1,
        Math.sin(t * 0.083 + 1.3) * 0.6 - fare.y * 0.8,
        9 + Math.sin(t * 0.062) * 0.5,
      );
      bak.set(
        Math.sin(t * 0.07 + 0.6) * 1.1 + fare.x * 1.6,
        Math.sin(t * 0.055) * 0.7 - fare.y * 1.2,
        -D2,
      );
      kamera.lookAt(bak);
    };

    // ---- Döngü: IO + visibilitychange ile duraklat ------------------------
    let id = 0;
    let gorunur = true;
    let calisiyor = false;
    let baglamVar = true;
    const saat = new THREE.Clock();

    const ciz = () => {
      const dt = Math.min(saat.getDelta(), 0.05);
      kareYaz(dt);
      kameraYaz(saat.elapsedTime);
      cizer.render(sahne, kamera);
      id = requestAnimationFrame(ciz);
    };

    const basla = () => {
      if (calisiyor || statik || !baglamVar) return;
      calisiyor = true;
      saat.getDelta();
      id = requestAnimationFrame(ciz);
    };
    const dur = () => {
      calisiyor = false;
      cancelAnimationFrame(id);
    };

    // Statik base katman: reduced-motion'da rAF HİÇ başlamaz. Önce bu kurulur —
    // olayları hikâyenin okunduğu ana sabitle: çekmeceler açık, fişler yolda.
    if (statik) {
      olaylar.forEach((o, i) => {
        o.t = FIS_T0 + o.sure * (0.4 + i * 0.09);
      });
      kareYaz(0);
      kameraYaz(0);
      cizer.render(sahne, kamera);
    }

    // Bağlam kaybı (sekme baskısı / GPU sıfırlama): döngüyü durdur, geri
    // gelince devam et. Yoksa kayıp bağlama çizmeye çalışıp konsolu doldururuz.
    const baglamGitti = (e: Event) => {
      e.preventDefault();
      baglamVar = false;
      dur();
    };
    const baglamDondu = () => {
      baglamVar = true;
      if (gorunur && !document.hidden) basla();
    };
    cizer.domElement.addEventListener("webglcontextlost", baglamGitti);
    cizer.domElement.addEventListener("webglcontextrestored", baglamDondu);

    const io = new IntersectionObserver(
      ([g]) => {
        gorunur = g.isIntersecting;
        if (gorunur && !document.hidden && baglamVar) basla();
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
      sisAyarla();
      cizer.setSize(kap.clientWidth, kap.clientHeight);
      if (statik) cizer.render(sahne, kamera);
    };
    const ro = new ResizeObserver(boyutla);
    ro.observe(kap);

    return () => {
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", fareOynat);
      cizer.domElement.removeEventListener("webglcontextlost", baglamGitti);
      cizer.domElement.removeEventListener(
        "webglcontextrestored",
        baglamDondu,
      );
      [
        kabukGeo,
        cekGeo,
        kulpGeo,
        astarGeo,
        tasmaGeo,
        fisGeo,
        fisIsikGeo,
      ].forEach((g) => g.dispose());
      [
        kabukMat,
        cekMat,
        kulpMat,
        astarMat,
        tasmaMat,
        fisMat,
        fisIsikMat,
      ].forEach((m) => m.dispose());
      yuzDoku?.dispose();
      tasmaDoku?.dispose();
      fisDoku?.dispose();
      [
        kabuk,
        cekmeceler,
        kulplar,
        astarlar,
        tasmalar,
        fisler,
        fisIsiklari,
      ].forEach((m) => m.dispose());
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className="odaKap" aria-hidden="true" />;
}

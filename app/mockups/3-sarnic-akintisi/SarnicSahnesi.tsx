"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  DALGA_GLSL,
  DURGUN_CEPHE,
  DURGUN_T,
  YON,
  cepheler,
  suKabarmasi,
} from "./dalga";

/*
 * SARNIÇ AKINTISI
 * ---------------------------------------------------------------------------
 * Kamera aydınlık bir sarnıcın orta koridorunda, göz hizasında duruyor.
 * Sütunlar sola ve sağa simetrik açılıyor; en yakın iki sütun sahneyi
 * proscenium gibi çerçeveliyor. Koridorun ortası TANIMI GEREĞİ boş ve sisin
 * içinde en soluk yer — metin oraya oturuyor. Perde/scrim yok: okunabilirlik
 * sahnenin kendi ışık yapısından geliyor.
 *
 * Neden "Yerebatan stok fotoğrafı" değil (bilinçli sapmalar):
 *   · Karanlık + turuncu alttan aydınlatma yerine yüksek anahtarlı, soğuk,
 *     beyaza boğulmuş bir hacim. Turistik sarnıç görüntüsünün tam tersi.
 *   · Tavan/tonoz YOK: sütunlar ışığın içinde eriyip bitiyor. İmkânsız mimari.
 *   · Süslü başlık, Medusa, kemer YOK. Sütun = çıplak dikey vuruş.
 *   · God-ray / ışık huzmesi YOK (zaten reddedilmiş fikirler arasında).
 *
 * Dalga halka değil CEPHE: tek yönlü bir kabarma sütunların arasından
 * yanlamasına geçiyor, hiçbirinde durmuyor. Bkz. ./dalga.ts
 */

// ---- palet (IG referansı, birebir kopya değil: tek hue ailesi + beyaz) ----
const SIS = "#dfeff2"; // hava / sonsuz mesafe
// Taşın ağırlığı olmalı: ilk denemede palet çok açıktı ve sütunlar taş değil
// buzdan borular gibi okunuyordu. Yakın sütunlar (proscenium) gerçek değer
// ağırlığı taşır; uzaktakileri zaten sis yıkıyor.
const TAS_ACIK = "#e7f4f6";
const TAS_ORTA = "#8dbec9";
const TAS_KOYU = "#5b8d9c";
const UST_ISIK = "#e9f7f9"; // sütun tepelerinin karıştığı ışık
const SU_SEKME = "#cdf2ea"; // sudan sütun dibine sekmiş nane
// Su gövdesi bilinçli olarak KOYU: sarnıç derindir, ışığı yutar. Aynı zamanda
// kompozisyonun tek değer çapası — kadrajın alt bandı buradan ağırlık alıyor,
// üstteki sis ise başlığa zemin oluyor. İlk render'da bu renkler daha açıktı ve
// su sisi yansıtmaktan "süt" gibi çıkıyordu: ne ayna okunuyordu ne de üstündeki
// açık disiplin şeridi. Koyu teal ailenin içinde (doygun cyan'a kaçmadan).
const SU_YATIK = "#1e6a70"; // yatık bakışta su gövdesi
const SU_DIK = "#052f36"; // dik bakışta derinlik
const SIRT_ISIK = "#e6fbff";

// ---- ızgara: bilinçli olarak DİKDÖRTGEN (çember/yörünge yok) --------------
const SUTUN_X = [-15.6, -10.2, -5.0, 5.0, 10.2, 15.6]; // ortada 10 birimlik koridor
const SATIR_SAYI = 10;
const ILK_Z = 8;
const SATIR_ARA = 6.4;
const SUTUN_BOY = 11.2;
const IC_X = 5.0;

const KAMERA_Y = 1.75;
const EGIM_DER = 5; // yukarı bakış: su çizgisi kadrajın alt üçte birine iner

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

/**
 * Kadraj: dikey FOV en-boya göre açılır ama sınırlanır; kamera, en yakın iç
 * sütun kadrajın kenarına yakın düşecek kadar geri çekilir. Sis yoğunluğu bu
 * mesafeye göre ölçeklenir → dar ekranda da sisin "bakışı" birebir aynı kalır.
 */
function cerceve(aspect: number) {
  const yatayYari = Math.tan(THREE.MathUtils.degToRad(41));
  const fov = THREE.MathUtils.clamp(
    THREE.MathUtils.radToDeg(2 * Math.atan(yatayYari / Math.max(aspect, 0.3))),
    46,
    76,
  );
  const yariH = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const yariW = yariH * aspect;
  const mesafe = THREE.MathUtils.clamp(IC_X / (0.8 * yariW), 6.5, 26);
  return {
    fov,
    kameraZ: ILK_Z + mesafe,
    sisYogunluk: 0.034 * (7.2 / mesafe),
  };
}

/** Zemin/gök: son derece hafif dikey gradyan. Delta küçük tutuluyor, yoksa
 *  tamamen sise gömülmüş geometri arka planda dikdörtgen leke gibi görünür. */
function arkaPlanDokusu() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#e9f7f9");
  g.addColorStop(0.46, SIS);
  g.addColorStop(0.62, SIS);
  g.addColorStop(1, "#d2e7ec");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type Props = {
  /** Alt şeritteki disiplinlerin dünya-x konumları (dalga fazını örneklemek için). */
  ornekX: readonly number[];
  /** Her karede disiplin başına 0..1 ışık değeri. setState YOK — doğrudan DOM. */
  bildir?: (isik: number[]) => void;
  sinif?: string;
};

export function SarnicSahnesi({ ornekX, bildir, sinif }: Props) {
  const kapRef = useRef<HTMLDivElement>(null);
  const bildirRef = useRef(bildir);
  bildirRef.current = bildir;
  const ornekRef = useRef(ornekX);
  ornekRef.current = ornekX;

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)");
    const kabaIsaret = window.matchMedia("(pointer: coarse)");
    const statik = azHareket.matches;
    const kaba = kabaIsaret.matches;

    // ---- kurulum ---------------------------------------------------------
    const sahne = new THREE.Scene();
    const sisRengi = new THREE.Color(SIS);
    const k0 = cerceve(Math.max(kap.clientWidth, 1) / Math.max(kap.clientHeight, 1));
    sahne.fog = new THREE.FogExp2(sisRengi.getHex(), k0.sisYogunluk);
    const arkaPlan = arkaPlanDokusu();
    sahne.background = arkaPlan ?? sisRengi;

    const kamera = new THREE.PerspectiveCamera(k0.fov, 1, 0.1, 260);
    kamera.position.set(0, KAMERA_Y, k0.kameraZ);
    // lookAt yok: eğim sabit → su çizgisi kadrajda çivilenmiş kalır, fare
    // parallaksı yalnız konumu oynatır. Metin bloğu asla suya taşmaz.
    kamera.rotation.set(THREE.MathUtils.degToRad(EGIM_DER), 0, 0);

    const cizer = new THREE.WebGLRenderer({
      antialias: !kaba, // dokunmatikte AA kapalı
      powerPreference: "high-performance",
    });
    // DPR tavanı — kural ≤2; ikinci render pass'i (yansıma) yüzünden daha da sıkı.
    const dprTavan = kaba ? 1.5 : 1.75;
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, dprTavan));
    cizer.setSize(kap.clientWidth, kap.clientHeight);
    kap.appendChild(cizer.domElement);

    const yon = new THREE.Vector2(YON[0], YON[1]);
    const cephe = new THREE.Vector2(DURGUN_CEPHE[0], DURGUN_CEPHE[1]);

    // ---- sütunlar: tek InstancedMesh ------------------------------------
    // Gövde açık uçlu (dibi kaidenin içinde), kaide suyun altından çıkıyor.
    const govde = new THREE.CylinderGeometry(0.5, 0.6, SUTUN_BOY, 26, 1, true);
    govde.translate(0, SUTUN_BOY / 2 + 0.1, 0);
    const kaide = new THREE.CylinderGeometry(0.74, 0.88, 0.9, 26, 1, false);
    kaide.translate(0, -0.25, 0); // üstü y≈0.2, altı y≈-0.7 → su altında biter
    const sutunGeo = mergeGeometries([govde, kaide]);
    govde.dispose();
    kaide.dispose();

    const adet = SUTUN_X.length * SATIR_SAYI;
    const rnd = mulberry32(20260715);
    const tohumlar = new Float32Array(adet);
    const boylar = new Float32Array(adet);
    const gecici = new THREE.Object3D();

    const sutunMat = new THREE.ShaderMaterial({
      fog: true, // ShaderMaterial'da fog varsayılan false; uniform'ları da elle veriyoruz
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uT: { value: DURGUN_T },
          uYon: { value: new THREE.Vector2() },
          uCephe: { value: new THREE.Vector2() },
          uTasAcik: { value: new THREE.Color(TAS_ACIK) },
          uTasOrta: { value: new THREE.Color(TAS_ORTA) },
          uTasKoyu: { value: new THREE.Color(TAS_KOYU) },
          uUstIsik: { value: new THREE.Color(UST_ISIK) },
          uSuSekme: { value: new THREE.Color(SU_SEKME) },
          uTepe: { value: SUTUN_BOY },
        },
      ]),
      vertexShader: /* glsl */ `
        attribute float aTohum;
        attribute float aBoy;
        varying vec3 vN;
        varying vec3 vDunya;
        varying vec3 vYerel;
        varying float vTohum;
        varying float vDerinlik;

        #include <common>
        #include <fog_pars_vertex>

        void main() {
          vTohum = aTohum;
          vec3 yerel = position;
          yerel.y *= aBoy;          // boy oynaması: normaller dikey silindirde etkilenmez
          vYerel = yerel;
          vec4 dunya = modelMatrix * instanceMatrix * vec4(yerel, 1.0);
          vDunya = dunya.xyz;
          vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          vec4 mvPosition = viewMatrix * dunya;
          vDerinlik = -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uT;
        uniform vec2 uYon;
        uniform vec2 uCephe;
        uniform vec3 uTasAcik;
        uniform vec3 uTasOrta;
        uniform vec3 uTasKoyu;
        uniform vec3 uUstIsik;
        uniform vec3 uSuSekme;
        uniform float uTepe;

        varying vec3 vN;
        varying vec3 vDunya;
        varying vec3 vYerel;
        varying float vTohum;
        varying float vDerinlik;

        #include <common>
        #include <fog_pars_fragment>
        ${DALGA_GLSL}

        // 3B değer gürültüsü — mermer damarı + sıva greni. Doku dosyası yok.
        float hash31(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float gurultu3(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
                         mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                         mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
        }

        void main() {
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vDunya);

          // --- taş greni ---
          // Damar frekansı çevrede yüksek, dikeyde çok düşük (gp.y * 0.30):
          // izo-eğrileri uzun DİKEY çizgilere dönüşüyor → yıpranmış sıva/mermer.
          // İlk denemede frekans çok düşük + genlik çok küçüktü, sütunlar
          // pürüzsüz plastik gibi çıkıyordu. Oluk (fluting) bilinçli olarak yok:
          // klasik tapınak/turistik sarnıç okumasına kaçıyor.
          vec3 gp = vYerel + vec3(vTohum * 31.7, vTohum * 12.3, vTohum * 57.1);
          float damar = gurultu3(vec3(gp.x * 7.0, gp.y * 0.30, gp.z * 7.0)) * 0.55
                      + gurultu3(vec3(gp.x * 15.0, gp.y * 0.75, gp.z * 15.0)) * 0.30
                      + gurultu3(gp * 9.0) * 0.15;
          damar = damar * 2.0 - 1.0;
          float yakin = 1.0 - smoothstep(6.0, 24.0, vDerinlik);
          float tane = (gurultu3(gp * 46.0) - 0.5) * 0.14 * yakin;

          // --- ışık: yönlü lamba değil, her yanı saran parlak sis ---
          // Silüet kenarları çevredeki ışığı topluyor → kenar açık, göbek orta.
          // Yüksek anahtarlı hacimde silindiri "yuvarlak" yapan şey bu.
          float kenar = 1.0 - abs(dot(N, V));
          float gok = N.y * 0.5 + 0.5;
          float key = max(dot(N, normalize(vec3(-0.42, 0.72, 0.55))), 0.0);

          vec3 col = mix(uTasOrta, uTasAcik, pow(clamp(kenar, 0.0, 1.0), 2.0));
          col = mix(col, uTasKoyu, (1.0 - gok) * 0.22);
          col += uTasAcik * key * 0.14;
          col *= 1.0 + damar * 0.16 + tane;

          // --- suya değme: temas kararması + sudan sekmiş nane ---
          col = mix(col * 0.80, col, smoothstep(0.0, 2.6, vDunya.y));
          col = mix(col, col * uSuSekme, (1.0 - smoothstep(0.0, 3.4, vDunya.y)) * 0.35);

          // --- dalga: dipte ince aydınlık bant. Kostik DEĞİL, düz emissive ramp.
          // Kabarma her sütunu sırayla geçerken dipleri sırayla aydınlanır.
          float h = suAlani(vDunya.xz, uYon, uCephe, uT, 0.35);
          float bant = exp(-max(vDunya.y, 0.0) / 1.15);
          col += uUstIsik * bant * smoothstep(0.20, 1.30, h) * 0.34;

          // --- tepe: tavan yok, ışık var. Sütunlar yukarıda ışığa karışıp biter.
          col = mix(col, uUstIsik, smoothstep(uTepe * 0.45, uTepe * 1.02, vDunya.y) * 0.92);

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });

    const sutunlar = new THREE.InstancedMesh(sutunGeo, sutunMat, adet);
    let n = 0;
    for (let s = 0; s < SATIR_SAYI; s++) {
      for (let i = 0; i < SUTUN_X.length; i++) {
        // hafif jitter + eğim: kusursuz klon dizisi CG kokar, oturmuş yapı değil
        gecici.position.set(
          SUTUN_X[i] + (rnd() - 0.5) * 0.4,
          0,
          ILK_Z - s * SATIR_ARA + (rnd() - 0.5) * 0.4,
        );
        gecici.rotation.set(
          (rnd() - 0.5) * 0.016,
          rnd() * Math.PI * 2,
          (rnd() - 0.5) * 0.016,
        );
        gecici.scale.setScalar(1);
        gecici.updateMatrix();
        sutunlar.setMatrixAt(n, gecici.matrix);
        tohumlar[n] = rnd();
        boylar[n] = 0.94 + rnd() * 0.12;
        n++;
      }
    }
    sutunGeo.setAttribute("aTohum", new THREE.InstancedBufferAttribute(tohumlar, 1));
    sutunGeo.setAttribute("aBoy", new THREE.InstancedBufferAttribute(boylar, 1));
    sutunlar.instanceMatrix.needsUpdate = true;
    sutunlar.computeBoundingSphere();
    sahne.add(sutunlar);

    // ---- su: gerçek ayna (ikinci render pass'i) --------------------------
    // DİKKAT: geometriyi döndürmek YASAK. Reflector ayna düzleminin normalini
    // MESH'in dünya döndürmesinden (+Z) türetiyor; geometriyi döndürürsek
    // matrixWorld birim kalır, normal (0,0,1) sanılır ve sahne yanlış düzlemde
    // aynalanır. Döndürme mesh'in üstünde olmalı.
    const suGeo = new THREE.PlaneGeometry(260, 260);

    const suShader = {
      name: "SarnicSuyu",
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          color: { value: null },
          tDiffuse: { value: null },
          textureMatrix: { value: null },
          uT: { value: DURGUN_T },
          uYon: { value: new THREE.Vector2() },
          uCephe: { value: new THREE.Vector2() },
          uGenlik: { value: 0.14 },
          // Çarpıtma düşük tutuluyor: yüksek değerde yansıma dağılıp su
          // "birikinti" gibi oluyor, ayna okuması ölüyor. Matte/ayna sınırında
          // kal — kostiğe bir adım mesafedeyiz.
          // 0.75 render'da hâlâ şeritliyordu (asıl suçlu gürültünün anizotropisiydi,
          // bkz. dalga.ts) — sırtlar düzeltildikten sonra kabarmanın öteleme gücü
          // korunsun diye burada sadece bir tık geri alındı.
          uCarpitma: { value: 0.65 },
          uYatik: { value: new THREE.Color(SU_YATIK) },
          uDik: { value: new THREE.Color(SU_DIK) },
          uSirt: { value: new THREE.Color(SIRT_ISIK) },
        },
      ]),
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix;
        varying vec4 vUv;
        varying vec3 vDunya;
        varying float vDerinlik;
        #include <common>
        #include <fog_pars_vertex>
        void main() {
          vUv = textureMatrix * vec4(position, 1.0);
          vDunya = (modelMatrix * vec4(position, 1.0)).xyz;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vDerinlik = -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 color;
        uniform sampler2D tDiffuse;
        uniform float uT;
        uniform vec2 uYon;
        uniform vec2 uCephe;
        uniform float uGenlik;
        uniform float uCarpitma;
        uniform vec3 uYatik;
        uniform vec3 uDik;
        uniform vec3 uSirt;

        varying vec4 vUv;
        varying vec3 vDunya;
        varying float vDerinlik;

        #include <common>
        #include <fog_pars_fragment>
        ${DALGA_GLSL}

        void main() {
          vec2 p = vDunya.xz;
          // uzakta dalga piksel altına düşer → türev aliasing yapar. Detay LOD'u.
          float lod = 1.0 - smoothstep(14.0, 46.0, vDerinlik);
          float mikroPay = 1.0 - smoothstep(6.0, 26.0, vDerinlik);

          float e = 0.3;
          float h  = suAlani(p, uYon, uCephe, uT, mikroPay);
          float hx = suAlani(p + vec2(e, 0.0), uYon, uCephe, uT, mikroPay);
          float hz = suAlani(p + vec2(0.0, e), uYon, uCephe, uT, mikroPay);
          vec2 egim = ((vec2(hx, hz) - h) / e) * uGenlik * lod;

          vec3 N = normalize(vec3(-egim.x, 1.0, -egim.y));
          vec3 V = normalize(cameraPosition - vDunya);
          float nv = clamp(dot(N, V), 0.0, 1.0);

          // Fresnel: göz hizasında suyun çoğu yatık → ayna. Dibe bakınca gövde.
          // Tavan 0.98'den indirildi: 0.98'de görünür suyun tamamı neredeyse saf
          // yansımaya dönüyordu ve yansıttığı şey SOLUK SİS olduğu için su
          // "açık gri-teal süt" gibi çıkıyordu. Sonuç: kadrajın alt üçte biri
          // sahnenin EN KOYU yeri olacağına en soluk ikinci yeri oluyordu ve
          // üstüne binen açık disiplin şeridi okunmuyordu. Tavanı indirmek
          // gövde rengini geri çağırıyor → su derinleşiyor, ayna KONTRASTLA
          // okunuyor (koyu suda açık sütun yansıması), şerit zemin buluyor.
          float ayna = mix(0.04, 0.82, pow(1.0 - nv, 3.4));

          // Yansımayı yüzey eğimiyle ötele. Ufka doğru w patlar → sınırla.
          vec2 kaydir = egim * uCarpitma * min(vUv.w, 26.0);
          vec3 yansima = texture2DProj(tDiffuse, vec4(vUv.xy + kaydir, vUv.zw)).rgb;

          vec3 govde = mix(uDik, uYatik, nv);
          // Soğurma: yansıyan ışık suyun gövdesinden geçip dönüyor, saf çıkmıyor.
          // Yansımayı gövdeye doğru hafifçe boyamak sisin sütü suyu yıkamasını
          // engelliyor; koyu teal ailesinde kalıyoruz (doygun cyan'a kaçmıyor).
          yansima = mix(yansima, yansima * uYatik * 2.55, 0.30);
          vec3 col = mix(govde, yansima, ayna);

          // Sırtta çok hafif aydınlık: köpük/kostik DEĞİL, sadece eğimin ipucu.
          col += uSirt * smoothstep(0.6, 1.5, h) * 0.05 * lod;

          gl_FragColor = vec4(col * color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    };

    const yansimaOlcek = kaba ? 0.4 : 0.5; // yarı çözünürlük: ikinci pass'in bedeli
    const dpr = cizer.getPixelRatio();
    const su = new Reflector(suGeo, {
      clipBias: 0.004,
      textureWidth: Math.max(2, Math.round(kap.clientWidth * dpr * yansimaOlcek)),
      textureHeight: Math.max(2, Math.round(kap.clientHeight * dpr * yansimaOlcek)),
      color: 0xffffff,
      multisample: kaba ? 0 : 2,
      shader: suShader,
    });
    su.rotation.x = -Math.PI / 2; // normal (0,1,0) → ayna düzlemi y=0
    const suMat = su.material as THREE.ShaderMaterial;
    suMat.fog = true; // Reflector kendi materyalini kurar; fog'u sonradan açıyoruz
    sahne.add(su);

    // uniform referansları (UniformsUtils.merge klonladığı için materyalden al)
    const sU = suMat.uniforms;
    const cU = sutunMat.uniforms;
    sU.uYon.value.copy(yon);
    cU.uYon.value.copy(yon);

    const cepheYaz = () => {
      sU.uCephe.value.copy(cephe);
      cU.uCephe.value.copy(cephe);
    };
    cepheYaz();

    // ---- fare parallaksı: yalnız ince işaretçi, hareket açıkken ----------
    const fare = { x: 0, y: 0 };
    const hedef = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedef.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedef.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba) {
      window.addEventListener("pointermove", fareOynat, { passive: true });
    }

    // ---- şeridin ışığı: aynı dalga alanı, CPU tarafı ---------------------
    const isikGonder = (c: readonly [number, number]) => {
      const f = bildirRef.current;
      if (!f) return;
      f(
        ornekRef.current.map((x) => {
          const h = suKabarmasi(x, -6, c);
          return THREE.MathUtils.clamp((h - 0.15) / 1.1, 0, 1);
        }),
      );
    };

    // ---- döngü: IO + visibilitychange ile duraklat -----------------------
    let id = 0;
    let gorunur = false;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const ciz = () => {
      const t = saat.getElapsedTime();
      const c = cepheler(t);
      cephe.set(c[0], c[1]);
      cepheYaz();
      sU.uT.value = t;
      cU.uT.value = t;

      fare.x += (hedef.x - fare.x) * 0.045;
      fare.y += (hedef.y - fare.y) * 0.045;
      kamera.position.x = fare.x * 0.85;
      // nefes: donmuş render hissini kıran, neredeyse görünmez bir salınım
      kamera.position.y = KAMERA_Y - fare.y * 0.35 + Math.sin(t * 0.25) * 0.045;

      cizer.render(sahne, kamera);
      isikGonder(c);
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

    // reduced-motion BASE katman: rAF hiç başlamaz, tek statik kare çizilir.
    // Sahne yine ayna gibi durur, kabarma koridorun ortasında donar.
    const tekKare = () => {
      cizer.render(sahne, kamera);
      isikGonder(DURGUN_CEPHE);
    };
    if (statik) tekKare();

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
      (sahne.fog as THREE.FogExp2).density = k.sisYogunluk;
      cizer.setSize(w, h);
      const d = cizer.getPixelRatio();
      su.getRenderTarget().setSize(
        Math.max(2, Math.round(w * d * yansimaOlcek)),
        Math.max(2, Math.round(h * d * yansimaOlcek)),
      );
      if (statik) tekKare();
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
      sutunGeo.dispose();
      sutunMat.dispose();
      suGeo.dispose();
      su.dispose(); // render target + materyal
      arkaPlan?.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

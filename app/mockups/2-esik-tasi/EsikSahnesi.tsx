"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { tasDokusu, glowDokusu } from "./tasDokusu";
import {
  ASINMA_FRAG,
  QUAD_VERT,
  TAS_VERT,
  TAS_FRAG,
  GOK_VERT,
  GOK_FRAG,
  SOVE_VERT,
  SOVE_FRAG,
} from "./shaderlar";

/*
 * EŞİK — yüzyıllardır üstünden geçilmiş bir mermer eşik.
 *
 * Tek fikir: ışık da trafik de AYNI kapıdan geçiyor. Bu yüzden aydınlık kama
 * ile aşınmış havuz aynı sebepten aynı yerde. Metin havuzun içinde duruyor,
 * yani binlerce kişinin bastığı yerde. Okunabilirlik bir perdeden değil,
 * roughness'tan geliyor: cilalı taş kapıyı aynalıyor, pürüzlü taş saçıyor.
 *
 * Geçenlerin gövdesi YOK — sadece gölgeleri ve bıraktıkları aşınma var.
 */

const DER = Math.PI / 180;

// Aşınma alanı (eşik apronu) ve altındaki büyük zemin.
const EN = 52;
const BOY = 44;
const DUZ_EN = 130;
const DUZ_BOY = 340;
const DUZ_KAYMA = 148; // yerel +Y → dünya -Z; düzlem z ∈ [+22, -318]

const KAPI_Z = -6;
const KAPI_X = 6.4;
const ISIK_EGIM = 0.0505;

const KAM_Y = 2.4;
const KAM_Z = 12.6;
const KAM_PITCH = 12.0 * DER;

const FIRCA_MAX = 24;
const FIRCA_R = 2.2;
const ADIM = 1.7; // dünya birimi
const GECEN_MAX = 4;

const sr = (h: string) => new THREE.Color(h).convertSRGBToLinear();

type Gecen = {
  t: number;
  hiz: number;
  yon: number; // +1 dışarı, -1 içeri
  xYakin: number;
  xKapi: number;
  xUzak: number;
  sonAdim: number;
  ayak: number;
  canli: boolean;
};

const kar = (a: number, b: number, t: number) => a + (b - a) * t;
const yum = (t: number) => t * t * (3 - 2 * t);

/** Yol: yakın (içerisi) → kapı (darboğaz) → uzak (dışarısı). Herkes kapıdan geçer. */
function yolNoktasi(g: Gecen, t: number): [number, number] {
  const z = 25 - t * 50;
  const tk = (25 - KAPI_Z) / 50; // kapının bulunduğu t
  const x =
    t < tk
      ? kar(g.xYakin, g.xKapi, yum(t / tk))
      : kar(g.xKapi, g.xUzak, yum((t - tk) / (1 - tk)));
  return [x, z];
}

function yeniGecen(rnd: () => number): Gecen {
  const yon = rnd() < 0.5 ? 1 : -1;
  return {
    t: yon > 0 ? 0 : 1,
    hiz: 0.055 + rnd() * 0.045,
    yon,
    xYakin: (rnd() - 0.5) * 32,
    xKapi: (rnd() - 0.5) * 10,
    xUzak: (rnd() - 0.5) * 24,
    sonAdim: yon > 0 ? 0 : 1,
    ayak: 1,
    canli: true,
  };
}

export function EsikSahnesi() {
  const kapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)");
    const kaba = window.matchMedia("(pointer: coarse)");
    const statik = azHareket.matches;

    const cizer = new THREE.WebGLRenderer({
      antialias: !kaba.matches, // dokunmatikte AA kapalı
      powerPreference: "high-performance",
    });
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap
    cizer.setSize(kap.clientWidth, kap.clientHeight);
    cizer.toneMapping = THREE.NoToneMapping; // tonemap shader içinde, elle
    kap.appendChild(cizer.domElement);

    const sahne = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(
      44,
      kap.clientWidth / kap.clientHeight,
      0.1,
      1200,
    );

    // --- ışık & ortam ------------------------------------------------------
    const isikYon = new THREE.Vector3(0.05, Math.sin(8 * DER), -Math.cos(8 * DER)).normalize();
    const kapiYatay = new THREE.Vector3(0.05, 0, -Math.cos(8 * DER)).normalize();

    const ortak = {
      // Ortam MİLK olmamalı: gök geneli orta teal, parlaklık sadece kapıda
      // yoğunlaşsın. Yoksa her şey 1.0'a doyar, normal ölür, taş cam olur.
      gokTepe: { value: sr("#3f93a8") },
      gokUfuk: { value: sr("#6fb4bf") },
      gokDip: { value: sr("#08343a") },
      kapiRenk: { value: sr("#ffffff") },
      kapiGuc: { value: 2.6 },
      kapiYatay: { value: kapiYatay },
      sisRenk: { value: sr("#9ecdd6") },
      sisYogun: { value: 0.0055 },
    };

    // --- dokular -----------------------------------------------------------
    const tasDok = tasDokusu(kaba.matches ? 256 : 512);
    const glow = glowDokusu();

    // --- aşınma FBO (ping-pong) -------------------------------------------
    const gl = cizer.getContext();
    const yuzer = !!(
      gl.getExtension("EXT_color_buffer_float") ||
      gl.getExtension("EXT_color_buffer_half_float")
    );
    const fboN = kaba.matches ? 256 : 512;
    const rtAyar: THREE.RenderTargetOptions = {
      type: yuzer ? THREE.HalfFloatType : THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    };
    let rtA = new THREE.WebGLRenderTarget(fboN, fboN, rtAyar);
    let rtB = new THREE.WebGLRenderTarget(fboN, fboN, rtAyar);

    const fircaDizi: THREE.Vector3[] = [];
    for (let i = 0; i < FIRCA_MAX; i++) fircaDizi.push(new THREE.Vector3());

    const asinmaMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: ASINMA_FRAG,
      uniforms: {
        onceki: { value: null as THREE.Texture | null },
        firca: { value: fircaDizi },
        fircaSayi: { value: 0 },
        yaricap: { value: FIRCA_R },
        alan: { value: new THREE.Vector2(EN, BOY) },
      },
      depthTest: false,
      depthWrite: false,
    });
    const fboSahne = new THREE.Scene();
    const fboKam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const fboGeo = new THREE.PlaneGeometry(2, 2);
    fboSahne.add(new THREE.Mesh(fboGeo, asinmaMat));

    // temiz taş: her iki hedefi de sıfırla
    const eskiClear = new THREE.Color();
    cizer.getClearColor(eskiClear);
    for (const rt of [rtA, rtB]) {
      cizer.setRenderTarget(rt);
      cizer.setClearColor(0x000000, 1);
      cizer.clear(true, false, false);
    }
    cizer.setRenderTarget(null);
    cizer.setClearColor(eskiClear, 1);

    /** Bir aşınma geçişi: dünya (x,z) ayak izlerini uv'ye çevirip biriktirir. */
    const asinmaGecisi = (izler: number[][]) => {
      let i = 0;
      while (i < izler.length) {
        const n = Math.min(FIRCA_MAX, izler.length - i);
        for (let j = 0; j < FIRCA_MAX; j++) {
          if (j < n) {
            const [x, z, g] = izler[i + j];
            fircaDizi[j].set(x / EN + 0.5, 0.5 - z / BOY, g);
          } else {
            fircaDizi[j].set(-9, -9, 0);
          }
        }
        asinmaMat.uniforms.onceki.value = rtA.texture;
        asinmaMat.uniforms.fircaSayi.value = n;
        cizer.setRenderTarget(rtB);
        cizer.render(fboSahne, fboKam);
        cizer.setRenderTarget(null);
        const t = rtA;
        rtA = rtB;
        rtB = t;
        i += n;
      }
    };

    /** Bir geçenin yolu boyunca ayak izleri — canlı sim ile aynı istatistik. */
    const yolIzleri = (g: Gecen, guc: number) => {
      const out: number[][] = [];
      const adimT = ADIM / 50;
      for (let t = 0; t <= 1.0001; t += adimT) {
        const [x, z] = yolNoktasi(g, t);
        const yan = ((out.length % 2) * 2 - 1) * 0.75;
        out.push([x + yan, z, guc]);
      }
      return out;
    };

    // Ön-aşınma: taş zaten aşınmış olarak başlar. "İlk 5 saniye ölü" riskinin
    // asıl cevabı bu — havuz sayfa açılır açılmaz orada; aşınma sahnenin sırrı,
    // gösterisi değil. Gösteri geçenlerin gölgesi.
    {
      const rnd = (() => {
        let s = 0x9e3779b9;
        return () => {
          s = (s + 0x6d2b79f5) | 0;
          let r = Math.imul(s ^ (s >>> 15), 1 | s);
          r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
          return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
        };
      })();
      const hepsi: number[][] = [];
      const say = statik ? 130 : 110;
      for (let i = 0; i < say; i++) hepsi.push(...yolIzleri(yeniGecen(rnd), 0.05));
      asinmaGecisi(hepsi);
    }

    // --- gök kubbe ---------------------------------------------------------
    const gokGeo = new THREE.SphereGeometry(500, 32, 16);
    const gokMat = new THREE.ShaderMaterial({
      vertexShader: GOK_VERT,
      fragmentShader: GOK_FRAG,
      uniforms: ortak,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const gok = new THREE.Mesh(gokGeo, gokMat);
    gok.renderOrder = -999;
    sahne.add(gok);

    // --- taş ---------------------------------------------------------------
    const seg = kaba.matches ? 96 : 192;
    const tasGeo = new THREE.PlaneGeometry(DUZ_EN, DUZ_BOY, seg, seg);
    tasGeo.translate(0, DUZ_KAYMA, 0);
    const tasMat = new THREE.ShaderMaterial({
      vertexShader: TAS_VERT,
      fragmentShader: TAS_FRAG,
      uniforms: {
        ...ortak,
        asinma: { value: rtA.texture },
        tas: { value: tasDok },
        isikYon: { value: isikYon },
        isikRenk: { value: sr("#eafcff") },
        isikGuc: { value: 3.6 },
        // Ön alan yalayan güneşte doğal olarak ölü: bakış dikleşince Fresnel
        // düşer, havuz aynalamayı bırakır. Orayı perdeyle değil GÖK IŞIĞIYLA
        // açıyoruz — bakış açısından bağımsız tek terim bu. Renk kasten soluk:
        // doygun cyan ile çarpmak gölgeleri şeker-cyan'a boyardı.
        ambRenk: { value: sr("#a6d2dc").multiplyScalar(1.15) },
        derinlik: { value: 0.22 },
        mikroYuk: { value: 0.09 },
        derzDerin: { value: 0.07 },
        mermerRenk: { value: sr("#cfe2e5") },
        damarRenk: { value: sr("#7fa8ad") },
        damarVurgu: { value: sr("#43d6a8") },
        esikMerkez: { value: new THREE.Vector2(0, 0) },
        esikAlan: { value: new THREE.Vector2(EN, BOY) },
        gecen: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
        gecenSayi: { value: 0 },
        kapiX: { value: KAPI_X },
        kapiZ: { value: KAPI_Z },
        isikEgim: { value: ISIK_EGIM },
      },
    });
    const tas = new THREE.Mesh(tasGeo, tasMat);
    tas.rotation.x = -Math.PI / 2;
    sahne.add(tas);

    // --- söveler: kapıyı okutan ikinci eleman ------------------------------
    const soveGeo = new THREE.BoxGeometry(3.4, 22, 4.2);
    const soveMat = new THREE.ShaderMaterial({
      vertexShader: SOVE_VERT,
      fragmentShader: SOVE_FRAG,
      uniforms: {
        ...ortak,
        tas: { value: tasDok },
        soveRenk: { value: sr("#0b3f47").multiplyScalar(0.5) },
        kenarRenk: { value: sr("#9fe6f2").multiplyScalar(1.6) },
      },
    });
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(soveGeo, soveMat);
      // Kadrenin kenarına doğru: metin söveler ARASINDA, kompozisyon simetrik.
      m.position.set(s * (KAPI_X + 2.6), 11, KAPI_Z);
      sahne.add(m);
    }

    // --- toz: yalayan ışıkta, koyu kenarlarda parlar, havuzda görünmez -----
    const tozN = kaba.matches ? 220 : 620;
    const tozGeo = new THREE.BufferGeometry();
    const tozPoz = new Float32Array(tozN * 3);
    const tozHiz = new Float32Array(tozN * 3);
    for (let i = 0; i < tozN; i++) {
      tozPoz[i * 3] = (Math.random() - 0.5) * 46;
      tozPoz[i * 3 + 1] = 0.2 + Math.random() * 8;
      tozPoz[i * 3 + 2] = -14 + Math.random() * 30;
      tozHiz[i * 3] = (Math.random() - 0.5) * 0.09;
      tozHiz[i * 3 + 1] = (Math.random() - 0.3) * 0.05;
      tozHiz[i * 3 + 2] = (Math.random() - 0.5) * 0.09;
    }
    tozGeo.setAttribute("position", new THREE.BufferAttribute(tozPoz, 3));
    const tozMat = new THREE.PointsMaterial({
      size: 0.14,
      map: glow ?? undefined,
      color: new THREE.Color("#eafeff"),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const toz = new THREE.Points(tozGeo, tozMat);
    sahne.add(toz);

    // --- geçenler ----------------------------------------------------------
    const gecenler: Gecen[] = [];
    let sonrakiDogus = 0.35; // ilk gölge hemen gelsin, ölü açılış yok
    // Açılışta biri zaten yolun ortasında olsun.
    {
      const g = yeniGecen(Math.random);
      g.t = 0.42;
      g.sonAdim = 0.42;
      gecenler.push(g);
    }

    const gecenU = tasMat.uniforms.gecen.value as THREE.Vector4[];
    const yeniIzler: number[][] = [];

    const gecenleriIsle = (dt: number) => {
      sonrakiDogus -= dt;
      if (sonrakiDogus <= 0 && gecenler.length < GECEN_MAX) {
        gecenler.push(yeniGecen(Math.random));
        sonrakiDogus = 1.1 + Math.random() * 2.6;
      }
      yeniIzler.length = 0;
      for (let i = gecenler.length - 1; i >= 0; i--) {
        const g = gecenler[i];
        g.t += g.hiz * g.yon * dt;
        if (g.t > 1.08 || g.t < -0.08) {
          gecenler.splice(i, 1);
          continue;
        }
        // Ayak izi: yolda ADIM kadar ilerleyince bir iz. Canlı aşınma çok yavaş
        // (0.006) — taş erimesin diye. Hızlanan şey ışık, taş değil.
        while (Math.abs(g.t - g.sonAdim) >= ADIM / 50) {
          g.sonAdim += (ADIM / 50) * g.yon;
          const [x, z] = yolNoktasi(g, Math.min(Math.max(g.sonAdim, 0), 1));
          g.ayak = -g.ayak;
          yeniIzler.push([x + g.ayak * 0.75, z, 0.006]);
        }
      }
      if (yeniIzler.length) {
        asinmaGecisi(yeniIzler);
        tasMat.uniforms.asinma.value = rtA.texture;
      }
      const n = Math.min(gecenler.length, GECEN_MAX);
      for (let i = 0; i < GECEN_MAX; i++) {
        if (i < n) {
          const g = gecenler[i];
          const tc = Math.min(Math.max(g.t, 0), 1);
          const [x, z] = yolNoktasi(g, tc);
          // uçlarda yumuşak giriş/çıkış — gölge patlayarak belirmesin
          const guc = Math.min(1, Math.min(g.t + 0.08, 1.08 - g.t) / 0.14);
          gecenU[i].set(x, z, 0, Math.max(0, guc) * 0.82);
        } else {
          gecenU[i].set(0, 0, 0, 0);
        }
      }
      tasMat.uniforms.gecenSayi.value = n;
    };

    // --- kamera ------------------------------------------------------------
    const bakisHedef = new THREE.Vector3();
    const kamerayiKur = () => {
      const en = kap.clientWidth;
      const boy = kap.clientHeight;
      if (!en || !boy) return;
      const oran = en / boy;
      // Dar ekranda kompozisyonu koru: dikey fov'u aç, sahne merkezi kalsın.
      kamera.fov = oran < 1.45 ? Math.min(44 * Math.pow(1.45 / oran, 0.55), 66) : 44;
      kamera.aspect = oran;
      kamera.updateProjectionMatrix();
      cizer.setSize(en, boy);
    };
    kamerayiKur();

    const kamerayiYerlestir = (kx: number, ky: number) => {
      kamera.position.set(kx * 1.1, KAM_Y + ky * 0.5, KAM_Z);
      bakisHedef.set(
        kx * 2.2,
        KAM_Y - 20 * Math.sin(KAM_PITCH) + ky * 1.4,
        KAM_Z - 20 * Math.cos(KAM_PITCH),
      );
      kamera.lookAt(bakisHedef);
      gok.position.copy(kamera.position);
    };
    kamerayiYerlestir(0, 0);

    const fare = { x: 0, y: 0 };
    const hedef = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedef.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedef.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba.matches) {
      window.addEventListener("pointermove", fareOynat, { passive: true });
    }

    // --- döngü: IO + visibilitychange ile duraklat -------------------------
    let id = 0;
    let gorunur = true;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const ciz = () => {
      const dt = Math.min(saat.getDelta(), 0.05);
      gecenleriIsle(dt);

      for (let i = 0; i < tozN; i++) {
        tozPoz[i * 3] += tozHiz[i * 3] * dt;
        tozPoz[i * 3 + 1] += tozHiz[i * 3 + 1] * dt;
        tozPoz[i * 3 + 2] += tozHiz[i * 3 + 2] * dt;
        if (tozPoz[i * 3 + 1] > 8.4) tozPoz[i * 3 + 1] = 0.2;
        if (tozPoz[i * 3 + 1] < 0.1) tozPoz[i * 3 + 1] = 8.3;
      }
      tozGeo.attributes.position.needsUpdate = true;

      fare.x += (hedef.x - fare.x) * Math.min(1, 2.4 * dt);
      fare.y += (hedef.y - fare.y) * Math.min(1, 2.4 * dt);
      kamerayiYerlestir(fare.x, fare.y);

      cizer.render(sahne, kamera);
      id = requestAnimationFrame(ciz);
    };

    const basla = () => {
      if (calisiyor || statik) return;
      calisiyor = true;
      saat.getDelta();
      id = requestAnimationFrame(ciz);
    };
    const dur = () => {
      calisiyor = false;
      cancelAnimationFrame(id);
    };

    // reduced-motion BASE katman: rAF hiç başlamaz, tek statik kare.
    // Taş zaten aşınmış, ışık sabit, geçen yok.
    if (statik) {
      tasMat.uniforms.gecenSayi.value = 0;
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

    const ro = new ResizeObserver(() => {
      kamerayiKur();
      if (statik) cizer.render(sahne, kamera);
    });
    ro.observe(kap);

    return () => {
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", fareOynat);
      tasGeo.dispose();
      tasMat.dispose();
      gokGeo.dispose();
      gokMat.dispose();
      soveGeo.dispose();
      soveMat.dispose();
      tozGeo.dispose();
      tozMat.dispose();
      fboGeo.dispose();
      asinmaMat.dispose();
      rtA.dispose();
      rtB.dispose();
      tasDok?.dispose();
      glow?.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className="esikKap" aria-hidden="true" />;
}

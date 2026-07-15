"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  BATI_KOT,
  HS,
  ISIK_HEDEF,
  ISIK_POS,
  ISIK_RENK,
  KONI_DIS,
  KONI_IC,
  KAMERA_FOV,
  KAMERA_Y,
  KAMERA_Z,
  KARANLIK,
  KOL,
  SEKME_RENK,
  SIS_RENK,
  SIS_YOGUNLUK,
  TAS_RENK,
  W,
  mulberry32,
  // DİKKAT: bu dosyanın adı bilinçli olarak "kavsak.ts" DEĞİL. Windows/macOS
  // dosya sistemi büyük-küçük harfe duyarsız: "./kavsak" isteği aynı klasördeki
  // Kavsak.tsx'e (UI bileşeni) çözülüyordu → "'W' is not exported" ve sahne hiç
  // yüklenmiyordu. Modül adları yalnız harf büyüklüğüyle ayrışmamalı.
} from "./mimari";
import { SIS_VERT, TAS_FRAG, TAS_VERT, sisFrag } from "./shaderlar";

/*
 * DÖRT KOLLU KAVŞAK
 * ---------------------------------------------------------------------------
 * İki beşik tonozlu koridor dik kesişiyor. Kamera GÜNEY kolunun içinde, kavşağa
 * 6.2 m mesafede, göz hizasında. Kadrajda:
 *   · ortada  → çapraz tonozlu kavşak, arkasında kuzey kolunun 27 m'lik dibi
 *   · solda   → batı ağzı: ışığın geldiği yer
 *   · sağda   → doğu ağzı: kısa, berrak, sönük
 *   · altında → kameranın içinde durduğu güney kolu
 * Dört ağız, dört ayrı derinlik. Halka yok — kesişme var.
 *
 * "Yedi kapı enfiladı"ndan farkı KADRAJDA net durmalı, laf olarak değil:
 *   enfilad = TEK eksen, ışık KARŞIDAN, hedef kaçış noktası.
 *   kavşak  = DÖRT eksen, ışık YANDAN ve ALÇAKTAN, hedef zemindeki dil.
 * Bu yüzden ışık y≈1.3'te: karşıdan gelen hiçbir parlaklık yok, kaçış noktası
 * (kuzey kolu) sahnenin EN KARANLIK yeri. Metin oraya oturuyor.
 *
 * Perde/scrim YOK. Metnin arkasındaki karanlık uydurulmuş bir panel değil:
 * ışık batı kolunda ve kuzey kolunun dibi ondan ~30 m uzakta → ters kare düşüm
 * (1/d²) + sis yutumu (exp(-σd)) o bölgeyi matematiksel olarak bitiriyor.
 * "Bu panel olmasa metin okunur muydu?" sorusunun burada karşılığı yok, çünkü
 * panel yok; karanlığı üreten şey sahnenin fiziği.
 */

type Props = {
  sinif?: string;
  /** Her karede 4 kolun aydınlığı (0..1) — batı, kuzey, doğu, güney. */
  bildir?: (kollar: number[]) => void;
};

/** Bir beşik tonoz: yarım silindir, iç yüzü. tavan(x,z) ile birebir aynı yüzey. */
function besikTonoz(uzunluk: number, eksenZ: boolean) {
  const g = new THREE.CylinderGeometry(W, W, uzunluk, 30, 1, true, 0, Math.PI);
  // rotateZ(+90°): (x,y) → (-y,x). Silindir ekseni +Y → -X olur (eksen X'e yatar),
  // theta'nın x≥0 yarısı da y≥0'a döner → kemer YUKARIDA. Sonuç yüzey:
  //   y = sqrt(W² - z²)  →  translate ile  y = HS + sqrt(W² - z²) = tavan ✓
  g.rotateZ(Math.PI / 2);
  if (eksenZ) g.rotateY(Math.PI / 2);
  g.translate(0, HS, 0);
  return g;
}

/** Dikey duvar parçası. yon: normalin baktığı eksen. */
function duvar(
  a: number,
  b: number,
  sabit: number,
  eksenX: boolean,
  alt: number,
  ust: number,
) {
  const g = new THREE.PlaneGeometry(Math.abs(b - a), ust - alt);
  if (eksenX) g.rotateY(Math.PI / 2); // normal ±X
  g.translate(
    eksenX ? sabit : (a + b) / 2,
    (alt + ust) / 2,
    eksenX ? (a + b) / 2 : sabit,
  );
  return g;
}

function yatay(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y: number,
) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  return g;
}

export function KavsakSahnesi({ sinif, bildir }: Props) {
  const kapRef = useRef<HTMLDivElement>(null);
  const bildirRef = useRef(bildir);
  bildirRef.current = bildir;

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const statik = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kaba = window.matchMedia("(pointer: coarse)").matches;
    const ADIM = kaba ? 12 : 18; // dokunmatikte march adımı düşür

    const sahne = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(KAMERA_FOV, 1, 0.1, 100);
    kamera.position.set(0, KAMERA_Y, KAMERA_Z);
    // lookAt yok: eğim sabit → dil kadrajda çivili kalır, parallaks yalnız konumu oynatır.
    // +1.5°: geniş açıyla birlikte tonozu kadraja sokar, zemindeki dili düşürmez.
    kamera.rotation.set(THREE.MathUtils.degToRad(1.5), 0, 0);

    const cizer = new THREE.WebGLRenderer({
      antialias: false, // MSAA yerine RT + DPR; AA'yı hacimsel pass yumuşatıyor
      powerPreference: "high-performance",
    });
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, kaba ? 1.5 : 2));
    cizer.setClearColor(new THREE.Color(KARANLIK), 1);
    kap.appendChild(cizer.domElement);

    // Huzmenin ekseni: kaynaktan zemindeki nişan noktasına. x≈0'da y=0'ı sıyırır.
    const isikYon = new THREE.Vector3(...ISIK_HEDEF)
      .sub(new THREE.Vector3(...ISIK_POS))
      .normalize();

    // ---- geometri: tek analitik biçimden --------------------------------
    const bx0 = -(W + KOL.bati);
    const bx1 = W + KOL.dogu;
    const bz0 = -(W + KOL.kuzey);
    const bz1 = W + KOL.guney;

    // X beşiği: batı ↔ doğu, tek parça (kavşaktan kesintisiz geçer)
    const xTonoz = besikTonoz(bx1 - bx0, false);
    xTonoz.translate((bx0 + bx1) / 2, 0, 0);
    // Z beşiği: kuzey ↔ güney
    const zTonoz = besikTonoz(bz1 - bz0, true);
    zTonoz.translate(0, 0, (bz0 + bz1) / 2);

    const tasUniforms = () => ({
      uIsikP: { value: new THREE.Vector3(...ISIK_POS) },
      uIsikYon: { value: isikYon.clone() },
      uKoniIc: { value: KONI_IC },
      uKoniDis: { value: KONI_DIS },
      uIsikRenk: { value: new THREE.Color(ISIK_RENK) },
      uIsikGuc: { value: 7.0 },
      uSekmeRenk: { value: new THREE.Color(SEKME_RENK) },
      // 0.30 → 0.55: eski değerde tonoz apeksine 0.032 düşüyordu, yani HİÇBİR ŞEY;
      // kadrajın üst yarısı ölüydü. 0.75 denendi → sahne nane yeşiline kaçtı
      // (palet kayması). 0.55 ikisinin arası: tonoz okunuyor, hue kaymıyor.
      uSekmeGuc: { value: 0.55 },
      uKaranlik: { value: new THREE.Color(KARANLIK) },
      uTasRenk: { value: new THREE.Color(TAS_RENK) },
      uYuzey: { value: 0 },
      uEksen: { value: 0 },
      uKesme: { value: 0 },
    });

    const tasMat = (yuzey: number, eksen: number, kesme: number, taraf: THREE.Side) => {
      const u = tasUniforms();
      u.uYuzey.value = yuzey;
      u.uEksen.value = eksen;
      u.uKesme.value = kesme;
      return new THREE.ShaderMaterial({
        uniforms: u,
        vertexShader: TAS_VERT,
        fragmentShader: TAS_FRAG,
        side: taraf,
      });
    };

    const matler: THREE.ShaderMaterial[] = [];
    const ekle = (g: THREE.BufferGeometry, m: THREE.ShaderMaterial) => {
      matler.push(m);
      sahne.add(new THREE.Mesh(g, m));
    };

    ekle(xTonoz, tasMat(2, 0, 1, THREE.BackSide));
    ekle(zTonoz, tasMat(2, 1, 1, THREE.BackSide));

    // duvarlar: kavşakta DELİK var (|x|<W ve |z|<W'de duvar yok) → dört ağız
    const duvarlar = mergeGeometries([
      duvar(bx0, -W, -W, false, -0.8, HS),
      duvar(bx0, -W, W, false, -0.8, HS),
      duvar(W, bx1, -W, false, -0.8, HS),
      duvar(W, bx1, W, false, -0.8, HS),
      duvar(bz0, -W, -W, true, -0.8, HS),
      duvar(bz0, -W, W, true, -0.8, HS),
      duvar(W, bz1, -W, true, -0.8, HS),
      duvar(W, bz1, W, true, -0.8, HS),
    ]);
    ekle(duvarlar, tasMat(1, 0, 0, THREE.DoubleSide));

    // zemin + batı kolunun basamağı (kot farkı: ışık bir eşiğin üstünden dökülür)
    const zeminler = mergeGeometries([
      yatay(bx0, bx1, bz0, bz1, 0),
      yatay(bx0, -W, -W, W, BATI_KOT),
    ]);
    ekle(zeminler, tasMat(0, 0, 0, THREE.DoubleSide));
    ekle(
      duvar(-W, W, -W, true, 0, BATI_KOT), // basamağın yüzü
      tasMat(1, 0, 0, THREE.DoubleSide),
    );

    // kolların dip kapakları — saf siyah delik değil, taş. Sisi onlar bitiriyor.
    const kapaklar = mergeGeometries([
      duvar(-W, W, bx0, true, -0.8, HS + W),
      duvar(-W, W, bx1, true, -0.8, HS + W),
      duvar(-W, W, bz0, false, -0.8, HS + W),
      duvar(-W, W, bz1, false, -0.8, HS + W),
    ]);
    ekle(kapaklar, tasMat(1, 0, 0, THREE.DoubleSide));

    // ---- hacimsel sis pass'i --------------------------------------------
    const derinlikDoku = new THREE.DepthTexture(1, 1);
    derinlikDoku.type = THREE.UnsignedIntType;
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType, // taş pass'i ham HDR: ACES sis pass'inde
      depthTexture: derinlikDoku,
      depthBuffer: true,
    });

    const sisMat = new THREE.RawShaderMaterial({
      uniforms: {
        tRenk: { value: rt.texture },
        tDerinlik: { value: derinlikDoku },
        uTersVP: { value: new THREE.Matrix4() },
        uKamera: { value: new THREE.Vector3() },
        uIsikP: { value: new THREE.Vector3(...ISIK_POS) },
        uIsikYon: { value: isikYon.clone() },
        uKoniIc: { value: KONI_IC },
        uKoniDis: { value: KONI_DIS },
        uIsikRenk: { value: new THREE.Color(ISIK_RENK) },
        uIsikGuc: { value: 7.0 },
        uSisRenk: { value: new THREE.Color(SIS_RENK) },
        uKaranlik: { value: new THREE.Color(KARANLIK) },
        uZaman: { value: 0 },
        uPozlama: { value: 0.9 },
        uCozunurluk: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: SIS_VERT,
      fragmentShader: sisFrag(ADIM),
      depthTest: false,
      depthWrite: false,
    });
    const sisSahne = new THREE.Scene();
    const sisKamera = new THREE.Camera();
    sisSahne.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), sisMat));

    /* ---- kolların değeri: "o koldan ne kadarını görebiliyorsun" ----------
     * İlk kurguda şerit, ağza düşen ışığı örnekliyordu. Huzme koniye alınınca
     * bu ÖLDÜ: fiziksel olarak yalnız batı kolu aydınlık, öbür üç ağız koninin
     * açısal olarak dışında → şerit 0.82 / 0 / 0 / 0 okuyacaktı. Yani üç kol
     * arasındaki fark kaybolurdu.
     * Doğru büyüklük ışık değil GÖRÜŞ: her kolun sis geçirgenliği exp(-σ·L).
     * Kolların uzunluğu ve σ'sı zaten farklı (mimari.ts), üstüne batının ışığı
     * biniyor. Şeridin sırası artık kadrajdaki derinlik sırasının TA KENDİSİ:
     * batı aydınlık · doğu kısa/berrak · güney orta · kuzey 27 m + en yoğun sis
     * → neredeyse görünmez. Metnin arkasındaki kol, şeritte de en sönük olanı.
     */
    const gecirgenlik = (L: number, s: number) => Math.exp(-s * L);
    const tabanIsik = [
      0.55 * gecirgenlik(KOL.bati, SIS_YOGUNLUK.bati) + 0.62, // + tek ışık kaynağı
      0.55 * gecirgenlik(KOL.kuzey, SIS_YOGUNLUK.kuzey),
      0.55 * gecirgenlik(KOL.dogu, SIS_YOGUNLUK.dogu),
      0.55 * gecirgenlik(KOL.guney, SIS_YOGUNLUK.guney),
    ].map((v) => THREE.MathUtils.clamp(v, 0, 1));
    const yon = [
      new THREE.Vector2(-1, 0),
      new THREE.Vector2(0, -1),
      new THREE.Vector2(1, 0),
      new THREE.Vector2(0, 1),
    ];

    // ---- fare: "hangi kolu seçiyorsun" ----------------------------------
    const hedef = { x: 0, y: 0 };
    const gecerli = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedef.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedef.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba) {
      window.addEventListener("pointermove", fareOynat, { passive: true });
    }

    const rnd = mulberry32(20260715);
    const faz = rnd() * 10;

    const isikGonder = () => {
      const f = bildirRef.current;
      if (!f) return;
      f(
        tabanIsik.map((v, i) => {
          // eğilme ikramiyesi: fare bir ağza döndükçe o kol "seçiliyor"
          const d = yon[i].x * gecerli.x + yon[i].y * gecerli.y;
          return THREE.MathUtils.clamp(v + Math.max(d, 0) * 0.3, 0, 1);
        }),
      );
    };

    const tersVP = new THREE.Matrix4();
    const ciz2 = (t: number) => {
      sisMat.uniforms.uZaman.value = t;
      kamera.updateMatrixWorld();
      // matrixWorldInverse'i renderer yazar — biz ONDAN ÖNCE okuyoruz, yani bir
      // kare geriden. İlk karede ise birim matris: statik (reduced-motion) yolda
      // sahne TEK kare çizildiği için sis dünyayı tamamen yanlış yerden
      // örnekliyordu. Elle güncelle.
      kamera.matrixWorldInverse.copy(kamera.matrixWorld).invert();
      tersVP
        .multiplyMatrices(kamera.projectionMatrix, kamera.matrixWorldInverse)
        .invert();
      sisMat.uniforms.uTersVP.value.copy(tersVP);
      sisMat.uniforms.uKamera.value.copy(kamera.position);

      cizer.setRenderTarget(rt);
      cizer.clear();
      cizer.render(sahne, kamera);
      cizer.setRenderTarget(null);
      cizer.render(sisSahne, sisKamera);
    };

    let id = 0;
    let gorunur = false;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const ciz = () => {
      const t = saat.getElapsedTime();
      gecerli.x += (hedef.x - gecerli.x) * 0.04;
      gecerli.y += (hedef.y - gecerli.y) * 0.04;

      // Sahne SABİT; yalnız kamera oynuyor. Kavşakta bir kola doğru eğilmek:
      // baktığın ağız açılır, ötekiler kapanır. "Hepsini aynı anda göremezsin."
      kamera.position.x = gecerli.x * 0.9;
      kamera.position.y = KAMERA_Y - gecerli.y * 0.28 + Math.sin(t * 0.22 + faz) * 0.035;
      kamera.position.z = KAMERA_Z - Math.max(-gecerli.y, 0) * 1.1;
      kamera.rotation.y = -gecerli.x * 0.10;

      ciz2(t);
      isikGonder();
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

    // reduced-motion BASE katman: rAF hiç başlamaz. Tek statik kare, sis donmuş.
    const tekKare = () => {
      ciz2(0);
      isikGonder();
    };

    const boyutla = () => {
      const w = kap.clientWidth;
      const h = kap.clientHeight;
      if (!w || !h) return;
      kamera.aspect = w / h;
      // dar ekranda dikey FOV aç: kavşağın dört ağzı da kadrajda kalsın
      kamera.fov = THREE.MathUtils.clamp(
        KAMERA_FOV / Math.min(Math.max(w / h, 0.5), 1.0),
        KAMERA_FOV,
        86,
      );
      kamera.updateProjectionMatrix();
      cizer.setSize(w, h);
      const d = cizer.getPixelRatio();
      rt.setSize(Math.max(2, Math.round(w * d)), Math.max(2, Math.round(h * d)));
      sisMat.uniforms.uCozunurluk.value.set(w, h);
      if (statik) tekKare();
    };
    boyutla();
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

    const ro = new ResizeObserver(boyutla);
    ro.observe(kap);

    return () => {
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", fareOynat);
      sahne.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      matler.forEach((m) => m.dispose());
      sisSahne.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      sisMat.dispose();
      derinlikDoku.dispose();
      rt.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

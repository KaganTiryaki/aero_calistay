"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  QUAD_VS,
  KABARTMA_FS,
  ASINDIRMA_FS,
  TAS_VS,
  TAS_FS,
} from "./shaders";

/*
 * AŞINMA — geniş bir taş yüzey, neredeyse yatay tek bir ışık.
 *
 * Fikir: beşeri bilimlerin en dürüst malzemesi taş. İnsan üstünden geçtikçe
 * taş değişir; eşik taşı çukurlaşır, heykelin ayağı öpüle öpüle parlar.
 * Sirkülasyon = insanın dolaşımı. İz = o dolaşımın taşa yazdığı tek kayıt.
 *
 * Okunabilirlik perdeyle değil ışık tasarımıyla çözülüyor: yalayan ışıkta
 * pürüzlü yüzey çıldırır, cilalı yüzey olaysızdır. Metnin altına denk gelen
 * bölge en çok aşınmış, yani en cilalı, yani kendiliğinden sakin bölge.
 *
 * Zorunlu kapılar: DPR cap · IntersectionObserver · visibilitychange ·
 * prefers-reduced-motion'da rAF hiç başlamaz (tek statik kare) ·
 * pointer:coarse'da adım/çözünürlük düşer + antialias kapanır · tam dispose.
 */

const PLANE_W = 70;
const PLANE_D = 56;
const PLANE_CZ = -4; // düzlemin merkezi (0, 0, PLANE_CZ)
const TILE = 8.0; // bir kabartma karesi kaç metre
const GENLIK = 0.0105; // ham kabartmanın metre cinsinden yüksekliği (~1 cm)
const PUS = "#dceff1";

const D2R = Math.PI / 180;

/**
 * Shader lineer uzayda çalışıyor, sabitler de öyle olmalı.
 * DİKKAT: ColorManagement açıkken (three'nin varsayılanı) new Color("#hex")
 * ZATEN çalışma uzayına, yani lineer-sRGB'ye çeviriyor. Üstüne bir de
 * convertSRGBToLinear() çağırmak ikinci kez çevirir → sahne kararır ve
 * doygunlaşır. Uniform'a ham Color yeter.
 */
const renk = (hex: string) => new THREE.Color(hex);

export function TasSahnesi({ sinif }: { sinif?: string }) {
  const kapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)");
    const kabaIsaret = window.matchMedia("(pointer: coarse)");
    const statik = azHareket.matches;
    const kaba = kabaIsaret.matches;

    const dokuBoy = kaba ? 1024 : 2048;

    // ---- çizer -----------------------------------------------------------
    // WebGL yoksa (eski cihaz, GPU blocklist, sürücü çökmesi) three throw
    // ediyor ve bu useEffect'te patlayınca TÜM sayfa çöküyor. Sahne dekor:
    // düşerse UI ayakta kalmalı. CSS zemini zaten pus rengi, yani taşsız
    // hâlde bile hero okunur ve CTA çalışır.
    //
    // AMA sessiz düşmesin: clear color (PUS) ile CSS zemini AYNI renk, yani
    // sahne tamamen ölse bile sayfa "tasarlanmış düz pastel bir sayfa" gibi
    // görünüyor. Bu tuzak bir kez kurmayı yedi (shader hiç derlenmedi ve
    // kimse fark etmedi). Konsola yazmadan asla düşme.
    let cizer: THREE.WebGLRenderer;
    try {
      cizer = new THREE.WebGLRenderer({
        antialias: !kaba,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch (e) {
      console.error(
        "[aşınma] WebGL bağlamı alınamadı — taş sahnesi çizilmiyor, " +
          "sayfa düz pus rengine düşüyor.",
        e,
      );
      return;
    }
    // DPR cap (zorunlu). Dokunmatikte daha da sıkı: bu shader fill-rate yiyor.
    cizer.setPixelRatio(Math.min(window.devicePixelRatio || 1, kaba ? 1.25 : 2));
    cizer.setSize(kap.clientWidth || 1, kap.clientHeight || 1);
    cizer.toneMapping = THREE.NeutralToneMapping;
    cizer.toneMappingExposure = 1.0;
    kap.appendChild(cizer.domElement);
    cizer.domElement.style.display = "block";
    cizer.domElement.style.width = "100%";
    cizer.domElement.style.height = "100%";

    // ---- tam ekran geçiş yardımcısı --------------------------------------
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const gecisSahne = new THREE.Scene();
    const yerTutucu = new THREE.MeshBasicMaterial();
    const gecisMesh = new THREE.Mesh<THREE.PlaneGeometry, THREE.Material>(
      quadGeo,
      yerTutucu,
    );
    gecisSahne.add(gecisMesh);

    const gecisCiz = (
      mat: THREE.ShaderMaterial,
      hedef: THREE.WebGLRenderTarget,
    ) => {
      gecisMesh.material = mat;
      cizer.setRenderTarget(hedef);
      cizer.render(gecisSahne, quadCam);
      cizer.setRenderTarget(null);
    };

    // ---- 1) kabartmayı bir kere pişir ------------------------------------
    // Doku dosyası yok: yükseklik alanı GPU'da prosedürel üretiliyor ve
    // tileable yazıldı (lattice mod'lu) ki 8 m'lik kare kenarında dikiş olmasın.
    const kabartmaRT = new THREE.WebGLRenderTarget(dokuBoy, dokuBoy, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      generateMipmaps: true,
      depthBuffer: false,
      stencilBuffer: false,
    });
    kabartmaRT.texture.colorSpace = THREE.NoColorSpace;
    kabartmaRT.texture.anisotropy = Math.min(
      cizer.capabilities.getMaxAnisotropy(),
      kaba ? 4 : 16,
    );

    const kabartmaMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS,
      fragmentShader: KABARTMA_FS,
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
    });
    gecisCiz(kabartmaMat, kabartmaRT);

    // ---- 2) aşınma ping-pong ---------------------------------------------
    const asinmaRT = [0, 1].map(
      () =>
        new THREE.WebGLRenderTarget(512, 512, {
          type: THREE.HalfFloatType,
          format: THREE.RGBAFormat,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          generateMipmaps: false,
          depthBuffer: false,
          stencilBuffer: false,
        }),
    );
    cizer.setClearColor(0x000000, 1);
    asinmaRT.forEach((rt) => {
      rt.texture.colorSpace = THREE.NoColorSpace;
      cizer.setRenderTarget(rt);
      cizer.clear(true, false, false);
    });
    cizer.setRenderTarget(null);
    cizer.setClearColor(PUS, 1);
    let pp = 0;

    const asindirmaMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS,
      fragmentShader: ASINDIRMA_FS,
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uOnceki: { value: asinmaRT[1].texture },
        uPlaneSize: { value: new THREE.Vector2(PLANE_W, PLANE_D) },
        uA: { value: new THREE.Vector2(-1, -1) },
        uB: { value: new THREE.Vector2(-1, -1) },
        uAcik: { value: 0 },
        uDt: { value: 0 },
        uYaricap: { value: 0.85 },
      },
    });

    // ---- 3) taş ----------------------------------------------------------
    const sahne = new THREE.Scene();

    // Yolun geometrisi: yakında dar bir girişten başlayıp mekâna açılıyor.
    // Perspektif uzağı sıkıştırdığı için sabit genişlikte bir şerit ya metni
    // açıkta bırakıyor ya da ön planı tamamen yutuyordu; yelpaze ikisini de
    // çözüyor ve "kapı ağzından yayılan ayak trafiği" olarak da doğru.
    const yolYon = new THREE.Vector2(0.34, -0.94).normalize();
    const yolNormal = new THREE.Vector2(-yolYon.y, yolYon.x); // ≈ (0.94, 0.34)

    const tasMat = new THREE.ShaderMaterial({
      vertexShader: TAS_VS,
      fragmentShader: TAS_FS,
      uniforms: {
        uKabartma: { value: kabartmaRT.texture },
        uAsinma: { value: asinmaRT[0].texture },
        uZaman: { value: 8.0 },
        uTile: { value: TILE },
        uDokuBoy: { value: dokuBoy },
        uGenlik: { value: GENLIK },
        uPlaneSize: { value: new THREE.Vector2(PLANE_W, PLANE_D) },
        uPlaneMerkez: { value: new THREE.Vector2(0, PLANE_CZ) },
        uGunes: { value: new THREE.Vector3(0.28, 0.075, -0.957).normalize() },
        uGunesRenk: { value: renk("#fff6e9") },
        uGokRenk: { value: renk("#daf0f2") },
        uGolgeRenk: { value: renk("#0e4a46") },
        uPus: { value: renk(PUS) },
        // ESKİ albedo #e9e2d6 sıcak bejdi; teal gölge + pus ile karışınca
        // sahne nötr BETON grisine düşüyordu — AERO paleti neredeyse yoktu.
        // Soğuk, hafif yeşil-teal kırık beyaz: hâlâ kireçtaşı, ama artık
        // markanın hue ailesinde. Doygunluk yok, sadece yön.
        uAlbedo: { value: renk("#dee9e5") },
        uGunesSid: { value: 3.2 },
        uOrtamSid: { value: 0.62 },
        // 0.052 pusu fazla erken bastırıyordu: 20 m'de %57 pus, yani kadrajın
        // üstü tamamen süt. 0.030 derinliği koruyor, taşı ufka kadar taşıyor.
        uSis: { value: 0.03 },
        uAdim: { value: kaba ? 10 : 18 },
        uGolgeAdim: { value: kaba ? 5 : 10 },
        uYolN: { value: yolNormal },
        uYolD: { value: yolYon },
        uYolP0: { value: new THREE.Vector2(0, 6.2) },
        // 5.5 → 6.0: cilalı alan metin sütununun tamamını (künye satırı dâhil)
        // taşımalı ki okunabilirlik perdeden değil fizikten gelsin. 8.0 denendi
        // ve fazlaydı: cila tüm kadrajı yutunca taş diye bir şey kalmıyor.
        uYolEn: { value: 6.0 },
        uCukur: { value: 0.03 },
        uPikselAci: { value: 0.001 },
      },
    });

    const tasGeo = new THREE.PlaneGeometry(PLANE_W, PLANE_D, 1, 1);
    tasGeo.rotateX(-Math.PI / 2);
    const tas = new THREE.Mesh(tasGeo, tasMat);
    tas.position.set(0, 0, PLANE_CZ);
    sahne.add(tas);

    // ---- kamera ----------------------------------------------------------
    // Kural: yatay bakış açısını koru, dikey FOV'u en-boya göre türet ve
    // pitch'i her zaman fov/2 + 7° yap. Böylece ufuk asla kadraja girmiyor:
    // taş kareyi baştan başa dolduruyor, UI "yarıya sürülmüş" bir sahnenin
    // yanında değil, sahnenin tam içinde duruyor.
    const kamera = new THREE.PerspectiveCamera(40, 1, 0.05, 140);

    const kameraKur = () => {
      const w = kap.clientWidth || 1;
      const h = kap.clientHeight || 1;
      const en = w / h;
      const fov = THREE.MathUtils.clamp(
        2 * Math.atan(Math.tan(31 * D2R) / en) * (180 / Math.PI),
        38,
        62,
      );
      kamera.fov = fov;
      kamera.aspect = en;
      kamera.updateProjectionMatrix();

      const camY = THREE.MathUtils.lerp(
        2.6,
        3.4,
        THREE.MathUtils.clamp((1.4 - en) / 0.8, 0, 1),
      );
      const pitch = (fov / 2 + 7) * D2R;
      kamera.position.set(0, camY, 12);
      kamera.lookAt(0, 0, 12 - camY / Math.tan(pitch));

      // POM/LOD için: bir pikselin dikeyde kaç radyan açtığı.
      tasMat.uniforms.uPikselAci.value =
        (2 * Math.tan((fov * D2R) / 2)) / Math.max(h, 1);
    };
    kameraKur();

    // ---- imleç: taşı gerçekten aşındır (sadece pointer:fine) -------------
    // İmleç küresi klişesine düşmeden etkileşim: elin geçtiği yer cilalanıyor,
    // sonra ~16 sn'lik bir zaman sabitiyle taş yavaşça geri kabalaşıyor.
    const dizlem = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const isin = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const carpma = new THREE.Vector3();
    const uvOnce = new THREE.Vector2(-1, -1);
    const uvSimdi = new THREE.Vector2(-1, -1);
    let imlecVar = false;

    const imlecOynat = (e: PointerEvent) => {
      const r = cizer.domElement.getBoundingClientRect();
      if (!r.width || !r.height) return;
      ndc.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
      isin.setFromCamera(ndc, kamera);
      if (!isin.ray.intersectPlane(dizlem, carpma)) {
        imlecVar = false;
        return;
      }
      const u = carpma.x / PLANE_W + 0.5;
      const v = (carpma.z - PLANE_CZ) / PLANE_D + 0.5;
      if (u < 0 || u > 1 || v < 0 || v > 1) {
        imlecVar = false;
        return;
      }
      if (!imlecVar) uvOnce.set(u, v);
      uvSimdi.set(u, v);
      imlecVar = true;
    };
    const imlecCik = () => {
      imlecVar = false;
    };

    const etkilesim = !statik && !kaba;
    if (etkilesim) {
      window.addEventListener("pointermove", imlecOynat, { passive: true });
      window.addEventListener("pointerleave", imlecCik, { passive: true });
    }

    // ---- döngü -----------------------------------------------------------
    let id = 0;
    let gorunur = false;
    let calisiyor = false;
    const saat = new THREE.Clock();
    let birikim = 0;
    const minAralik = kaba ? 1 / 30 : 0; // dokunmatikte 30fps yeter

    const asinmaAdimi = (dt: number) => {
      asindirmaMat.uniforms.uOnceki.value = asinmaRT[pp].texture;
      asindirmaMat.uniforms.uDt.value = dt;
      asindirmaMat.uniforms.uAcik.value = imlecVar ? 1 : 0;
      asindirmaMat.uniforms.uA.value.copy(uvOnce);
      asindirmaMat.uniforms.uB.value.copy(uvSimdi);
      gecisCiz(asindirmaMat, asinmaRT[1 - pp]);
      pp = 1 - pp;
      tasMat.uniforms.uAsinma.value = asinmaRT[pp].texture;
      uvOnce.copy(uvSimdi);
    };

    const ciz = () => {
      id = requestAnimationFrame(ciz);
      birikim += Math.min(saat.getDelta(), 0.05);
      if (birikim < minAralik) return;
      const dt = birikim;
      birikim = 0;

      tasMat.uniforms.uZaman.value = saat.elapsedTime;
      if (etkilesim) asinmaAdimi(Math.max(dt, 1 / 120));
      cizer.render(sahne, kamera);
    };

    const basla = () => {
      if (calisiyor || statik) return;
      calisiyor = true;
      saat.getDelta();
      id = requestAnimationFrame(ciz);
    };
    const dur = () => {
      if (!calisiyor) return;
      calisiyor = false;
      cancelAnimationFrame(id);
    };

    // reduced-motion = base katman: rAF hiç başlamıyor, tek kare çizilip
    // bırakılıyor. Sahne eksilmiyor, sadece donuyor.
    cizer.render(sahne, kamera);

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
      cizer.setSize(w, h);
      kameraKur();
      if (!calisiyor) cizer.render(sahne, kamera);
    };
    const ro = new ResizeObserver(boyutla);
    ro.observe(kap);

    return () => {
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", imlecOynat);
      window.removeEventListener("pointerleave", imlecCik);
      quadGeo.dispose();
      tasGeo.dispose();
      tasMat.dispose();
      kabartmaMat.dispose();
      asindirmaMat.dispose();
      yerTutucu.dispose();
      kabartmaRT.texture.dispose();
      kabartmaRT.dispose();
      asinmaRT.forEach((rt) => {
        rt.texture.dispose();
        rt.dispose();
      });
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

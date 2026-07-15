"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { perdeFrag, perdeVert } from "./perdeShader";

/*
 * Sahne: tek bir bez perde (gerçek geometri — sarkan, kıvrımlı bir yüzey),
 * arkasında dokuz siluet farklı derinliklerde yatay sürükleniyor.
 *
 * Sahneleme kararı (okunabilirliğin tamamı buradan geliyor, perdeden değil):
 *   · Başlık bandının (y ≈ 0) arkasındaki siluetler perdeden EN UZAK olanlar.
 *     Yaygın kaynak + uzaklık = geniş penumbra + açılmış gölge çekirdeği →
 *     orası fizik gereği geniş, soluk, düşük kontrastlı bir gri.
 *   · Perdeye yakın siluetler küçük ve keskin; üst/alt raflarda duruyorlar.
 *     Küçük+keskin ile dev+soluk arasındaki fark = derinlik.
 * Ekrana gradyan perde çekilmiyor; sadece cisimler farklı yerlerde duruyor.
 */

const KAPSA = 1.16; // bez, görüntü alanından bu kadar taşıyor (parallax payı)
const FOV = 42;
const KAM_Z = 6;

// x: temel x · y: y · z: KENARDAKİ derinlik 0..1 · w: hız (birim/sn)
// x: temel boy · y: tohum · z: yön ±1 · w: salınım hızı
//
// Derinlik artık sabit değil: shader'da z, figürün yatay konumundan türüyor
// (kenarda A.z → merkezde 0.95). Buradaki A.z = kuklanın KENARDAKİ derinliği,
// yani perdeye ne kadar bastırıldığı. Ekrandaki boy farkı hâlâ M'den geliyor;
// temel boy ise kuklanın kendi boyu (gölge oyununda kuklalar eş boy değildir —
// dev Hacivat ile minik yardımcı aynı sandıktan çıkar).
//
// ESKİ SAHNELEME ÖLDÜ: figürler y = ±0.30'daki iki dar "rafa" hapisti, çünkü
// keskin hiçbir şey metnin arkasından geçemiyordu. Raflar UI biraz büyüyünce
// (nav'a madde, başlık uzarsa) yok oluyordu — sistem ölçeklenmiyordu. Artık
// metin bandını z(x) koruyor, konum değil: figürler y'de SERBEST, orta banda
// yayılıyorlar. Kadranın sol yarısı boş süt değil.
//
// y sınırı: |y| ≤ 0.20. Kenarda mag ≈ 0.30 → yarı boy 0.15; nav y=0.465 ve
// şerit y=−0.496 ile çakışmaya yer yok.
// Sıra ÖNEMLİ: dokunmatikte baştan uCount tanesi çizilir → iri/minik karışık
// diziliyor ki figür sayısı düşünce derinlik okuması ölmesin.
const FIGURLER: Array<[number[], number[]]> = [
  [[-0.55, 0.02, 0.10, 0.0090], [0.28, 0.31, 1, 0.09]], // baş kukla · sol, perdeye bastırılmış
  [[0.78, -0.10, 0.14, -0.0072], [0.26, 0.77, -1, 0.07]], // baş kukla · sağ, ters yön
  [[-1.10, -0.04, 0.05, 0.0160], [0.18, 0.585, -1, 0.19]], // minik · jilet keskin
  [[1.60, 0.15, 0.07, 0.0115], [0.22, 0.235, 1, 0.24]], // orta boy
  [[0.20, 0.18, 0.30, -0.0100], [0.20, 0.145, -1, 0.11]], // yarı derin
  [[-1.55, -0.16, 0.22, 0.0135], [0.24, 0.92, 1, 0.17]], // iri · alt banttan
];

const DONMUS_AN = 9.4; // reduced-motion'da çizilen tek karenin zamanı

export function PerdeSahnesi() {
  const kapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)");
    const kaba = window.matchMedia("(pointer: coarse)");
    const statik = azHareket.matches;

    const sahne = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(
      FOV,
      kap.clientWidth / Math.max(kap.clientHeight, 1),
      0.1,
      50,
    );
    kamera.position.set(0, 0, KAM_Z);
    kamera.lookAt(0, 0, 0);

    let cizer: THREE.WebGLRenderer;
    try {
      cizer = new THREE.WebGLRenderer({
        antialias: !kaba.matches,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      return; // WebGL yoksa sessizce çekil; altındaki krem zemin kalır
    }
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR tavanı
    cizer.setSize(kap.clientWidth, kap.clientHeight);
    cizer.setClearColor(0xdfe9e8, 1);
    cizer.domElement.style.display = "block";
    cizer.domElement.style.width = "100%";
    cizer.domElement.style.height = "100%";
    kap.appendChild(cizer.domElement);

    const figA: THREE.Vector4[] = FIGURLER.map(
      ([a]) => new THREE.Vector4(a[0], a[1], a[2], a[3]),
    );
    const figB: THREE.Vector4[] = FIGURLER.map(
      ([, b]) => new THREE.Vector4(b[0], b[1], b[2], b[3]),
    );

    const uniforms = {
      uTime: { value: statik ? DONMUS_AN : 0 },
      uAspect: { value: 1 },
      uCover: { value: KAPSA },
      uFoldAmp: { value: 0.024 },
      uFoldWorld: { value: 1 },
      uWeave: { value: 320 },
      uGrain: { value: 0.02 },
      uCount: { value: kaba.matches ? 4 : FIGURLER.length },
      uFigA: { value: figA },
      uFigB: { value: figB },
    };

    const geo = new THREE.PlaneGeometry(1, 1, kaba.matches ? 110 : 190, kaba.matches ? 76 : 130);
    const mat = new THREE.ShaderMaterial({
      vertexShader: perdeVert,
      fragmentShader: perdeFrag,
      uniforms,
      depthWrite: false,
      depthTest: false,
    });
    const bez = new THREE.Mesh(geo, mat);
    sahne.add(bez);

    // Görüntü alanının z=0 düzlemindeki dünya boyu — bez bunun KAPSA katı.
    let dunyaH = 1;
    const olcule = () => {
      const w = kap.clientWidth;
      const h = kap.clientHeight;
      if (!w || !h) return;
      const en = w / h;
      dunyaH = 2 * KAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      bez.scale.set(dunyaH * en * KAPSA, dunyaH * KAPSA, 1);
      uniforms.uAspect.value = en;
      uniforms.uFoldWorld.value = dunyaH;
      // İplik ~3.2 CSS px olsun ki dokuma görünsün ama moire yapmasın.
      uniforms.uWeave.value = h / 3.2;
      kamera.aspect = en;
      kamera.updateProjectionMatrix();
      cizer.setSize(w, h);
      cizer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      if (statik) cizer.render(sahne, kamera);
    };
    olcule();

    // --- Parallax: sadece ince işaretçi. Bez uzayda gerçek bir cisim, kamera
    // ona göre azıcık kayınca kıvrımların modellenmesi değişiyor.
    const hedef = { x: 0, y: 0 };
    const suan = { x: 0, y: 0 };
    const fare = (e: PointerEvent) => {
      hedef.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedef.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba.matches) {
      window.addEventListener("pointermove", fare, { passive: true });
    }

    let id = 0;
    let gorunur = false;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const ciz = () => {
      const dt = Math.min(saat.getDelta(), 0.05);
      uniforms.uTime.value += dt;

      const k = Math.min(1, 0.04 * dt * 60);
      suan.x += (hedef.x - suan.x) * k;
      suan.y += (hedef.y - suan.y) * k;
      kamera.position.x = suan.x * 0.16;
      kamera.position.y = -suan.y * 0.1;
      kamera.lookAt(0, 0, 0);

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

    // Statik taban katman: reduced-motion'da rAF HİÇ başlamaz, tek kare.
    if (statik) cizer.render(sahne, kamera);

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

    const ro = new ResizeObserver(olcule);
    ro.observe(kap);

    return () => {
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", fare);
      geo.dispose();
      mat.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={kapRef}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    />
  );
}

export default PerdeSahnesi;

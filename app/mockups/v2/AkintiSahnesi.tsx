"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/*
 * AKINTI — AERO'nun WebGL sahnesi.
 *
 * Motif kasten maltepe'ninkinden başka: orası bilim (atom / DNA / nöron),
 * burası sirkülasyon. Işıktan devasa bir akıntı halkası perspektifte yatıyor,
 * içinde binlerce zerre akıyor, halkanın üstünde yedi disiplin düğüm olarak
 * duruyor. Aktif olan parlıyor — soldaki notla senkron.
 *
 * Zorunlular (CLAUDE.md): DPR cap · IntersectionObserver ile ekran dışında
 * duraklat · visibilitychange'de duraklat · prefers-reduced-motion ve
 * pointer:coarse'da tek kare çizip dur (statik base katman).
 */

const CYAN = new THREE.Color("#6fe0f0");
const NANE = new THREE.Color("#43d6a8");
const BEYAZ = new THREE.Color("#dffaff");
const SIS = new THREE.Color("#0e6c78");

const R_HALKA = 22; // akıntının yarıçapı
// Halka profilden bakılınca yatay bir banda düşüyor, "dolaşım" okunmuyor:
// yeterince yatır ve kamerayı kaldır ki elips olarak dursun.
const EGIM = -0.5;

/** Zerreler için radyal gradyanlı glow dokusu — dosya yok, canvas'ta üretilir. */
function glowDokusu() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.55)");
  g.addColorStop(0.55, "rgba(255,255,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function AkintiSahnesi({
  aktif,
  toplam,
}: {
  aktif: number | null;
  toplam: number;
}) {
  const kapRef = useRef<HTMLDivElement>(null);
  // Aktif indeks rAF döngüsüne ref ile girer: her değişimde sahne kurulmasın.
  const aktifRef = useRef<number | null>(aktif);
  aktifRef.current = aktif;

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)");
    const kabaIsaret = window.matchMedia("(pointer: coarse)");
    const statik = azHareket.matches;

    const doku = glowDokusu();
    const sahne = new THREE.Scene();
    sahne.fog = new THREE.FogExp2(SIS.getHex(), 0.0135);

    const kamera = new THREE.PerspectiveCamera(
      58,
      kap.clientWidth / kap.clientHeight,
      0.1,
      400,
    );
    kamera.position.set(0, 13, 52);
    kamera.lookAt(0, 0, 0);

    const cizer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !kabaIsaret.matches,
      powerPreference: "high-performance",
    });
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap
    cizer.setSize(kap.clientWidth, kap.clientHeight);
    cizer.setClearColor(0x000000, 0);
    kap.appendChild(cizer.domElement);

    const grup = new THREE.Group();
    grup.rotation.x = EGIM;
    // Kütleyi sağa kaydır: sol sütun metin için temiz kalsın. Sağdan biraz
    // taşsın — tam ortalanmış halka poster gibi durup sahne hissini öldürüyor.
    grup.position.set(10, -2, 0);
    sahne.add(grup);

    // ---- Akıntı: halkanın tüpü boyunca akan zerreler ---------------------
    const N = kabaIsaret.matches ? 1100 : 3200;
    const geo = new THREE.BufferGeometry();
    const poz = new Float32Array(N * 3);
    const renk = new Float32Array(N * 3);
    const boy = new Float32Array(N);
    const aci = new Float32Array(N); // halka etrafındaki konum
    const tupR = new Float32Array(N); // tüp yarıçapı
    const tupA = new Float32Array(N); // tüp içindeki açı
    const hiz = new Float32Array(N);

    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      aci[i] = Math.random() * Math.PI * 2;
      // Merkeze yığılsın: sqrt dağılımı yerine kare → içi yoğun, kenarı seyrek
      tupR[i] = Math.pow(Math.random(), 1.7) * 4.2;
      tupA[i] = Math.random() * Math.PI * 2;
      hiz[i] = 0.0011 + Math.random() * 0.0016;
      boy[i] = 0.5 + Math.random() * 1.7;

      const t = Math.random();
      c.copy(t < 0.55 ? CYAN : t < 0.9 ? NANE : BEYAZ);
      c.toArray(renk, i * 3);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(poz, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(renk, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.62,
      map: doku ?? undefined,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const zerreler = new THREE.Points(geo, mat);
    grup.add(zerreler);

    const akintiYaz = () => {
      for (let i = 0; i < N; i++) {
        const a = aci[i];
        const rr = R_HALKA + tupR[i] * Math.cos(tupA[i]);
        poz[i * 3] = rr * Math.cos(a);
        poz[i * 3 + 1] = tupR[i] * Math.sin(tupA[i]);
        poz[i * 3 + 2] = rr * Math.sin(a);
      }
      geo.attributes.position.needsUpdate = true;
    };
    akintiYaz();

    // ---- Yedi disiplin: halkanın üstünde düğümler ------------------------
    // Her düğüm iki katman: geniş nane hale + küçük beyaz-sıcak çekirdek.
    // Tek katman additive nane, aydınlık zeminde hiç okunmuyordu.
    const haleler: THREE.Sprite[] = [];
    const cekirdekler: THREE.Sprite[] = [];
    for (let i = 0; i < toplam; i++) {
      const a = (i / toplam) * Math.PI * 2 - Math.PI / 2;
      const x = R_HALKA * Math.cos(a);
      const z = R_HALKA * Math.sin(a);

      const hale = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: doku ?? undefined,
          color: NANE,
          transparent: true,
          opacity: 0.42,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      hale.position.set(x, 0, z);
      hale.scale.setScalar(4);
      grup.add(hale);
      haleler.push(hale);

      const cekirdek = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: doku ?? undefined,
          color: BEYAZ,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      cekirdek.position.set(x, 0, z);
      cekirdek.scale.setScalar(1.5);
      grup.add(cekirdek);
      cekirdekler.push(cekirdek);
    }

    // ---- Derinlik: uzak zerre tozu ---------------------------------------
    const tozGeo = new THREE.BufferGeometry();
    const tozN = kabaIsaret.matches ? 260 : 620;
    const tozPoz = new Float32Array(tozN * 3);
    for (let i = 0; i < tozN; i++) {
      tozPoz[i * 3] = (Math.random() - 0.5) * 220;
      tozPoz[i * 3 + 1] = (Math.random() - 0.5) * 120;
      tozPoz[i * 3 + 2] = (Math.random() - 0.5) * 220;
    }
    tozGeo.setAttribute("position", new THREE.BufferAttribute(tozPoz, 3));
    const tozMat = new THREE.PointsMaterial({
      size: 0.5,
      map: doku ?? undefined,
      color: BEYAZ,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const toz = new THREE.Points(tozGeo, tozMat);
    sahne.add(toz);

    // ---- Fare parallax: sadece ince işaretçide ---------------------------
    const fare = { x: 0, y: 0 };
    const hedef = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedef.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedef.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kabaIsaret.matches) {
      window.addEventListener("pointermove", fareOynat, { passive: true });
    }

    // ---- Döngü: IO + visibilitychange ile duraklat -----------------------
    let id = 0;
    let gorunur = true;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const ciz = () => {
      const dt = Math.min(saat.getDelta(), 0.05);
      const t = saat.elapsedTime;

      for (let i = 0; i < N; i++) aci[i] += hiz[i] * dt * 60;
      akintiYaz();

      grup.rotation.y += 0.0006 * dt * 60;
      toz.rotation.y -= 0.00018 * dt * 60;

      const a = aktifRef.current;
      const k = 0.055 * dt * 60;
      haleler.forEach((s, i) => {
        const canli = i === a;
        const hedefBoy = canli ? 11 + Math.sin(t * 2.1) * 0.7 : 4;
        s.scale.setScalar(THREE.MathUtils.lerp(s.scale.x, hedefBoy, k));
        const m = s.material as THREE.SpriteMaterial;
        m.opacity = THREE.MathUtils.lerp(m.opacity, canli ? 1 : 0.42, k);
      });
      cekirdekler.forEach((s, i) => {
        const canli = i === a;
        s.scale.setScalar(THREE.MathUtils.lerp(s.scale.x, canli ? 3.4 : 1.5, k));
        const m = s.material as THREE.SpriteMaterial;
        m.opacity = THREE.MathUtils.lerp(m.opacity, canli ? 1 : 0.7, k);
      });

      fare.x = THREE.MathUtils.lerp(fare.x, hedef.x, 0.045 * dt * 60);
      fare.y = THREE.MathUtils.lerp(fare.y, hedef.y, 0.045 * dt * 60);
      kamera.position.x = fare.x * 4.5;
      kamera.position.y = 7.5 - fare.y * 3;
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

    // Statik base katman: reduced-motion'da tek kare çiz, döngü hiç başlamaz.
    if (statik) {
      const a0 = aktifRef.current ?? 0;
      haleler.forEach((s, i) => s.scale.setScalar(i === a0 ? 11 : 4));
      cekirdekler.forEach((s, i) => s.scale.setScalar(i === a0 ? 3.4 : 1.5));
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
      if (!kap.clientWidth || !kap.clientHeight) return;
      kamera.aspect = kap.clientWidth / kap.clientHeight;
      kamera.updateProjectionMatrix();
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
      geo.dispose();
      mat.dispose();
      tozGeo.dispose();
      tozMat.dispose();
      [...haleler, ...cekirdekler].forEach((s) =>
        (s.material as THREE.SpriteMaterial).dispose(),
      );
      doku?.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, [toplam]);

  return <div ref={kapRef} className="akintiKap" aria-hidden="true" />;
}

"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { fragmentShader, vertexShader } from "./parsomen.glsl";

/*
 * YALAYAN IŞIK — tek plane, tek yönlü ışık, azimut turu.
 *
 * Palimpsest: kazınıp üstüne yeniden yazılmış parşömen. Düz ışıkta yüzey
 * bomboştur; ışığı yalayan bir açıya getirdiğinde silinmiş metnin kabartması
 * geri gelir. 7 disiplin = 7 kazıma katmanı; her katmanın izleri kendi azimut
 * ailesine hizalı. Işık o açıya geldiğinde SADECE o katman ayağa kalkıyor.
 * Sirkülasyon = ışığın turu: hiçbir okuma nihai değil.
 *
 * Kapılar (CLAUDE.md + brief):
 *  · setPixelRatio(min(dpr, 2))
 *  · IntersectionObserver ile ekran dışında rAF durur
 *  · visibilitychange'de rAF durur
 *  · prefers-reduced-motion: rAF HİÇ başlamaz — tek statik kare, ışık donuk
 *  · pointer:coarse: antialias kapalı, FBM oktavı düşük, lif kapalı
 *  · cleanup: geometry/material/renderer dispose + canvas remove
 */

const KATMAN_SAYISI = 7;

/** Işık lobunun keskinliği: 7 pencere 360°'ye yayılıyor, komşular hafif örtüşüyor. */
const LOB = 5.0;

/** rad/s — tam tur ~33s, katman başına ~4.7s. */
const TUR_HIZI = 0.19;

/** Sayfa boyunca kaydırma ışığa kaç tur ekliyor. */
const KAYDIRMA_TURU = 0.85;

/** Statik karede ışık burada donuyor: 03. katmanın (Felsefe) tam üstünde. */
const DONUK_AZIMUT = (2 * Math.PI * 2) / KATMAN_SAYISI + 0.12;

/** Tek hue ailesi. Doygun şeker-cyan yok: ışığın kendisi renkli, zemin değil. */
const KATMAN_RENK = [
  "#43d6a8",
  "#3fd2c0",
  "#35c8e6",
  "#6fe0f0",
  "#22b8dc",
  "#4ed2e8",
  "#8fe9f2",
];

type AdaEl = { el: HTMLElement; pay: number; yum: number; yaricap: number };

export function Sahne({
  onKatman,
  sinif,
}: {
  onKatman: (i: number) => void;
  sinif: string;
}) {
  const kapRef = useRef<HTMLDivElement>(null);
  const onKatmanRef = useRef(onKatman);
  onKatmanRef.current = onKatman;

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)");
    const kaba = window.matchMedia("(pointer: coarse)").matches;
    const statik = azHareket.matches;

    // ---- Sahne ------------------------------------------------------------
    const sahne = new THREE.Scene();

    const kamera = new THREE.PerspectiveCamera(
      33,
      kap.clientWidth / Math.max(kap.clientHeight, 1),
      0.1,
      100,
    );
    kamera.position.set(0, 0.3, 9);
    kamera.lookAt(0, 0.15, 0);

    const cizer = new THREE.WebGLRenderer({
      antialias: false, // kenar yok — sahne tek quad; MSAA bedava değil, faydası sıfır
      alpha: false,
      powerPreference: "high-performance",
    });
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap
    cizer.setSize(kap.clientWidth, kap.clientHeight);
    cizer.setClearColor(0xede9de, 1);
    kap.appendChild(cizer.domElement);
    cizer.domElement.style.display = "block";

    // ---- 7 strata ---------------------------------------------------------
    const agirlik = new Float32Array(KATMAN_SAYISI);
    const ofset: THREE.Vector2[] = [];
    const aci = new Float32Array(KATMAN_SAYISI);
    const tohum = new Float32Array(KATMAN_SAYISI);
    const psi = new Float32Array(KATMAN_SAYISI); // katmanın "kalkma" azimutu
    const renkler = KATMAN_RENK.map((h) => new THREE.Color(h));

    for (let k = 0; k < KATMAN_SAYISI; k++) {
      psi[k] = (k / KATMAN_SAYISI) * Math.PI * 2;
      // Satırlar ışığa dik dursun ki o azimutta sıyırma en sert olsun.
      aci[k] = psi[k] - Math.PI / 2;
      // Altın açı: sayfalar üst üste ama hiçbiri çembere dizilmiyor.
      const a = k * 2.399963;
      ofset.push(new THREE.Vector2(Math.cos(a) * 1.05, 0.5 + Math.sin(a) * 0.72));
      tohum[k] = k * 37.13;
    }

    const adaVec = Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 0, 0));
    const adaX = Array.from({ length: 4 }, () => new THREE.Vector4(0.02, 0.03, 0.08, 0));

    const uniforms: Record<string, THREE.IUniform> = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uAda: { value: adaVec },
      uAdaX: { value: adaX },
      uW: { value: agirlik },
      uOff: { value: ofset },
      uAng: { value: aci },
      uSeed: { value: tohum },
      uAz: { value: DONUK_AZIMUT },
      uElev: { value: 0.16 }, // ~9° — sıyırma
      uAmb: { value: 0.74 },
      uKey: { value: 0.62 },
      // KALİBRASYON NOTU — bu sahnenin can damarı tek bir sayı: uBump.
      // Ölçüldü (readPixels, 1440x900, DPR1): uBump=0.026'da kazımanın
      // luminans std'si 7.3/255 → ekranda "bomboş" okunuyordu; makro dalga ise
      // tüm kadranı yumuşak bir yıkamayla boyayıp asıl yazıyı örtüyordu.
      // 0.026 → 0.10 (~3.9x) + mürekkep örtüsünün açılması birlikte pencereyi
      // tutturuyor. Gözle ince ayar aralığı ~0.08–0.14: altında görünmez,
      // üstünde "bump map demosu". Çevirilecek tek düğme burası.
      uBump: { value: 0.1 },
      uStroke: { value: 1.0 },
      uMacro: { value: 1.0 },
      uFiber: { value: kaba ? 0.0 : 0.03 },
      uRowD: { value: 5.0 },
      uSweep: { value: 0.06 },
      uSpec: { value: 0.5 },
      uShin: { value: 90.0 },
      uCoolAmt: { value: 0.8 },
      uVig: { value: 0.1 },
      uGrain: { value: 0 },
      uAlbedo: { value: new THREE.Color("#f0ede4") },
      uCool: { value: new THREE.Color("#0e4a46") },
      uKeyCol: { value: new THREE.Color("#ffffff") },
      uSpecCol: { value: new THREE.Color("#6fe0f0") },
      uKamYerel: { value: new THREE.Vector3() },
    };

    const geo = new THREE.PlaneGeometry(30, 22, 1, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      // glslVersion BİLEREK boş. three, ShaderMaterial'ı zaten `#version 300 es`'e
      // çeviriyor ve `#define gl_FragColor pc_fragColor` + `out` bildirimini
      // kendisi ekliyor. GLSL3 verilince (WebGLProgram.js:875-876) bu iki satırı
      // ATLIYOR — ama gl_FragColor ES 3.00'da yok. Sonuç: shader HİÇ derlenmiyor,
      // tuval boş clear-color olarak kalıyor. Boş bırakmak doğru olan.
      defines: { OCT: kaba ? "2" : "3" },
      side: THREE.FrontSide,
    });
    const levha = new THREE.Mesh(geo, mat);
    levha.rotation.x = -0.3; // hafif eğik: üst kenar geriye yatıyor
    levha.rotation.y = 0.05;
    sahne.add(levha);

    levha.updateMatrixWorld(true);
    (uniforms.uKamYerel.value as THREE.Vector3)
      .copy(kamera.position)
      .applyMatrix4(new THREE.Matrix4().copy(levha.matrixWorld).invert());

    // ---- Adalar: metnin KENDİ kutuları -----------------------------------
    // Kazınmamış bölge bir perde değil; DOM'daki metin bloğunun ta kendisi.
    let adalar: AdaEl[] = [];
    const adalariTopla = () => {
      adalar = Array.from(
        document.querySelectorAll<HTMLElement>("[data-ada]"),
      )
        .slice(0, 4)
        .map((el) => ({
          el,
          pay: Number(el.dataset.adaPay ?? 0.032),
          yum: Number(el.dataset.adaYum ?? 0.075),
          yaricap: Number(el.dataset.adaYaricap ?? 0.03),
        }));
    };
    adalariTopla();

    const adalariYaz = () => {
      const cssY = kap.clientHeight || 1;
      // Dar ekranda pay+yumuşama sabit kalırsa kadranın tamamı boşalır ve
      // kabartma hiç görünmez. Boşluğu ekranla ölçekle.
      const olcek = THREE.MathUtils.clamp(kap.clientWidth / 900, 0.42, 1);
      for (let i = 0; i < 4; i++) {
        const a = adalar[i];
        if (!a) {
          adaX[i].w = 0;
          continue;
        }
        const r = a.el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) {
          adaX[i].w = 0;
          continue;
        }
        // gl_FragCoord alt-yukarı; DOM üst-aşağı. Birim: ekran yüksekliği.
        adaVec[i].set(
          (r.left + r.width / 2) / cssY,
          (cssY - (r.top + r.height / 2)) / cssY,
          r.width / 2 / cssY,
          r.height / 2 / cssY,
        );
        adaX[i].set(a.yaricap, a.pay * olcek, a.yum * olcek, 1);
      }
    };

    // ---- Kaydırma: ışığın turuna eklenir ----------------------------------
    const kaydirmaEl = document.querySelector<HTMLElement>("[data-kaydirma]");
    const ilerleme = () => {
      if (!kaydirmaEl) return 0;
      const r = kaydirmaEl.getBoundingClientRect();
      const yol = Math.max(r.height - window.innerHeight, 1);
      return THREE.MathUtils.clamp(-r.top / yol, 0, 1);
    };

    // ---- Azimut → ağırlıklar → aktif katman -------------------------------
    const accRenk = new THREE.Color();
    let sonAktif = -1;

    const azimutUygula = (az: number) => {
      uniforms.uAz.value = az;
      let en = -1;
      let enW = -1;
      let toplam = 0;
      accRenk.setRGB(0, 0, 0);
      for (let k = 0; k < KATMAN_SAYISI; k++) {
        const c = Math.cos(az - psi[k]);
        const w = c > 0 ? Math.pow(c, LOB) : 0;
        agirlik[k] = w;
        toplam += w;
        if (w > enW) {
          enW = w;
          en = k;
        }
      }
      if (toplam > 1e-4) {
        for (let k = 0; k < KATMAN_SAYISI; k++) {
          if (agirlik[k] <= 0) continue;
          accRenk.r += renkler[k].r * (agirlik[k] / toplam);
          accRenk.g += renkler[k].g * (agirlik[k] / toplam);
          accRenk.b += renkler[k].b * (agirlik[k] / toplam);
        }
        (uniforms.uSpecCol.value as THREE.Color).copy(accRenk);
      }
      if (en !== sonAktif) {
        sonAktif = en;
        onKatmanRef.current(en);
      }
    };

    // ---- Çizim ------------------------------------------------------------
    const ciz = (az: number, grenT: number) => {
      azimutUygula(az);
      adalariYaz();
      uniforms.uGrain.value = Math.floor(grenT * 12) * 71.3;
      cizer.render(sahne, kamera);
    };

    let id = 0;
    let gorunur = true;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const dongu = () => {
      const t = saat.getElapsedTime();
      ciz(DONUK_AZIMUT + t * TUR_HIZI + ilerleme() * Math.PI * 2 * KAYDIRMA_TURU, t);
      id = requestAnimationFrame(dongu);
    };

    const basla = () => {
      if (calisiyor || statik) return;
      calisiyor = true;
      id = requestAnimationFrame(dongu);
    };
    const dur = () => {
      calisiyor = false;
      cancelAnimationFrame(id);
    };

    const boyutla = () => {
      const w = kap.clientWidth;
      const h = kap.clientHeight;
      if (!w || !h) return;
      kamera.aspect = w / h;
      kamera.updateProjectionMatrix();
      cizer.setSize(w, h);
      cizer.getDrawingBufferSize(uniforms.uRes.value as THREE.Vector2);
      if (statik) ciz(DONUK_AZIMUT, 0);
    };
    cizer.getDrawingBufferSize(uniforms.uRes.value as THREE.Vector2);

    // Statik base katman: reduced-motion'da rAF hiç kurulmaz. Işık donuk;
    // tek hareket eden şey ada maskesinin metni takip etmesi — bu tasarımın
    // hareketi değil, maskenin DOM ile hizada kalması. Bu yüzden kaydırmada
    // döngü değil, doğrudan tek kare çiziliyor.
    let statikBekleyen = false;
    const statikTazele = () => {
      if (statikBekleyen) return;
      statikBekleyen = true;
      queueMicrotask(() => {
        statikBekleyen = false;
        ciz(DONUK_AZIMUT, 0);
      });
    };

    if (statik) {
      ciz(DONUK_AZIMUT, 0);
      window.addEventListener("scroll", statikTazele, { passive: true, capture: true });
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

    const ro = new ResizeObserver(boyutla);
    ro.observe(kap);

    return () => {
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("scroll", statikTazele, { capture: true });
      geo.dispose();
      mat.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

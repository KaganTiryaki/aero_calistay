"use client";

import { useEffect, useRef } from "react";
import styles from "./akis.module.css";

/**
 * AKIŞ — sıvı sirkülasyon alanı.
 *
 * Alan, bir akım fonksiyonunun (stream function) curl'ü olarak türetilir;
 * bu sayede diverjansı sıfırdır — yani gerçek bir sıvı gibi ne kaynak ne
 * kuyu üretir. Sayfadaki her harf ve her UI öğesi alana katı bir cisim
 * (rounded-rect SDF) olarak verilir: akıntı hızının normal bileşeni yüzeye
 * yaklaştıkça sönümlenir, böylece iplikler harflerin etrafından teğet geçer.
 */

type Obstacle = { x: number; y: number; hw: number; hh: number; r: number };

const DPR_CAP = 2;
const INFLUENCE = 30; // px — cismin etrafındaki sınır tabakası kalınlığı

/* Harf kutusu -> cap-box düzeltmesi (line-height:1'de üstte ~%13, altta ~%14
   boşluk kalır) + bilinçli içeri kaçırma.
   Cisim harfin BİRAZ İÇİNDE tutuluyor: harf opak ve üstte çizildiği için en
   sıkı akış katmanı harfin altında gizleniyor — dışarıda kutu silueti izi
   kalmıyor. Yatay pay büyük: komşu harf kutuları birleşip tek duvar olmasın,
   akıntı harflerin ARASINDAN da geçebilsin. */
const GLYPH_TOP = 0.18;
const GLYPH_BOTTOM = 0.19;
const GLYPH_X = 0.12;

export default function FlowField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const root = canvas.parentElement;
    if (!root) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarseMq = window.matchMedia("(pointer: coarse)");
    const isStatic = () => reduceMq.matches || coarseMq.matches;

    let w = 1;
    let h = 1;
    let dpr = 1;
    let obstacles: Obstacle[] = [];

    let n = 0;
    let deepEnd = 0;
    let mintEnd = 0;
    let px = new Float32Array(0);
    let py = new Float32Array(0);
    let ox = new Float32Array(0);
    let oy = new Float32Array(0);
    let life = new Float32Array(0);

    let K1 = 0.0052;
    let K2 = 0.0031;
    let SA = 54;
    let SB = 40;
    let DRIFT = 42;

    let simT = 0;
    let raf = 0;
    let last = 0;
    let onScreen = true;
    let disposed = false;
    let fu = 0;
    let fv = 0;

    /* ── ölçüm: transform'dan etkilenmeyen layout geometrisi ─────────── */
    function layoutOffset(el: HTMLElement) {
      let x = 0;
      let y = 0;
      let node: HTMLElement | null = el;
      while (node && node !== root) {
        x += node.offsetLeft;
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      return { x, y };
    }

    function measure() {
      const next: Obstacle[] = [];
      const els = root!.querySelectorAll<HTMLElement>("[data-flow]");
      els.forEach((el) => {
        const ow = el.offsetWidth;
        const oh = el.offsetHeight;
        if (ow <= 0 || oh <= 0) return;
        const { x, y } = layoutOffset(el);

        if (el.dataset.flow === "glyph") {
          const left = x + ow * GLYPH_X;
          const right = x + ow * (1 - GLYPH_X);
          const top = y + oh * GLYPH_TOP;
          const bottom = y + oh * (1 - GLYPH_BOTTOM);
          const hw = (right - left) / 2;
          const hh = (bottom - top) / 2;
          if (hw <= 1 || hh <= 1) return;
          next.push({
            x: (left + right) / 2,
            y: (top + bottom) / 2,
            hw,
            hh,
            r: Math.min(hw, hh) * 0.24,
          });
          return;
        }

        const hw = ow / 2;
        const hh = oh / 2;
        const br = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
        next.push({
          x: x + hw,
          y: y + hh,
          hw,
          hh,
          r: Math.min(br, Math.min(hw, hh)),
        });
      });
      obstacles = next;
    }

    /* ── alan: psi = A·sin(a)·cos(b) + B·sin(c) + D·y, v = curl(psi) ─── */
    function flow(x: number, y: number, t: number) {
      const a = K1 * x + t * 0.21;
      const b = K1 * 0.8 * y - t * 0.16;
      const c = K2 * (0.62 * x + 0.9 * y) + t * 0.12;
      const sa = Math.sin(a);
      const ca = Math.cos(a);
      const sb = Math.sin(b);
      const cb = Math.cos(b);
      const cc = Math.cos(c);
      fu = -SA * 0.8 * sa * sb + SB * 0.9 * cc + DRIFT;
      fv = -SA * ca * cb - SB * 0.62 * cc;
    }

    function sdf(x: number, y: number, o: Obstacle) {
      const qx = Math.abs(x - o.x) - o.hw + o.r;
      const qy = Math.abs(y - o.y) - o.hh + o.r;
      const ax = qx > 0 ? qx : 0;
      const ay = qy > 0 ? qy : 0;
      const m = qx > qy ? qx : qy;
      return Math.sqrt(ax * ax + ay * ay) + (m < 0 ? m : 0) - o.r;
    }

    function insideAny(x: number, y: number) {
      for (let k = 0; k < obstacles.length; k++) {
        if (sdf(x, y, obstacles[k]) < 8) return true;
      }
      return false;
    }

    function spawn(i: number, initial: boolean) {
      for (let attempt = 0; attempt < 5; attempt++) {
        let x: number;
        let y: number;
        if (!initial && Math.random() < 0.4) {
          x = -24 + Math.random() * 70;
          y = Math.random() * h;
        } else {
          x = Math.random() * w;
          y = Math.random() * h;
        }
        if (attempt === 4 || !insideAny(x, y)) {
          px[i] = x;
          py[i] = y;
          ox[i] = x;
          oy[i] = y;
          life[i] = 1.8 + Math.random() * 5.6;
          return;
        }
      }
    }

    function advance(i: number, dt: number) {
      let x = px[i];
      let y = py[i];
      flow(x, y, simT);
      let vx = fu;
      let vy = fv;

      for (let k = 0; k < obstacles.length; k++) {
        const o = obstacles[k];
        if (x < o.x - o.hw - INFLUENCE || x > o.x + o.hw + INFLUENCE) continue;
        if (y < o.y - o.hh - INFLUENCE || y > o.y + o.hh + INFLUENCE) continue;

        const sx = x >= o.x ? 1 : -1;
        const sy = y >= o.y ? 1 : -1;
        const qx = Math.abs(x - o.x) - o.hw + o.r;
        const qy = Math.abs(y - o.y) - o.hh + o.r;
        const ax = qx > 0 ? qx : 0;
        const ay = qy > 0 ? qy : 0;
        const outer = Math.sqrt(ax * ax + ay * ay);
        const m = qx > qy ? qx : qy;
        const d = outer + (m < 0 ? m : 0) - o.r;
        if (d > INFLUENCE) continue;

        let nx: number;
        let ny: number;
        if (outer > 0.0001) {
          nx = (sx * ax) / outer;
          ny = (sy * ay) / outer;
        } else if (qx > qy) {
          nx = sx;
          ny = 0;
        } else {
          nx = 0;
          ny = sy;
        }

        let t = 1 - d / INFLUENCE;
        if (t > 1) t = 1;
        const wgt = t * t;

        // yüzeye yaklaşırken normal bileşeni sön: akıntı teğet geçsin
        const vn = vx * nx + vy * ny;
        vx -= nx * vn * wgt;
        vy -= ny * vn * wgt;

        // içeri sızanı dışarı it
        const push = d < 0 ? 240 : 30 * wgt;
        vx += nx * push;
        vy += ny * push;
      }

      ox[i] = x;
      oy[i] = y;
      x += vx * dt;
      y += vy * dt;
      px[i] = x;
      py[i] = y;
      life[i] -= dt;

      if (life[i] <= 0 || x < -40 || x > w + 40 || y < -40 || y > h + 40) {
        spawn(i, false);
      }
    }

    function drawGroup(
      from: number,
      to: number,
      comp: GlobalCompositeOperation,
      color: string,
      width: number,
    ) {
      if (to <= from) return;
      ctx!.globalCompositeOperation = comp;
      ctx!.strokeStyle = color;
      ctx!.lineWidth = width;
      ctx!.lineCap = "round";
      ctx!.beginPath();
      for (let i = from; i < to; i++) {
        const dx = px[i] - ox[i];
        const dy = py[i] - oy[i];
        if (dx * dx + dy * dy > 3600) continue; // ışınlanan segmenti çizme
        ctx!.moveTo(ox[i], oy[i]);
        ctx!.lineTo(px[i], py[i]);
      }
      ctx!.stroke();
    }

    function allocate(count: number) {
      n = Math.max(1, count);
      px = new Float32Array(n);
      py = new Float32Array(n);
      ox = new Float32Array(n);
      oy = new Float32Array(n);
      life = new Float32Array(n);
      deepEnd = Math.floor(n * 0.17);
      mintEnd = deepEnd + Math.floor(n * 0.38);
    }

    function step(dt: number) {
      simT += dt;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // iz bırakma: zemini değil sadece kendi pikselimizi soldur.
      // 0.018 -> iz ~55 kare (~130px) yaşar: kıl değil, ipek iplik.
      ctx!.globalCompositeOperation = "destination-out";
      ctx!.fillStyle = "rgba(0,0,0,0.018)";
      ctx!.fillRect(0, 0, w, h);

      for (let i = 0; i < n; i++) advance(i, dt);

      /* Zemin parlak cyan: "lighter" (toplamalı) beyaz burada görünmez.
         Aydınlık zeminde iplikler opak çizilir — beyaz/nane ışık, koyu
         teal gölge. */
      drawGroup(0, deepEnd, "source-over", "rgba(14,74,70,0.17)", 1.55);
      drawGroup(deepEnd, mintEnd, "source-over", "rgba(95,224,188,0.5)", 1.25);
      drawGroup(mintEnd, n, "source-over", "rgba(255,255,255,0.6)", 1.05);
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 1 / 24) dt = 1 / 24;
      step(dt);
    }

    function start() {
      if (raf || disposed || isStatic() || !onScreen || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    /* ── statik taban katman: akım çizgisi gravürü ───────────────────── */
    function renderStatic() {
      stop();
      /* Yoğunluk ALANLA ölçeklenmeli. Sabit sayı verilince dar ekranda
         birim alana düşen akım çizgisi ~4 katına çıkıyor ve gravür
         karalamaya dönüyordu. Ölçüldü: kaplama masaüstü ~%15, mobil ~%10. */
      const target = Math.min(560, Math.max(180, Math.round((w * h) / 1400)));
      const cols = Math.max(2, Math.round(Math.sqrt((target * w) / h)));
      const rows = Math.max(2, Math.ceil(target / cols));
      allocate(cols * rows);

      let i = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = ((c + 0.5) / cols) * w + (Math.random() - 0.5) * (w / cols) * 0.85;
          const y = ((r + 0.5) / rows) * h + (Math.random() - 0.5) * (h / rows) * 0.85;
          px[i] = x;
          py[i] = y;
          ox[i] = x;
          oy[i] = y;
          life[i] = 3.2 + Math.random() * 6;
          i++;
        }
      }

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);
      simT = 0;
      const dt = 1 / 60;
      // dar ekranda kısa çizgi: uzun çizgi girdapta kendi üstüne sarılıp
      // spiral karalama üretiyor (hız da 0.62x ölçekli, iz kısalıyor).
      const steps = w < 760 ? 220 : 260;
      for (let iter = 0; iter < steps; iter++) {
        simT += dt;
        for (let j = 0; j < n; j++) advance(j, dt);
        drawGroup(0, deepEnd, "source-over", "rgba(14,74,70,0.11)", 1.5);
        drawGroup(deepEnd, mintEnd, "source-over", "rgba(95,224,188,0.34)", 1.25);
        drawGroup(mintEnd, n, "source-over", "rgba(255,255,255,0.4)", 1.05);
      }
    }

    function reset() {
      if (isStatic()) {
        renderStatic();
        return;
      }
      // seyrek + uzun iz = sıvı; sık + kısa iz = kıl. Seyreği seçiyoruz.
      allocate(Math.min(1100, Math.max(360, Math.round((w * h) / 1500))));
      for (let i = 0; i < n; i++) spawn(i, true);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);
      simT = 0;

      /* Ön ısıtma: izler ~55 karede oluşuyor; ısıtmasız ilk saniyeler boş
         gradyan olarak görünürdü. İlk boyamada akıntı zaten akıyor. */
      for (let k = 0; k < 100; k++) step(1 / 60);

      start();
    }

    function resize() {
      const rect = root!.getBoundingClientRect();
      const nw = Math.max(1, Math.round(rect.width));
      const nh = Math.max(1, Math.round(rect.height));
      const ndpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      if (nw === w && nh === h && ndpr === dpr) return;

      w = nw;
      h = nh;
      dpr = ndpr;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;

      /* Girdap hücresi ~ π/K1. K1 küçüldükçe hücre büyür, akış ipekleşir.
         K1=0.0038 -> ~825px hücre: ekranda 2-3 büyük girdap. */
      const scale = Math.min(Math.max(Math.min(w, h) / 820, 0.62), 1.9);
      K1 = 0.0038 / scale;
      K2 = 0.0022 / scale;
      SA = 58 * scale;
      SB = 40 * scale;
      DRIFT = 50 * scale;

      measure();
      reset();
    }

    /* ── bağlantılar ─────────────────────────────────────────────────── */
    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!disposed) resize();
      }, 150);
    });
    ro.observe(root);

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0]?.isIntersecting ?? true;
        if (onScreen) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(root);

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onModeChange = () => {
      stop();
      measure();
      reset();
    };
    reduceMq.addEventListener("change", onModeChange);
    coarseMq.addEventListener("change", onModeChange);

    resize();

    // fontlar yerleşince harf kutuları değişir — yeniden ölç
    let fontsDone = false;
    document.fonts.ready.then(() => {
      if (disposed) return;
      fontsDone = true;
      measure();
      if (isStatic()) renderStatic();
    });
    // fonts.ready bazı tarayıcılarda erken çözülür; güvenlik ağı
    const settle = window.setTimeout(() => {
      if (disposed || !fontsDone) return;
      measure();
      if (isStatic()) renderStatic();
    }, 900);

    return () => {
      disposed = true;
      stop();
      ro.disconnect();
      io.disconnect();
      window.clearTimeout(resizeTimer);
      window.clearTimeout(settle);
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMq.removeEventListener("change", onModeChange);
      coarseMq.removeEventListener("change", onModeChange);
    };
  }, []);

  return <canvas ref={ref} className={styles.canvas} aria-hidden="true" />;
}

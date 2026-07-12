"use client";

import { useEffect, useRef } from "react";

/**
 * Pervasive twinkling starfield drawn on a fixed, viewport-sized canvas.
 * Gives the whole page a sense of depth so no area ever reads flat-black.
 * Stars drift slowly upward with scroll (parallax) and twinkle in place.
 * Reduced-motion / touch → a single static field (no rAF loop).
 */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.matchMedia("(pointer: fine)").matches;

    const TINTS = [
      [180, 240, 235], // teal-white
      [124, 245, 224], // brand turq
      [120, 205, 240], // cyan
      [235, 248, 250], // near white
    ];

    let w = 0;
    let h = 0;
    let dpr = 1;
    type Star = {
      x: number;
      y: number;
      r: number;
      base: number; // base brightness
      amp: number; // twinkle amplitude
      spd: number; // twinkle speed
      ph: number; // phase
      par: number; // parallax factor
      tint: number[];
    };
    let stars: Star[] = [];

    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // density scaled to area, capped for perf
      const count = Math.min(220, Math.round((w * h) / 8200));
      stars = Array.from({ length: count }, () => {
        const depth = Math.random(); // 0 far … 1 near
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.4 + depth * 1.5,
          base: 0.12 + depth * 0.5,
          amp: 0.15 + Math.random() * 0.4,
          spd: 0.4 + Math.random() * 1.3,
          ph: Math.random() * Math.PI * 2,
          par: 0.06 + depth * 0.35,
          tint: TINTS[(Math.random() * TINTS.length) | 0],
        };
      });
    };

    let scrollY = window.scrollY;
    const onScroll = () => {
      scrollY = window.scrollY;
      if (reduce) draw(0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        // parallax wrap: stars drift up as the page scrolls down
        let y = (s.y - scrollY * s.par) % h;
        if (y < 0) y += h;
        const tw = reduce ? 1 : s.base + s.amp * (0.5 + 0.5 * Math.sin(t * 0.001 * s.spd + s.ph));
        const a = Math.max(0, Math.min(1, tw));
        const [r, g, b] = s.tint;
        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
        ctx.fill();
        // faint glow on the nearer/brighter stars
        if (s.r > 1.1) {
          ctx.beginPath();
          ctx.arc(s.x, y, s.r * 2.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.12})`;
          ctx.fill();
        }
      }
    };

    // The starfield is always on-screen (fixed, full-viewport) and drifts very
    // slowly, so a full 60fps redraw of every star each frame is wasted work.
    // Cap it to ~30fps: keeps the twinkle/parallax smooth while halving the
    // idle CPU/GPU/battery cost on desktop.
    const FRAME_MS = 1000 / 30;
    let raf = 0;
    let running = true;
    let last = 0;
    const loop = (t: number) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (t - last < FRAME_MS) return;
      last = t;
      draw(t);
    };

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        build();
        if (reduce) draw(0);
      }, 150);
    };

    build();
    if (reduce) {
      draw(0);
    } else {
      raf = requestAnimationFrame(loop);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className="starfield" aria-hidden />;
}

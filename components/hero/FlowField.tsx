"use client";

import { useEffect, useRef } from "react";

/**
 * The single hero engine: a curl-noise-ish particle current in the AERO
 * teal→cyan palette, drifting toward the CTA (circulation-toward-the-action).
 * Mouse-reactive: the cursor stirs the current (tangential swirl + slight
 * repel) and leaves a comet glow. Magnetic CTA + mesh parallax live elsewhere.
 *
 * Robustness: paused offscreen / when the tab is hidden, DPR-capped, particle
 * count scaled down on touch, and fully skipped under prefers-reduced-motion
 * (the CSS mesh + grain is the base render).
 */
export function FlowField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const DPR = Math.min(window.devicePixelRatio || 1, coarse ? 1.3 : 1.75);

    let W = 0;
    let H = 0;
    const resize = () => {
      W = canvas.width = Math.floor(window.innerWidth * DPR);
      H = canvas.height = Math.floor(window.innerHeight * DPR);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    // pointer state
    let mx = window.innerWidth * 0.5 * DPR;
    let my = window.innerHeight * 0.4 * DPR;
    let pmx = mx;
    let pmy = my;
    let mspeed = 0;
    let hasMouse = false;
    const onMove = (e: PointerEvent) => {
      mx = e.clientX * DPR;
      my = e.clientY * DPR;
      hasMouse = true;
    };
    const onLeave = () => {
      hasMouse = false;
    };
    if (!coarse) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerleave", onLeave);
    }

    const N = Math.min(
      coarse ? 700 : 1500,
      Math.floor((window.innerWidth * window.innerHeight) / (coarse ? 1500 : 900)),
    );
    const P = Array.from({ length: N }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      life: Math.random() * 200,
    }));

    const cx = () => W * 0.5;
    const cy = () => H * 0.36; // focal point (behind the logo)
    const ax = () => W * 0.5;
    const ay = () => H * 0.62; // attractor (CTA area)
    const flowAngle = (x: number, y: number, t: number) => {
      const s = 0.0016;
      return (
        Math.sin(x * s + t * 0.00022) * 2.0 +
        Math.cos(y * s * 0.9 - t * 0.00019) * 2.0 +
        Math.sin((x + y) * s * 0.6 + t * 0.0003) * 1.3
      );
    };

    let rafId = 0;
    let looping = false;
    const tick = (t: number) => {
      const dxm = mx - pmx;
      const dym = my - pmy;
      mspeed = mspeed * 0.85 + Math.min(1, Math.hypot(dxm, dym) / (45 * DPR)) * 0.15;
      pmx += dxm * 0.2;
      pmy += dym * 0.2;

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(5,9,12,0.085)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      const AX = ax();
      const AY = ay();
      const R = 175 * DPR;
      const CXv = cx();
      const CYv = cy();
      for (const p of P) {
        const a = flowAngle(p.x, p.y, t);
        const spd = 0.9 * DPR;
        let vx = Math.cos(a) * spd;
        let vy = Math.sin(a) * spd;
        const dx = AX - p.x;
        const dy = AY - p.y;
        const d = Math.hypot(dx, dy) + 1;
        vx += (dx / d) * 0.28 * DPR;
        vy += (dy / d) * 0.28 * DPR;
        if (hasMouse) {
          const ex = p.x - mx;
          const ey = p.y - my;
          const ed = Math.hypot(ex, ey);
          if (ed < R) {
            const f = 1 - ed / R;
            const ux = ex / (ed + 1);
            const uy = ey / (ed + 1);
            vx += -uy * f * 2.8 * DPR + ux * f * 1.1 * DPR;
            vy += ux * f * 2.8 * DPR + uy * f * 1.1 * DPR;
          }
        }
        p.x += vx;
        p.y += vy;
        p.life--;
        if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || p.life < 0) {
          p.x = Math.random() * W;
          p.y = Math.random() * H;
          p.life = 120 + Math.random() * 180;
        }
        const fx = p.x - CXv;
        const fy = p.y - CYv;
        const fd = Math.hypot(fx, fy);
        const near = Math.max(0, 1 - fd / (W * 0.42));
        const mix = Math.min(1, Math.max(0, p.y / H));
        const r = Math.round(6 + mix * 61);
        const g = Math.round(195 + mix * 32);
        const b = Math.round(169 + mix * 72);
        ctx.fillStyle = `rgba(${r},${g},${b},${0.1 + near * 0.32})`;
        const rad = (0.7 + near * 1.7) * DPR;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, 6.283);
        ctx.fill();
      }

      if (hasMouse) {
        const gr = (85 + mspeed * 140) * DPR;
        const grd = ctx.createRadialGradient(mx, my, 0, mx, my, gr);
        grd.addColorStop(0, `rgba(84,227,229,${0.09 + mspeed * 0.18})`);
        grd.addColorStop(0.5, "rgba(46,197,175,0.05)");
        grd.addColorStop(1, "rgba(5,9,12,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(mx, my, gr, 0, 6.283);
        ctx.fill();
      }

      rafId = requestAnimationFrame(tick);
    };

    const start = () => {
      if (looping) return;
      looping = true;
      rafId = requestAnimationFrame(tick);
    };
    const stop = () => {
      looping = false;
      cancelAnimationFrame(rafId);
    };

    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0 },
    );
    io.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
    />
  );
}

"use client";

import { useEffect, useRef } from "react";

/**
 * Custom cursor: a soft teal glow that lags behind a crisp dot — a "force in
 * the field" that makes every section feel as alive as the hero. Fine-pointer
 * + reduced-motion gated; native cursor stays for usability.
 */
export function Cursor() {
  const glowRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const glow = glowRef.current;
    const dot = dotRef.current;
    if (!glow || !dot) return;

    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let gx = tx;
    let gy = ty;
    let dx = tx;
    let dy = ty;
    let shown = false;

    const reveal = () => {
      if (shown) return;
      shown = true;
      glow.style.opacity = "1";
      dot.style.opacity = "1";
    };
    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      reveal();
    };
    const onDown = () => {
      glow.style.transform = "translate3d(-50%,-50%,0) scale(1.5)";
    };
    const onUp = () => {
      glow.style.transform = "translate3d(-50%,-50%,0) scale(1)";
    };
    const onLeave = () => {
      glow.style.opacity = "0";
      dot.style.opacity = "0";
      shown = false;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("mouseleave", onLeave);

    let raf = 0;
    const loop = () => {
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      dx += (tx - dx) * 0.4;
      dy += (ty - dy) * 0.4;
      glow.style.left = `${gx}px`;
      glow.style.top = `${gy}px`;
      dot.style.left = `${dx}px`;
      dot.style.top = `${dy}px`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <>
      <div ref={glowRef} className="cursor-glow" aria-hidden />
      <div ref={dotRef} className="cursor-dot" aria-hidden />
    </>
  );
}

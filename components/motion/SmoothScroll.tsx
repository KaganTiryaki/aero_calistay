"use client";

import { useEffect } from "react";
// Type-only import: erased at compile time, keeps Lenis out of the initial
// bundle. The runtime module is loaded lazily below (only on desktop).
import type Lenis from "lenis";

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

/**
 * Weighted inertial scroll (the highest-ROI "expensive" feel upgrade).
 * Disabled on touch (perf) and when the user prefers reduced motion — so the
 * Lenis module is dynamically imported only for the users who actually get it,
 * shaving it off everyone else's First Load JS.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduce || coarse) return;

    let lenis: Lenis | undefined;
    let raf = 0;
    let cancelled = false;

    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
      window.__lenis = lenis;
      const loop = (t: number) => {
        lenis!.raf(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      lenis?.destroy();
      window.__lenis = undefined;
    };
  }, []);

  return <>{children}</>;
}

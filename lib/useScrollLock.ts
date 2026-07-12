"use client";

import { useEffect } from "react";

/**
 * Freezes page scroll while an overlay is open. Pauses Lenis (desktop) and
 * hard-locks body overflow (touch, where Lenis is off). Restores on close.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const lenis = window.__lenis;
    lenis?.stop();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      lenis?.start();
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

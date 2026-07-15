"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Kamera katmanı: pointer hareketini iki CSS custom property'sine (--px/--py,
 * -1..1 aralığı) yazar. Katmanlar bu değerleri kendi transform'larında kullanır.
 *
 * - Sadece transform etkilenir (layout yok).
 * - rAF ile throttle; sürekli dönen bir loop yok, sadece hareket varken 1 frame.
 * - pointer:coarse (dokunmatik) ve prefers-reduced-motion altında hiç bağlanmaz;
 *   o durumda --px/--py 0 kalır ve sahne statik base halinde durur.
 */
export function ParallaxRoot({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fine = window.matchMedia("(pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduced.matches) return;

    let raf = 0;
    let px = 0;
    let py = 0;

    const flush = () => {
      raf = 0;
      el.style.setProperty("--px", px.toFixed(3));
      el.style.setProperty("--py", py.toFixed(3));
    };

    const onMove = (e: PointerEvent) => {
      px = (e.clientX / window.innerWidth) * 2 - 1;
      py = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(flush);
    };

    const onLeave = () => {
      px = 0;
      py = 0;
      if (!raf) raf = requestAnimationFrame(flush);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

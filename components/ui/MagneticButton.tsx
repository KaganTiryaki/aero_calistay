"use client";

import { useEffect, useRef } from "react";

/**
 * Wraps an element so it magnetizes toward the cursor when nearby, then
 * eases back. Fine-pointer only; a no-op under reduced motion / touch.
 */
export function MagneticButton({
  children,
  strength = 0.28,
  radius = 190,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  radius?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      el.style.transform =
        dist < radius ? `translate(${dx * strength}px, ${dy * strength}px)` : "translate(0,0)";
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [strength, radius]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        display: "inline-block",
        transition: "transform .25s cubic-bezier(0.16,1,0.3,1)",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}

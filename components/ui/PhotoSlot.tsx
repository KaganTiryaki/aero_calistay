"use client";

import { useRef } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Premium empty-state photo slot. Branded gradient fill + locked aspect-ratio
 * (no CLS when a real image drops in) + corner brackets + quiet "Görsel yakında"
 * microcopy. Featured slot gets one shimmer. Subtle 3D tilt on hover.
 */
export function PhotoSlot({
  ratio = "4 / 5",
  caption,
  featured = false,
  className,
}: {
  ratio?: string;
  caption?: string;
  featured?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1000px) rotateX(${-py * 4.5}deg) rotateY(${px * 4.5}deg)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  const bracket =
    "pointer-events-none absolute h-5 w-5 border-brand-turq/35";

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-hairline/70",
        className,
      )}
      style={{
        aspectRatio: ratio,
        background: "linear-gradient(150deg, #0d1b3e, #10275c)",
        transition: "transform .35s cubic-bezier(0.16,1,0.3,1)",
        willChange: "transform",
      }}
    >
      {featured && <div aria-hidden className="shimmer absolute inset-0" />}
      <div aria-hidden className="scan-line" />

      {/* corner brackets */}
      <span className={cn(bracket, "left-3 top-3 border-l border-t")} />
      <span className={cn(bracket, "right-3 top-3 border-r border-t")} />
      <span className={cn(bracket, "bottom-3 left-3 border-b border-l")} />
      <span className={cn(bracket, "bottom-3 right-3 border-b border-r")} />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
        <ImageIcon className="h-6 w-6 text-brand-turq/40" strokeWidth={1.5} />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-brand-turq/50">
          Görsel yakında
        </span>
      </div>

      {caption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <span className="font-mono text-xs tracking-wide text-ink/85">{caption}</span>
        </div>
      )}
    </div>
  );
}

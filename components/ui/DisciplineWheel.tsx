"use client";

import { useEffect, useRef, useState } from "react";
import { disciplines } from "@/lib/content";

/**
 * A GTA-style radial reader of the 7 disciplines, split by dividing lines.
 *
 * Pointer devices → no clicking: the wedge nearest the cursor (by angle from
 * the wheel centre) opens in the notepad as you move the mouse around.
 * Touch / no-pointer devices → the wheel is pinned and scroll-scrubbed: the
 * same slot cycles 01 → 07 in place as you scroll (Sanat … İlahiyat).
 */
const CX = 100;
const CY = 100;
const R = 95;
const RIN = 50;
const GAP = 2.4;
const N = disciplines.length;
const SEG = 360 / N;
const STEP_VH = 46; // scroll height per discipline (touch scrub)

// round so SSR (Node) and browser emit identical strings (Math.cos ULP drift)
const round = (n: number) => Math.round(n * 100) / 100;
const polar = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [round(CX + r * Math.cos(a)), round(CY + r * Math.sin(a))];
};
const wedgePath = (i: number) => {
  const a0 = -90 + i * SEG + GAP / 2;
  const a1 = -90 + (i + 1) * SEG - GAP / 2;
  const [x0, y0] = polar(R, a0);
  const [x1, y1] = polar(R, a1);
  const [x2, y2] = polar(RIN, a1);
  const [x3, y3] = polar(RIN, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${RIN} ${RIN} 0 ${large} 0 ${x3} ${y3} Z`;
};
const labelPos = (i: number) => polar((R + RIN) / 2, -90 + i * SEG + SEG / 2);
const wedgeCenter = (i: number) => -90 + i * SEG + SEG / 2;
const angDist = (a: number, b: number) => {
  const d = (((a - b) % 360) + 540) % 360 - 180;
  return Math.abs(d);
};

export function DisciplineWheel() {
  const [sel, setSel] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [fine, setFine] = useState(true); // desktop-first for SSR
  const wheelRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(pointer: fine)");
    setFine(mq.matches);
    const onChange = () => setFine(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // touch → scroll position within the tall wrapper scrubs the discipline
  useEffect(() => {
    if (!mounted || fine) return;
    const el = scrubRef.current;
    if (!el) return;
    const onScroll = () => {
      const total = el.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      const scrolled = Math.min(Math.max(-el.getBoundingClientRect().top, 0), total);
      const p = scrolled / total;
      setSel(Math.min(N - 1, Math.max(0, Math.floor(p * N * 0.999))));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mounted, fine]);

  // pointer devices → nearest wedge by angle from centre
  const onMove = (e: React.PointerEvent) => {
    if (!fine) return;
    const el = wheelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      const d = angDist(deg, wedgeCenter(i));
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    setSel(best);
  };

  const active = disciplines[sel];
  const touch = mounted && !fine;

  const wheel = (
    <div
      ref={wheelRef}
      onPointerMove={fine ? onMove : undefined}
      role="img"
      aria-label="Disiplinler çarkı"
      className="relative mx-auto aspect-square w-full max-w-[380px]"
    >
      <svg viewBox="0 0 200 200" className="h-full w-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id="wheel-on" cx="0.5" cy="0.5" r="0.65">
            <stop offset="0" stopColor="#54e3e5" stopOpacity="0.42" />
            <stop offset="1" stopColor="#06c3a9" stopOpacity="0.14" />
          </radialGradient>
        </defs>
        {disciplines.map((d, i) => {
          const on = i === sel;
          const [lx, ly] = labelPos(i);
          return (
            <g key={d.name}>
              <path
                d={wedgePath(i)}
                fill={on ? "url(#wheel-on)" : "rgba(46,197,175,0.05)"}
                stroke={on ? "#54e3e5" : "rgba(84,227,229,0.16)"}
                strokeWidth={on ? 0.9 : 0.5}
                className={on ? "wheel-glow" : ""}
                style={{ transition: "fill .3s, stroke .3s" }}
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={on ? "#eafffb" : "#8fa9a6"}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "5px",
                  letterSpacing: "0.4px",
                  textTransform: "uppercase",
                  transition: "fill .3s",
                }}
              >
                {d.name}
              </text>
            </g>
          );
        })}
        <circle cx={CX} cy={CY} r={RIN - 3} fill="none" stroke="rgba(84,227,229,0.14)" strokeWidth="0.5" />
      </svg>

      {/* center readout — the "same place" that cycles */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[28%] text-center">
        <span className="font-mono text-[10px] tracking-[0.3em] text-brand-turq/70">
          {String(sel + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
        </span>
        <span className="mt-1.5 font-display text-2xl leading-tight text-ink md:text-[1.75rem]">
          {active.name}
        </span>
      </div>
    </div>
  );

  // ---- touch: pinned, scroll-scrubbed single slot ----
  if (touch) {
    return (
      <div ref={scrubRef} style={{ height: `${N * STEP_VH}vh` }} className="relative">
        <div className="sticky top-0 flex min-h-screen flex-col items-center justify-center gap-8 py-16">
          {wheel}

          <p className="max-w-sm text-center text-[15px] leading-relaxed text-ink/90">
            {active.note}
          </p>

          {/* progress dots */}
          <div className="flex items-center gap-2">
            {disciplines.map((d, i) => (
              <span
                key={d.name}
                className={
                  "h-1.5 rounded-full transition-all duration-300 " +
                  (i === sel ? "w-5 bg-brand-turq" : "w-1.5 bg-hairline")
                }
              />
            ))}
          </div>

          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-label">
            Kaydır · disiplinler değişir
          </p>
        </div>
      </div>
    );
  }

  // ---- pointer: wheel + live notepad ----
  return (
    <div className="grid items-center gap-10 md:grid-cols-[1fr_0.82fr] md:gap-14">
      {wheel}
      <div className="panel panel-accent relative min-h-[220px] p-7 md:p-8">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-turq shadow-[0_0_8px_2px_rgba(84,227,229,0.7)]" />
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-brand-turq/70">
            Sirkülasyon · {active.name}
          </p>
        </div>
        <p className="text-lg leading-relaxed text-ink/90">{active.note}</p>
      </div>
    </div>
  );
}

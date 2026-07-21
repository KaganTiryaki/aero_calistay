"use client";

import { useEffect, useState } from "react";
import { site } from "@/lib/content";

type Parts = { d: number; h: number; m: number; s: number };

function diffTo(target: number): Parts | null {
  const ms = target - Date.now();
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

const UNITS: { key: keyof Parts; label: string }[] = [
  { key: "d", label: "gün" },
];

/**
 * Counts down to the application deadline (site.applyDeadline). Renders
 * nothing until mounted (no hydration mismatch) or if the date is unset,
 * invalid, or already passed.
 */
export function Countdown() {
  const [parts, setParts] = useState<Parts | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const target = Date.parse(site.applyDeadline || "");
    if (Number.isNaN(target)) {
      setReady(true);
      return;
    }
    setParts(diffTo(target));
    setReady(true);
    const id = window.setInterval(() => {
      const p = diffTo(target);
      setParts(p);
      if (!p) window.clearInterval(id); // deadline reached — stop ticking
    }, 60000);
    return () => window.clearInterval(id);
  }, []);

  if (!ready || !parts) return null;

  return (
    <div className="flex flex-col items-center gap-2.5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-[#5e8480]">
        Son başvuruya
      </span>
      <div className="flex items-start gap-2.5 md:gap-3.5">
        {UNITS.map(({ key, label }, i) => (
          <div key={key} className="flex items-start gap-2.5 md:gap-3.5">
            <div className="flex flex-col items-center">
              <span className="min-w-[2.2ch] text-center font-display text-2xl leading-none tabular-nums text-ink md:text-3xl">
                {String(parts[key]).padStart(2, "0")}
              </span>
              <span className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#4e6e6b]">
                {label}
              </span>
            </div>
            {i < UNITS.length - 1 && (
              <span className="pt-0.5 font-display text-2xl leading-none text-brand-turq/40 md:text-3xl">
                :
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AeroMark } from "@/components/ui/AeroMark";
import { site } from "@/lib/content";

/**
 * Cinematic arrival: the wordmark over a filling current-bar, then a soft
 * fade to reveal the hero. Reduced-motion → dismissed immediately.
 */
export function Preloader() {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setGone(true);
      return;
    }

    // lock scroll while the curtain is up
    document.body.style.overflow = "hidden";

    const DUR = 1050;
    let raf = 0;
    let startT = 0;
    let outTimer = 0;

    const tick = (t: number) => {
      if (!startT) startT = t;
      const p = Math.min(1, (t - startT) / DUR);
      // ease-out for a decisive finish
      const eased = 1 - Math.pow(1 - p, 2.2);
      setProgress(eased);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setFading(true);
        outTimer = window.setTimeout(() => {
          setGone(true);
          document.body.style.overflow = "";
        }, 560);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(outTimer);
      document.body.style.overflow = "";
    };
  }, []);

  if (gone) return null;

  const [firstWord, ...restWords] = site.event.split(" ");
  const rest = restWords.join(" ");

  return (
    <div
      className="preloader"
      style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? "none" : "auto" }}
      aria-hidden
    >
      <AeroMark className="h-12 w-12" />
      <p className="kicker text-[11px]">{site.school}</p>
      <p className="font-display text-3xl tracking-tight text-ink md:text-4xl">
        <span className="text-flow-anim">{firstWord}</span>
        {rest && <> {rest}</>}{" "}
        <span className="text-muted">{site.year}</span>
      </p>
      <div className="preloader-bar">
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  );
}

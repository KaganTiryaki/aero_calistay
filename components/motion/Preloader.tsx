"use client";

import { useEffect, useState } from "react";
import { AeroMark } from "@/components/ui/AeroMark";
import { site } from "@/lib/content";

/**
 * Cinematic arrival: the wordmark over a filling current-bar, then a soft
 * fade to reveal the hero. Reduced-motion → dismissed immediately.
 */
export function Preloader() {
  const [fill, setFill] = useState(false);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);
  const [dur, setDur] = useState(1050);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setGone(true);
      return;
    }

    // The bar now fills via a single CSS width transition instead of a per-frame
    // rAF + setState (which fired ~60 React re-renders/sec during first paint —
    // exactly when a weak phone is busiest). Shorter on touch. 4 re-renders total.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const DUR = coarse ? 650 : 1050;
    setDur(DUR);

    // lock scroll while the curtain is up
    document.body.style.overflow = "hidden";

    const startTimer = window.setTimeout(() => setFill(true), 20);
    const fadeTimer = window.setTimeout(() => setFading(true), DUR);
    const goneTimer = window.setTimeout(() => {
      setGone(true);
      document.body.style.overflow = "";
    }, DUR + 560);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(goneTimer);
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
        <span
          style={{
            width: fill ? "100%" : "0%",
            transition: `width ${dur}ms var(--ease-flow)`,
          }}
        />
      </div>
    </div>
  );
}

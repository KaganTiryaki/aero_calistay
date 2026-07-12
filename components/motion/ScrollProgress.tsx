"use client";

import { m, useScroll, useSpring } from "motion/react";

/** Thin flowing progress bar at the very top — instrument feel. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.3,
  });

  return (
    <m.div
      aria-hidden
      style={{ scaleX }}
      className="bg-flow fixed inset-x-0 top-0 z-[101] h-[3px] origin-left"
    />
  );
}

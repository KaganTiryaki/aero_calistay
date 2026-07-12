"use client";

import { LazyMotion, domAnimation } from "motion/react";

/**
 * Loads only the animation feature set (animation + exit + whileInView + hover/
 * tap/focus) instead of the full motion bundle. Every animated component uses
 * `m.*` (not `motion.*`) — `strict` throws if a full `motion` component slips
 * in, guaranteeing the bundle stays small. No drag/layout anims here (domMax).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { FlowField } from "./FlowField";
import { Countdown } from "./Countdown";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { Cta } from "@/components/ui/Cta";
import { hero, site, disciplines } from "@/lib/content";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  },
};

const MESH =
  "radial-gradient(60% 45% at 50% 34%, rgba(46,197,175,.28), transparent 70%)," +
  "radial-gradient(45% 40% at 78% 68%, rgba(67,203,241,.16), transparent 70%)," +
  "radial-gradient(50% 50% at 18% 74%, rgba(6,195,169,.14), transparent 72%)," +
  "radial-gradient(120% 120% at 50% 50%, #06121A 0%, #05090C 55%, #03060A 100%)";

export function Hero() {
  const reduce = useReducedMotion();
  const meshRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = meshRef.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: PointerEvent) => {
      const rx = e.clientX / window.innerWidth - 0.5;
      const ry = e.clientY / window.innerHeight - 0.5;
      el.style.transform = `translate(${rx * -16}px, ${ry * -16}px)`;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const [firstWord, ...restWords] = site.event.split(" ");
  const rest = restWords.join(" ");

  return (
    <section
      id="anasayfa"
      className="relative isolate flex h-svh min-h-[640px] w-full flex-col items-center justify-center overflow-hidden px-6 text-center"
    >
      <div
        ref={meshRef}
        aria-hidden
        className="absolute inset-[-4%] z-0 transition-transform duration-300 ease-out will-change-transform"
        style={{ backgroundImage: MESH }}
      />
      {!reduce && <FlowField />}
      <div aria-hidden className="vignette" />
      <div aria-hidden className="grain-overlay" />

      <motion.div
        variants={container}
        initial={reduce ? undefined : "hidden"}
        animate={reduce ? undefined : "show"}
        className="relative z-50 flex flex-col items-center"
      >
        <motion.div
          variants={item}
          className="kicker mb-8 flex items-center gap-4 before:h-px before:w-9 before:bg-gradient-to-r before:from-transparent before:to-brand-turq/60 after:h-px after:w-9 after:bg-gradient-to-l after:from-transparent after:to-brand-turq/60"
        >
          {site.school}
        </motion.div>

        <motion.h1
          variants={item}
          className="max-w-[16ch] font-display text-[clamp(2.9rem,8vw,7rem)] font-medium leading-[0.98] tracking-[-0.02em] text-ink"
        >
          <span className="text-flow-anim">{firstWord}</span>
          {rest && <> {rest}</>} <span className="text-muted">{site.year}</span>
        </motion.h1>

        <motion.div variants={item} className="mt-11 flex flex-col items-center gap-5">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-brand-turq/25 bg-brand/[0.07] px-[18px] py-2.5 text-[13.5px] font-medium text-[#bdede5] backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-turq/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-turq shadow-[0_0_12px_2px_rgba(84,227,229,0.9)]" />
            </span>
            {hero.status}
          </span>

          <Countdown />

          <MagneticButton>
            <Cta label={hero.cta} />
          </MagneticButton>

          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#4e6e6b]">
            {hero.ctaNote}
          </span>
        </motion.div>
      </motion.div>

      <div className="absolute inset-x-0 bottom-9 z-50 px-6 text-center font-mono text-[11.5px] uppercase tracking-[0.28em] text-[#3f5c59]">
        {disciplines.map((d, i) => (
          <span key={d.name}>
            <span className="text-[#6fa39e]">{d.name}</span>
            {i < disciplines.length - 1 && <span className="mx-2">·</span>}
          </span>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-3 z-50 text-center font-mono text-[10px] tracking-[0.3em] text-[#33514e]">
        ↓ KEŞFET
      </div>
    </section>
  );
}

"use client";

import { useRef } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { SectionAtmosphere } from "@/components/ui/SectionAtmosphere";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DisciplineWheel } from "@/components/ui/DisciplineWheel";
import { vision, mission } from "@/lib/content";

function Statement({
  tag,
  label,
  body,
}: {
  tag: string;
  label: string;
  body: string;
}) {
  return (
    <div className="flex h-full gap-5 md:gap-6">
      <span aria-hidden className="spine mt-1 w-[2px] shrink-0 self-stretch" />
      <div>
        <span className="mb-3 block font-mono text-[11px] uppercase tracking-[0.28em] text-brand-turq/80">
          {tag}
        </span>
        <h3 className="mb-4 font-display text-3xl text-ink md:text-4xl">{label}</h3>
        <p className="text-[17px] leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  );
}

export function VisionMission() {
  const secRef = useRef<HTMLElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const sec = secRef.current;
    const spot = spotRef.current;
    if (!sec || !spot) return;
    const r = sec.getBoundingClientRect();
    spot.style.background = `radial-gradient(600px circle at ${e.clientX - r.left}px ${e.clientY - r.top}px, rgba(46,197,175,0.08), transparent 60%)`;
  };

  return (
    <section
      id="vizyon"
      ref={secRef}
      onPointerMove={onMove}
      className="relative px-6 py-28 md:py-40"
    >
      <SectionAtmosphere tone="cool" variant={0} />
      <div ref={spotRef} aria-hidden className="pointer-events-none absolute inset-0 z-0" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <SectionHeader index="01" eyebrow="Neden buradayız?" title="Vizyon & Misyon" />

        {/* editorial statements */}
        <div className="grid gap-12 md:grid-cols-2 md:gap-16">
          <Reveal>
            <Statement tag="V — 01" label={vision.label} body={vision.body} />
          </Reveal>
          <Reveal delay={0.1}>
            <Statement tag="M — 02" label={mission.label} body={mission.body} />
          </Reveal>
        </div>

        {/* the theme — a scroll/hover wheel of disciplines */}
        <div className="mt-24 md:mt-32">
          {/* NB: the wheel is NOT wrapped in Reveal — a motion transform ancestor
              would break its position:sticky scroll-scrub on touch devices. */}
          <Reveal className="mb-12">
            <p className="kicker mb-3">Temamız</p>
            <h3 className="max-w-2xl font-display text-3xl leading-tight text-ink md:text-5xl">
              <span className="text-flow">Sirkülasyon</span> — yedi disiplin.
            </h3>
            <p className="mt-4 max-w-xl text-muted">
              Çalıştay, temasını yedi farklı disiplinle ele alıyor. Her birine göz
              at, neyi kapsadığını gör.
            </p>
          </Reveal>
          <DisciplineWheel />
        </div>
      </div>
    </section>
  );
}

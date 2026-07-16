"use client";

import { Reveal } from "@/components/motion/Reveal";
import { SectionAtmosphere } from "@/components/ui/SectionAtmosphere";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { about } from "@/lib/content";

/**
 * "AERO FRC Nedir?" — the FRC team behind the workshop. Intro copy on one side,
 * a branded, aspect-locked team-photo slot on the other. When the real photo
 * arrives it drops straight into the slot with zero layout shift.
 */
export function AboutAero() {
  return (
    <section id="aero-frc" className="relative overflow-hidden px-6 py-28 md:py-40">
      <SectionAtmosphere tone="warm" variant={0} />

      <div className="relative z-10 mx-auto max-w-6xl">
        <SectionHeader index="07" eyebrow={about.eyebrow} title={about.title} />

        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <Reveal>
            <div className="space-y-5">
              {about.body.map((p, i) => (
                <p key={i} className="text-[17px] leading-relaxed text-muted">
                  {p}
                </p>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <PhotoSlot ratio="4 / 3" featured caption={about.photoCaption} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

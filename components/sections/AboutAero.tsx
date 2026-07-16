"use client";

import Image from "next/image";
import { Reveal } from "@/components/motion/Reveal";
import { SectionAtmosphere } from "@/components/ui/SectionAtmosphere";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { about } from "@/lib/content";

const FRAME =
  "relative overflow-hidden rounded-2xl border border-hairline/70 bg-surface";

/**
 * "AERO FRC Nedir?" — the FRC team behind the workshop. Intro copy up top, then
 * a photo gallery: one wide team shot + two portrait detail shots, all sized by
 * aspect-ratio so the row stays even and there is no layout shift on load.
 */
export function AboutAero() {
  const { banner, robot, trophy } = about.photos;

  return (
    <section id="aero-frc" className="relative overflow-hidden px-6 py-28 md:py-40">
      <SectionAtmosphere tone="warm" variant={0} />

      <div className="relative z-10 mx-auto max-w-6xl">
        <SectionHeader index="07" eyebrow={about.eyebrow} title={about.title} />

        <Reveal className="mb-10 max-w-2xl md:mb-12">
          <div className="space-y-5">
            {about.body.map((p, i) => (
              <p key={i} className="text-[17px] leading-relaxed text-muted">
                {p}
              </p>
            ))}
          </div>
        </Reveal>

        {/* gallery: wide team photo + two portrait detail shots, one even row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Reveal className="col-span-2">
            <figure className={`${FRAME} aspect-[3/2]`}>
              <Image
                src={banner.src}
                alt={banner.alt}
                fill
                sizes="(max-width: 768px) 100vw, 560px"
                className="object-cover"
              />
            </figure>
          </Reveal>

          <Reveal delay={0.08}>
            <figure className={`${FRAME} aspect-[3/4]`}>
              <Image
                src={robot.src}
                alt={robot.alt}
                fill
                sizes="(max-width: 768px) 50vw, 280px"
                className="object-cover object-[50%_58%]"
              />
            </figure>
          </Reveal>

          <Reveal delay={0.16}>
            <figure className={`${FRAME} aspect-[3/4]`}>
              <Image
                src={trophy.src}
                alt={trophy.alt}
                fill
                sizes="(max-width: 768px) 50vw, 280px"
                className="object-cover"
              />
            </figure>
          </Reveal>
        </div>

        <Reveal className="mt-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-label">
            {about.photoCaption}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

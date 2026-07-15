"use client";

import { Reveal } from "@/components/motion/Reveal";
import { SectionAtmosphere } from "@/components/ui/SectionAtmosphere";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { teams, teamGallery } from "@/lib/content";

/**
 * "Ekibimiz" — the faces behind the workshop. Photos don't exist yet, so we
 * reserve a branded, aspect-locked slot for the whole team plus one per
 * committee (captioned). When real images arrive they drop straight in with
 * zero layout shift.
 */
export function TeamGallery() {
  return (
    <section id="ekibimiz" className="relative overflow-hidden px-6 py-28 md:py-40">
      <SectionAtmosphere tone="deep" variant={0} />

      <div className="relative z-10 mx-auto max-w-6xl">
        <SectionHeader
          index="03"
          eyebrow={teamGallery.eyebrow}
          title={teamGallery.title}
        />

        <Reveal className="mb-12 max-w-2xl">
          <p className="text-lg leading-relaxed text-muted">{teamGallery.intro}</p>
        </Reveal>

        {/* featured group photo */}
        <Reveal className="mb-4">
          <PhotoSlot
            ratio="16 / 7"
            featured
            caption={teamGallery.groupCaption}
          />
        </Reveal>

        {/* genel koordinatörler — two double-width slots sitting right under the
            group photo; together they fill the same track as four committee
            slots. 8/5 keeps the row exactly as tall as a committee row. */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          {teamGallery.coordinators.map((c, i) => (
            <Reveal key={c.name} delay={i * 0.06}>
              <PhotoSlot ratio="8 / 5" caption={`${c.name} · ${c.role}`} />
            </Reveal>
          ))}
        </div>

        {/* one slot per committee, captioned with the team name */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {teams.committees.map((c, i) => (
            <Reveal key={c.name} delay={(i % 4) * 0.06}>
              <PhotoSlot ratio="4 / 5" caption={c.name} />
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-label">
            {teamGallery.note}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

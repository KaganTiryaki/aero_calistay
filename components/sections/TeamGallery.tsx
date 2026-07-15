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
  const rowCommittee = teams.committees.find(
    (c) => c.name === teamGallery.rowCommittee,
  );
  const gridCommittees = teams.committees.filter(
    (c) => c.name !== teamGallery.rowCommittee,
  );

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

        {/* genel koordinatörler + rowCommittee — one full-width band right under
            the group photo. sm+: three across, 13/12 keeps the row exactly as
            tall as the four-up committee row below it. Mobile: two across at the
            committee's own 4/5 portrait, so the komite drops to the next line at
            normal size instead of stretching across. */}
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {teamGallery.coordinators.map((c, i) => (
            <Reveal key={c.name} delay={i * 0.06}>
              <PhotoSlot
                className="aspect-[4/5] sm:aspect-[13/12]"
                caption={
                  <>
                    {c.name}
                    {/* Ünvan ancak lg'de tek satıra sığıyor; dar slotta sarıp
                        "Görsel yakında" yazısının üstüne biniyordu. */}
                    <span className="hidden lg:inline"> · {c.role}</span>
                  </>
                }
              />
            </Reveal>
          ))}
          {rowCommittee && (
            <Reveal delay={0.12}>
              <PhotoSlot
                className="aspect-[4/5] sm:aspect-[13/12]"
                caption={rowCommittee.name}
              />
            </Reveal>
          )}
        </div>

        {/* one slot per committee, captioned with the team name */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {gridCommittees.map((c, i) => (
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

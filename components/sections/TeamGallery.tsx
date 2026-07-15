"use client";

import { Reveal } from "@/components/motion/Reveal";
import { SectionAtmosphere } from "@/components/ui/SectionAtmosphere";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { cn } from "@/lib/cn";
import { teams, teamGallery } from "@/lib/content";

/** Eş başkanlık: lead alanında " · " ile ayrılmış iki isim (bkz. Teams.tsx). */
const isPair = (lead: string) => lead.includes("·");

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

        {/* genel koordinatörler — full-width band right under the group photo.
            lg'de eş başkanlı komite slotuyla aynı genişlik ve oran (568×344), o
            yüzden alttaki satırlarla tam hizada. Dar ekranda dikey: 4/5. */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          {teamGallery.coordinators.map((c, i) => (
            <Reveal key={c.name} delay={i * 0.06}>
              <PhotoSlot
                className="aspect-[4/5] sm:aspect-[13/12] lg:aspect-[33/20]"
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
        </div>

        {/* one slot per committee, captioned with the team name. Eş başkanlı
            ekipler lg'de iki sütun kaplar — ikisi yan yana sığsın diye yatay.
            33/20, çift slotu tekli 4/5 komşusuyla aynı yükseklikte tutuyor
            (568/1.65 ≈ 344 ≈ 276×5/4). Dar ekranda hepsi tekil: telefonda çift
            sütun tüm satırı kaplayıp devleşiyordu. */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {teams.committees.map((c, i) => (
            <Reveal
              key={c.name}
              delay={(i % 4) * 0.06}
              className={isPair(c.lead) ? "lg:col-span-2" : undefined}
            >
              <PhotoSlot
                className={cn("aspect-[4/5]", isPair(c.lead) && "lg:aspect-[33/20]")}
                caption={c.name}
              />
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

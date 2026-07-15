"use client";

import { Reveal } from "@/components/motion/Reveal";
import { SectionAtmosphere } from "@/components/ui/SectionAtmosphere";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
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
  // Eş başkanlılar önce, tekliler sona. Tekliler yan yana düşünce satırlar
  // deliksiz kapanıyor ve Basın'ın çift slotu Teknik/Admin ikilisinin üstünde
  // kalıyor. sort kararlı, yani grup içi sıra content.ts'teki gibi korunuyor.
  const committees = [...teams.committees].sort(
    (a, b) => Number(isPair(b.lead)) - Number(isPair(a.lead)),
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

        {/* genel koordinatörler — full-width band right under the group photo.
            lg'de eş başkanlı komite slotuyla aynı genişlik ve oran (568×344), o
            yüzden alttaki satırlarla tam hizada. Dar ekranda dikey: 4/5. */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          {teamGallery.coordinators.map((c, i) => (
            <Reveal key={c.name} delay={i * 0.06}>
              <PhotoSlot
                className="aspect-[4/5] lg:aspect-[33/20]"
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
            ekipler iki sütun kaplar ve yatay (33/20) — iki kişi yan yana sığsın
            diye. Yatay oran, çift slotu her genişlikte tekli 4/5 komşusuyla aynı
            yükseklikte tutuyor (2 sütun ÷ 1.65 ≈ 1 sütun × 5/4), telefonda tüm
            satırı kaplasa bile boyu büyümüyor.
            Izgara 2 ya da 4 sütun: 7 çift + 2 tek = 16 sütun, ikisine de tam
            bölünüyor. 3 sütunda çift slotlar delik bırakırdı.
            dense: sıralama sayesinde bugün delik yok; ileride tek başkanlı bir
            ekip daha eklenirse kalan boşluğu sığan slotla doldurur. */}
        <div className="grid grid-flow-row-dense grid-cols-2 gap-4 lg:grid-cols-4">
          {committees.map((c, i) => (
            <Reveal
              key={c.name}
              delay={(i % 4) * 0.06}
              className={isPair(c.lead) ? "col-span-2" : undefined}
            >
              <PhotoSlot
                className={isPair(c.lead) ? "aspect-[33/20]" : "aspect-[4/5]"}
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

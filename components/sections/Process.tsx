"use client";

import { Reveal } from "@/components/motion/Reveal";
import { SectionAtmosphere } from "@/components/ui/SectionAtmosphere";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Cta } from "@/components/ui/Cta";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { process } from "@/lib/content";

export function Process() {
  return (
    <section id="surec" className="relative overflow-hidden px-6 py-28 md:py-40">
      <SectionAtmosphere tone="flux" variant={0} />

      <div className="relative z-10 mx-auto max-w-5xl">
        <SectionHeader index="04" eyebrow={process.eyebrow} title={process.title} />

        <Reveal className="mb-16 max-w-2xl">
          <p className="text-lg leading-relaxed text-muted">{process.intro}</p>
        </Reveal>

        {/* vertical timeline — a single flowing spine with glowing nodes */}
        <div className="relative">
          <div
            aria-hidden
            className="tl-line absolute left-[19px] top-3 bottom-6 w-[2px]"
          />

          <div className="flex flex-col gap-4">
            {process.steps.map((s, i) => (
              <Reveal key={s.step} delay={Math.min(i * 0.08, 0.28)}>
                <div className="group relative flex gap-6 md:gap-9">
                  {/* node column */}
                  <div className="relative flex w-10 shrink-0 justify-center pt-7">
                    <span className="tl-node z-10 h-3.5 w-3.5 rounded-full bg-brand-turq transition-transform duration-300 group-hover:scale-125" />
                  </div>

                  {/* card */}
                  <div className="panel relative flex-1 overflow-hidden p-6 transition-colors duration-300 hover:border-brand-turq/40 md:p-8">
                    {/* giant ghost step numeral */}
                    <span className="section-index pointer-events-none absolute -right-2 -top-6 select-none text-[6rem] leading-none opacity-40 md:text-[8rem]">
                      {s.step}
                    </span>
                    <div className="relative">
                      <p className="kicker mb-3 text-[11px]">Adım {s.step}</p>
                      <h3 className="mb-3 font-display text-2xl text-ink md:text-3xl">
                        {s.title}
                      </h3>
                      <p className="max-w-xl leading-relaxed text-muted">{s.body}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal
          delay={0.1}
          className="mt-16 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="max-w-md text-muted">
            Hazırsan başvur — birkaç dakika sürer.
          </p>
          <MagneticButton strength={0.2} radius={160}>
            <Cta label="Ekibe Katıl" />
          </MagneticButton>
        </Reveal>
      </div>
    </section>
  );
}

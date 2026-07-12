"use client";

import { Reveal } from "@/components/motion/Reveal";
import { SectionAtmosphere } from "@/components/ui/SectionAtmosphere";
import { CurrentField } from "@/components/ui/CurrentField";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Cta } from "@/components/ui/Cta";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { teams } from "@/lib/content";

export function Teams() {
  const committees = teams.committees;

  return (
    <section id="ekipler" className="relative overflow-hidden px-6 py-28 md:py-40">
      <SectionAtmosphere tone="deep" variant={1} swirl />
      <CurrentField />

      <div className="relative z-10 mx-auto max-w-6xl">
        <SectionHeader index="02" eyebrow={teams.eyebrow} title={teams.title} />

        <Reveal className="mb-14 max-w-2xl">
          <p className="text-lg leading-relaxed text-muted">{teams.intro}</p>
        </Reveal>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {committees.map((c, i) => (
            <Reveal key={c.name} delay={(i % 3) * 0.07}>
              <article className="panel group relative flex h-full flex-col overflow-hidden p-7 transition-all duration-300 hover:-translate-y-1 hover:border-brand-turq/40">
                {/* accent line grows on hover */}
                <span
                  aria-hidden
                  className="absolute left-0 top-0 h-[2px] w-full origin-left scale-x-0 bg-gradient-to-r from-brand-turq to-brand-cyan transition-transform duration-500 group-hover:scale-x-100"
                />
                {/* ghost index */}
                <span
                  aria-hidden
                  className="section-index pointer-events-none absolute -right-1 -top-5 select-none text-[5.5rem] leading-none opacity-25 transition-opacity duration-300 group-hover:opacity-45"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="relative">
                  <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-brand-turq/70">
                    Ekip · {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mb-3 font-display text-2xl text-ink">{c.name}</h3>
                  <p className="mb-6 text-sm leading-relaxed text-muted">{c.blurb}</p>

                  <div className="mb-6 flex flex-wrap gap-2">
                    {c.tasks.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-hairline/70 bg-void/40 px-3 py-1 text-[11px] leading-tight text-muted transition-colors duration-300 group-hover:border-brand-turq/30 group-hover:text-ink/80"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-hairline/50 pt-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-label">
                    Başkan · <span className="text-ink/80">{c.lead}</span>
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-turq/50 shadow-[0_0_8px_1px_rgba(84,227,229,0.5)] transition-transform duration-300 group-hover:scale-150" />
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        {/* CTA band */}
        <Reveal className="mt-14 flex flex-col items-start justify-between gap-6 rounded-2xl border border-hairline/60 bg-surface/30 p-8 sm:flex-row sm:items-center">
          <div>
            <p className="mb-1 font-display text-2xl text-ink">Sen de aramıza katıl.</p>
            <p className="text-muted">
              İlgilendiğin ekibe başkanının yönetiminde yardımcı üye ol.
            </p>
          </div>
          <MagneticButton strength={0.2} radius={160}>
            <Cta label={teams.cta} />
          </MagneticButton>
        </Reveal>
      </div>
    </section>
  );
}

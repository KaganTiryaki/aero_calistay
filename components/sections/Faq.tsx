"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { SectionAtmosphere } from "@/components/ui/SectionAtmosphere";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { faqs } from "@/lib/content";
import { cn } from "@/lib/cn";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="sss" className="relative overflow-hidden px-6 py-28 md:py-40">
      <SectionAtmosphere tone="calm" variant={0} flowlines />
      <div className="relative z-10 mx-auto max-w-6xl">
        {/* two-column (sticky header + accordion) only on wide desktops; on
            tablet/iPad and below it collapses to a single full-width column so
            questions run edge-to-edge and answers open downward, readable. */}
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeader index="05" eyebrow="SSS" title="Sıkça Sorulan Sorular" />
            <Reveal delay={0.1}>
              <p className="max-w-xs text-muted">
                Aradığın yanıt yoksa Instagram&apos;dan (@aero_cal) yazman yeterli.
              </p>
            </Reveal>
          </div>

          <div className="border-t border-hairline/50">
            {faqs.map((f, i) => {
              const isOpen = open === i;
              return (
                <Reveal key={i} delay={Math.min(i * 0.03, 0.15)}>
                  <div
                    className={cn(
                      "relative border-b border-hairline/50 pl-4 transition-colors",
                      isOpen && "bg-surface/25",
                    )}
                  >
                    {isOpen && (
                      <span aria-hidden className="spine absolute left-0 top-0 h-full w-[2px]" />
                    )}
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${i}`}
                      className="flex w-full items-center gap-5 py-6 text-left"
                    >
                      <span
                        className={cn(
                          "font-mono text-xs tabular-nums transition-colors",
                          isOpen ? "text-brand-turq" : "text-label",
                        )}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "flex-1 font-display text-lg transition-colors md:text-xl",
                          isOpen ? "text-ink" : "text-ink/80",
                        )}
                      >
                        {f.q}
                      </span>
                      <Plus
                        className={cn(
                          "h-5 w-5 shrink-0 text-brand-turq transition-transform duration-300",
                          isOpen && "rotate-45",
                        )}
                        strokeWidth={1.5}
                      />
                    </button>
                    <div
                      id={`faq-panel-${i}`}
                      role="region"
                      aria-hidden={!isOpen}
                      className="grid transition-[grid-template-rows] duration-300 ease-out"
                      style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                    >
                      <div className="overflow-hidden">
                        <p className="max-w-3xl pb-6 pl-10 pr-4 leading-relaxed text-muted">{f.a}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

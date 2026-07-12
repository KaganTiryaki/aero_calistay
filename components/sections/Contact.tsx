"use client";

import { useRef } from "react";
import { Instagram, Mail } from "lucide-react";
import { TikTokIcon } from "@/components/ui/TikTokIcon";
import { Reveal } from "@/components/motion/Reveal";
import { SectionAtmosphere } from "@/components/ui/SectionAtmosphere";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Cta } from "@/components/ui/Cta";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { contact, site } from "@/lib/content";

function PersonCard({
  role,
  name,
  email,
}: {
  role: string;
  name: string;
  email?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${-py * 5}deg) rotateY(${px * 5}deg)`;
    el.style.setProperty("--gx", `${e.clientX - r.left}px`);
    el.style.setProperty("--gy", `${e.clientY - r.top}px`);
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="panel group relative flex items-center justify-between overflow-hidden p-6"
      style={{ transition: "transform .2s ease-out", willChange: "transform" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(260px circle at var(--gx) var(--gy), rgba(46,197,175,0.14), transparent 60%)",
        }}
      />
      <div className="relative">
        <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brand-turq/70">
          {role}
        </div>
        <div className="font-display text-xl text-ink">{name}</div>
        {email && <div className="mt-1 text-sm text-muted">{email}</div>}
      </div>
      <span className="relative h-2 w-2 shrink-0 rounded-full bg-brand-turq/50 shadow-[0_0_10px_2px_rgba(84,227,229,0.5)]" />
    </div>
  );
}

export function Contact() {
  return (
    <section id="iletisim" className="relative overflow-hidden px-6 py-28 md:py-40">
      <SectionAtmosphere tone="warm" variant={1} />
      <div className="relative z-10 mx-auto max-w-6xl">
        <SectionHeader index="05" eyebrow="İletişim" title={contact.label} />

        <div className="grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="panel panel-accent flex h-full flex-col justify-between gap-8 p-8 md:p-10">
              <p className="text-lg leading-relaxed text-muted">{contact.intro}</p>

              <div className="flex flex-wrap gap-3">
                {site.socials.instagram ? (
                  <a
                    href={site.socials.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 rounded-full border border-hairline/70 bg-void/40 px-5 py-2.5 transition-colors duration-300 hover:border-brand-turq/50"
                  >
                    <Instagram className="h-5 w-5 text-brand-turq" strokeWidth={1.5} />
                    <span className="text-ink">{site.socials.instagramHandle}</span>
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-3 rounded-full border border-hairline/70 bg-void/40 px-5 py-2.5">
                    <Instagram className="h-5 w-5 text-brand-turq" strokeWidth={1.5} />
                    <span className="text-muted">{site.socials.instagramHandle}</span>
                  </span>
                )}
                {site.socials.tiktok && (
                  <a
                    href={site.socials.tiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 rounded-full border border-hairline/70 bg-void/40 px-5 py-2.5 transition-colors duration-300 hover:border-brand-turq/50"
                  >
                    <TikTokIcon className="h-[18px] w-[18px] text-brand-turq" />
                    <span className="text-ink">{site.socials.tiktokHandle}</span>
                  </a>
                )}
                {site.socials.email && (
                  <a
                    href={`mailto:${site.socials.email}`}
                    className="inline-flex items-center gap-3 rounded-full border border-hairline/70 bg-void/40 px-5 py-2.5 transition-colors duration-300 hover:border-brand-turq/50"
                  >
                    <Mail className="h-5 w-5 text-brand-turq" strokeWidth={1.5} />
                    <span className="text-ink">{site.socials.email}</span>
                  </a>
                )}
              </div>

              <div className="flex flex-col gap-4 pt-2">
                <MagneticButton>
                  <Cta label="Ekibe Katıl" />
                </MagneticButton>
                <p className="max-w-md font-mono text-[11px] leading-relaxed tracking-wide text-label">
                  {contact.kvkk}
                </p>
              </div>
            </div>
          </Reveal>

          <div className="flex flex-col gap-4">
            <Reveal>
              <PersonCard role={contact.advisor.role} name={contact.advisor.name} />
            </Reveal>
            {contact.coordinators.map((c, i) => (
              <Reveal key={i} delay={(i + 1) * 0.08}>
                <PersonCard role={c.role} name={c.name} email={c.email} />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

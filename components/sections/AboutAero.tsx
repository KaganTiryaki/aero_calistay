"use client";

import { useState } from "react";
import Image from "next/image";
import { Maximize2 } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { SectionAtmosphere } from "@/components/ui/SectionAtmosphere";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Lightbox } from "@/components/ui/Lightbox";
import { about } from "@/lib/content";

const FRAME =
  "relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-hairline/70 bg-surface";

/** A gallery tile: framed photo that opens the lightbox on click. */
function Tile({
  photo,
  aspect,
  sizes,
  imgClass,
  onOpen,
}: {
  photo: { src: string; alt: string };
  aspect: string;
  sizes: string;
  imgClass?: string;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className={`group ${FRAME} ${aspect}`}>
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes={sizes}
        className={`object-cover transition-transform duration-500 ease-[var(--ease-flow)] group-hover:scale-[1.04] ${imgClass ?? ""}`}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-t from-void/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-void/50 text-white backdrop-blur">
          <Maximize2 className="h-5 w-5" strokeWidth={1.5} />
        </span>
      </span>
    </button>
  );
}

/**
 * "AERO FRC Nedir?" — the FRC team behind the workshop. Intro copy up top, then
 * a photo gallery (one wide team shot + two portrait detail shots). Clicking any
 * photo opens it full-size in the Lightbox.
 */
export function AboutAero() {
  const { banner, robot, trophy } = about.photos;
  const items = [banner, robot, trophy];
  const [lb, setLb] = useState<number | null>(null);

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
            <Tile
              photo={banner}
              aspect="aspect-[3/2]"
              sizes="(max-width: 768px) 100vw, 560px"
              onOpen={() => setLb(0)}
            />
          </Reveal>

          <Reveal delay={0.08}>
            <Tile
              photo={robot}
              aspect="aspect-[3/4]"
              sizes="(max-width: 768px) 50vw, 280px"
              imgClass="object-[50%_58%]"
              onOpen={() => setLb(1)}
            />
          </Reveal>

          <Reveal delay={0.16}>
            <Tile
              photo={trophy}
              aspect="aspect-[3/4]"
              sizes="(max-width: 768px) 50vw, 280px"
              onOpen={() => setLb(2)}
            />
          </Reveal>
        </div>

        <Reveal className="mt-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-label">
            {about.photoCaption}
          </p>
        </Reveal>
      </div>

      <Lightbox
        photos={items}
        index={lb}
        onClose={() => setLb(null)}
        onNavigate={setLb}
      />
    </section>
  );
}

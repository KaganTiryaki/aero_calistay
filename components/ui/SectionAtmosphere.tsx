"use client";

/**
 * Per-section background "band": a colour-tinted pool of light with feathered
 * edges that melt into neighbouring sections, plus optional current-swirl and
 * flow-lines. Layered on top of the global <SiteBackground> to build a
 * continuous vertical colour journey down the page.
 */
type Tone = "cool" | "deep" | "flux" | "calm" | "warm" | "rise";

const TONES: Record<
  Tone,
  { pool: string; glowA: string; glowB: string; a: number; b: number }
> = {
  // Vizyon & Misyon — cool, contemplative teal
  cool: {
    pool: "radial-gradient(80% 60% at 50% 42%, rgba(6,195,169,0.14), transparent 68%)",
    glowA: "#06c3a9",
    glowB: "#2ec5af",
    a: 0.24,
    b: 0.18,
  },
  // Ekiplerimiz — the deepest, richest core of the descent
  deep: {
    pool: "radial-gradient(90% 70% at 50% 50%, rgba(9,26,32,0.9), rgba(5,9,12,0.4) 70%), radial-gradient(70% 55% at 50% 44%, rgba(46,197,175,0.16), transparent 66%)",
    glowA: "#06c3a9",
    glowB: "#43cbf1",
    a: 0.32,
    b: 0.26,
  },
  // Süreç — energetic mid-current, the "action" band
  flux: {
    pool: "radial-gradient(78% 60% at 50% 44%, rgba(46,197,175,0.13), transparent 68%)",
    glowA: "#2ec5af",
    glowB: "#54e3e5",
    a: 0.24,
    b: 0.2,
  },
  // SSS — calmer, cooler cyan
  calm: {
    pool: "radial-gradient(75% 60% at 62% 46%, rgba(67,203,241,0.10), transparent 68%)",
    glowA: "#2ec5af",
    glowB: "#43cbf1",
    a: 0.18,
    b: 0.2,
  },
  // İletişim — warmer, brighter cyan as the journey rises
  warm: {
    pool: "radial-gradient(80% 62% at 40% 48%, rgba(84,227,229,0.13), transparent 68%)",
    glowA: "#43cbf1",
    glowB: "#54e3e5",
    a: 0.26,
    b: 0.22,
  },
  // Footer — luminous resolution of the current
  rise: {
    pool: "radial-gradient(100% 80% at 50% 100%, rgba(46,197,175,0.16), transparent 70%)",
    glowA: "#2ec5af",
    glowB: "#54e3e5",
    a: 0.28,
    b: 0.24,
  },
};

const VARIANTS = [
  { ax: "left:-12vw", ay: "top:0%", bx: "right:-10vw", by: "bottom:6%" },
  { ax: "right:-12vw", ay: "top:4%", bx: "left:-8vw", by: "bottom:0%" },
];

export function SectionAtmosphere({
  tone = "cool",
  variant = 0,
  seam = true,
  swirl = false,
  flowlines = false,
}: {
  tone?: Tone;
  variant?: number;
  seam?: boolean;
  swirl?: boolean;
  flowlines?: boolean;
}) {
  const t = TONES[tone];
  const v = VARIANTS[variant % VARIANTS.length];
  const [aside, aval] = v.ax.split(":");
  const [avside, avval] = v.ay.split(":");
  const [bside, bval] = v.bx.split(":");
  const [bvside, bvval] = v.by.split(":");

  return (
    <>
      {seam && <div className="seam" style={{ top: 0 }} />}

      <div className="section-atmo">
        {/* the colour pool */}
        <div className="absolute inset-0" style={{ background: t.pool }} />

        {flowlines && <div className="flowlines" />}

        {swirl && (
          <div
            className="swirl"
            style={{
              width: "80vw",
              height: "80vw",
              left: "50%",
              top: "50%",
              marginLeft: "-40vw",
              marginTop: "-40vw",
              opacity: 0.7,
            }}
          />
        )}

        {/* two drifting aurora glows, positioned per variant */}
        <div
          className="aurora"
          style={
            {
              width: "40vw",
              height: "40vw",
              [aside]: aval,
              [avside]: avval,
              opacity: t.a,
              background: `radial-gradient(circle, ${t.glowA}, transparent 62%)`,
              animation: "aurora-a 28s ease-in-out infinite",
            } as React.CSSProperties
          }
        />
        <div
          className="aurora"
          style={
            {
              width: "34vw",
              height: "34vw",
              [bside]: bval,
              [bvside]: bvval,
              opacity: t.b,
              background: `radial-gradient(circle, ${t.glowB}, transparent 62%)`,
              animation: "aurora-b 34s ease-in-out infinite",
            } as React.CSSProperties
          }
        />
      </div>
    </>
  );
}

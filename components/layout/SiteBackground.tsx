import { Starfield } from "@/components/motion/Starfield";

/**
 * Global "deep current" surface behind everything: a luminous atmosphere
 * column, a pervasive twinkling starfield, slow drifting aurora ribbons and
 * film grain. Per-section colour is layered on top via <SectionAtmosphere>.
 */
export function SiteBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* base atmosphere so nothing is ever flat-black */}
      <div className="atmosphere" />

      {/* faint global grid, fading toward the fold */}
      <div
        className="grid-bg absolute inset-0 opacity-50"
        style={{
          maskImage: "radial-gradient(140% 110% at 50% 0%, #000 30%, transparent 88%)",
          WebkitMaskImage: "radial-gradient(140% 110% at 50% 0%, #000 30%, transparent 88%)",
        }}
      />

      {/* drifting aurora ribbons */}
      <div
        className="aurora"
        style={{
          width: "58vw",
          height: "58vw",
          left: "-18vw",
          top: "-10vh",
          opacity: 0.32,
          background: "radial-gradient(circle, #06c3a9, transparent 62%)",
          animation: "aurora-a 26s ease-in-out infinite",
        }}
      />
      <div
        className="aurora"
        style={{
          width: "50vw",
          height: "50vw",
          right: "-14vw",
          top: "38vh",
          opacity: 0.26,
          background: "radial-gradient(circle, #43cbf1, transparent 62%)",
          animation: "aurora-b 32s ease-in-out infinite",
        }}
      />
      <div
        className="aurora"
        style={{
          width: "42vw",
          height: "42vw",
          left: "30vw",
          bottom: "-16vh",
          opacity: 0.22,
          background: "radial-gradient(circle, #54e3e5, transparent 62%)",
          animation: "aurora-c 29s ease-in-out infinite",
        }}
      />

      {/* pervasive twinkling starfield */}
      <Starfield />

      {/* film grain to kill banding */}
      <div className="grain-overlay" style={{ opacity: 0.05, position: "absolute" }} />
    </div>
  );
}

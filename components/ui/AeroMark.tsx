/**
 * AERO brand mark — the club emblem: an upward jet/rocket "A" drawn as teal
 * line-art. Nose apex on top, two swept wings splaying to a wide base, a
 * central notched fin, and two small winglets. Pure vector so it stays crisp
 * from a 16px favicon up to hero size.
 *
 * NB: the gradient id is fixed; multiple instances on a page produce duplicate
 * <linearGradient id> defs, which every browser resolves to the first match —
 * visually identical since they're the same gradient. Kept hook-free so it can
 * render in server components too.
 *
 * To use the club's own raster instead: drop it at /public/aero-logo.svg (or
 * .png) and swap this component for an <Image>.
 */
export function AeroMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id="aero-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#06c3a9" />
          <stop offset="0.55" stopColor="#12c6b0" />
          <stop offset="1" stopColor="#2ec5af" />
        </linearGradient>
      </defs>
      <g
        stroke="url(#aero-mark-g)"
        strokeWidth="4"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* swept wings */}
        <path d="M50 12 L15 86 L44 70 Z" />
        <path d="M50 12 L85 86 L56 70 Z" />
        {/* central notched fin */}
        <path d="M44 70 L47 49 L50 55 L53 49 L56 70 L50 83 Z" />
        {/* winglets */}
        <path d="M44 55 L32 57 L33 64 L45 62 Z" />
        <path d="M56 55 L68 57 L67 64 L55 62 Z" />
      </g>
    </svg>
  );
}

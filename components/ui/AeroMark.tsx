/**
 * AERO brand mark — a winged arrowhead "A" (aero / upward current) in the
 * teal→cyan brand gradient, with a center crease that splits it into two
 * folded wings. Pure vector, so it stays crisp from 16px favicon to hero size.
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
          <stop offset="0.5" stopColor="#2ec5af" />
          <stop offset="1" stopColor="#43cbf1" />
        </linearGradient>
      </defs>
      {/* winged arrowhead + center crease (evenodd cuts the crease as a slit) */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="url(#aero-mark-g)"
        d="M50 9 L85 87 L50 66 L15 87 Z M50 20 L53.5 60 L46.5 60 Z"
      />
    </svg>
  );
}

/**
 * AERO brand mark — the club's own emblem, vectorized from the source logo
 * (traced to a crisp SVG at /public/aero-logo.svg) so it stays sharp at any
 * size. Sizing comes from `className` (e.g. h-16 w-16); pass `title` for an
 * accessible label, omit it to render decoratively.
 *
 * Plain <img> on purpose: it works in both server and client components and
 * needs no next/image config for a tiny cached asset.
 */
export function AeroMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/aero-logo.svg"
      alt={title || ""}
      aria-hidden={title ? undefined : true}
      className={className}
      draggable={false}
    />
  );
}

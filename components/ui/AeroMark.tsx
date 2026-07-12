/**
 * AERO brand mark — the club's own emblem (teal line-art), served as a
 * transparent PNG at /public/aero-logo.png (white keyed out from the source
 * so it sits cleanly on the dark UI). Sizing comes from `className`
 * (e.g. h-16 w-16); pass `title` for an accessible label, omit it to render
 * decoratively.
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
      src="/aero-logo.png"
      alt={title || ""}
      aria-hidden={title ? undefined : true}
      className={className}
      draggable={false}
    />
  );
}

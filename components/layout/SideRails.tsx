import { site } from "@/lib/content";

/** Fixed vertical edge labels — a framed, "designed" feel. Desktop only. */
export function SideRails() {
  return (
    <>
      <span
        aria-hidden
        className="rail left-4 hidden -translate-y-1/2 rotate-180 [writing-mode:vertical-rl] lg:block"
      >
        {site.school} · {site.event} {site.year}
      </span>
      <span
        aria-hidden
        className="rail right-4 hidden -translate-y-1/2 [writing-mode:vertical-rl] lg:block"
      >
        Başvurular Açık · {site.year}
      </span>
    </>
  );
}

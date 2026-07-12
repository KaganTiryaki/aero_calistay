import { site } from "@/lib/content";
import { cn } from "@/lib/cn";

/**
 * The one precious action. Uses the brand flow gradient with a soft glow.
 * Points to the Google Form when `site.applyUrl` is set; otherwise stays an
 * inert placeholder so the layout is complete before the link exists.
 */
export function Cta({
  label,
  className,
  size = "lg",
}: {
  label: string;
  className?: string;
  size?: "lg" | "sm";
}) {
  const href = site.applyUrl || "#";
  const external = Boolean(site.applyUrl);

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn(
        "group relative inline-flex items-center gap-3 rounded-full bg-flow font-medium text-[#032019]",
        "ring-1 ring-inset ring-white/25 transition-shadow duration-300",
        size === "lg" ? "px-8 py-4 text-[17px]" : "px-5 py-2.5 text-sm",
        className,
      )}
      style={{ boxShadow: "var(--shadow-glow)" }}
    >
      <span>{label}</span>
      <span
        aria-hidden
        className="transition-transform duration-300 group-hover:translate-x-1"
      >
        →
      </span>
    </a>
  );
}

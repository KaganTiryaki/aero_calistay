import { Instagram } from "lucide-react";
import { TikTokIcon } from "@/components/ui/TikTokIcon";
import { SectionAtmosphere } from "@/components/ui/SectionAtmosphere";
import { footer, site } from "@/lib/content";

export function Footer() {
  const [firstWord, ...restWords] = site.event.split(" ");
  const rest = restWords.join(" ");

  return (
    <footer className="relative overflow-hidden border-t border-hairline/50 px-6 py-16">
      <SectionAtmosphere tone="rise" variant={0} seam={false} />
      <div className="relative z-10 mx-auto max-w-6xl">
        <p className="mb-12 font-display text-3xl leading-tight text-ink/90 md:text-5xl">
          <span className="text-flow-anim">{firstWord}</span>
          {rest && <> {rest}</>} <span className="text-muted">{site.year}</span>
        </p>

        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <span className="font-mono text-[12px] uppercase tracking-[0.28em] text-ink/80">
            {site.school}
          </span>

          <div className="flex items-center gap-5">
            {site.socials.instagram ? (
              <a
                href={site.socials.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Instagram ${site.socials.instagramHandle}`}
                className="flex items-center gap-2 text-muted transition-colors hover:text-brand-turq"
              >
                <Instagram className="h-5 w-5" strokeWidth={1.5} />
                <span className="font-mono text-xs tracking-wide">
                  {site.socials.instagramHandle}
                </span>
              </a>
            ) : (
              <span className="flex items-center gap-2 font-mono text-xs tracking-wide text-label">
                <Instagram className="h-5 w-5" strokeWidth={1.5} />
                {site.socials.instagramHandle}
              </span>
            )}
            {site.socials.tiktok && (
              <a
                href={site.socials.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`TikTok ${site.socials.tiktokHandle}`}
                className="flex items-center gap-2 text-muted transition-colors hover:text-brand-turq"
              >
                <TikTokIcon className="h-[18px] w-[18px]" />
                <span className="font-mono text-xs tracking-wide">
                  {site.socials.tiktokHandle}
                </span>
              </a>
            )}
          </div>
        </div>

        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.2em] text-label">
          {footer.rights}
        </p>
      </div>
    </footer>
  );
}

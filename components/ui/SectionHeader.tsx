import { Reveal } from "@/components/motion/Reveal";

/** Rich editorial section header: giant gradient index + eyebrow + title + flowing rule. */
export function SectionHeader({
  index,
  eyebrow,
  title,
}: {
  index: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <Reveal className="mb-14 md:mb-20">
      <div className="flex items-end gap-5 md:gap-8">
        <span className="section-index text-[4.5rem] md:text-[9rem]">{index}</span>
        <div className="pb-2 md:pb-4">
          <p className="kicker mb-3">{eyebrow}</p>
          <h2 className="font-display text-4xl leading-[0.95] text-ink md:text-6xl">
            {title}
          </h2>
        </div>
      </div>
      <div className="rule-flow mt-8" />
    </Reveal>
  );
}

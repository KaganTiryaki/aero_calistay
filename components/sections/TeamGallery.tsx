"use client";
import { Reveal } from "@/components/motion/Reveal";
import { SectionAtmosphere } from "@/components/ui/SectionAtmosphere";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { teams, teamGallery } from "@/lib/content";
export function TeamGallery(){
 return <section id="ekibimiz" className="relative overflow-hidden px-6 py-20 md:py-32"><SectionAtmosphere tone="deep" variant={0}/><div className="relative z-10 mx-auto max-w-6xl"><SectionHeader index="3" eyebrow={teamGallery.eyebrow} title={teamGallery.title}/><Reveal className="mb-10 max-w-2xl"><p className="text-lg leading-relaxed text-muted">{teamGallery.intro}</p></Reveal><div className="grid gap-4 sm:grid-cols-2"><div className="panel p-6"><h3 className="mb-4 font-display text-xl text-ink">Genel koordinasyon</h3>{teamGallery.coordinators.map(c=><p key={c.name} className="mb-3 text-ink">{c.name}<span className="block text-sm text-muted">{c.role}</span></p>)}</div><div className="panel p-6"><h3 className="mb-4 font-display text-xl text-ink">Komite ekipleri</h3>{teams.committees.map(c=><p key={c.name} className="mb-3 text-ink">{c.name}<span className="block text-sm text-muted">{c.lead}</span></p>)}</div></div></div></section>;
}

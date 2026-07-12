import { StickyNav } from "@/components/nav/StickyNav";
import { Hero } from "@/components/hero/Hero";
import { VisionMission } from "@/components/sections/VisionMission";
import { Teams } from "@/components/sections/Teams";
import { TeamGallery } from "@/components/sections/TeamGallery";
import { Process } from "@/components/sections/Process";
import { Faq } from "@/components/sections/Faq";
import { Contact } from "@/components/sections/Contact";
import { Footer } from "@/components/layout/Footer";

export default function Page() {
  return (
    <>
      <StickyNav />
      <main>
        <Hero />
        <VisionMission />
        <Teams />
        <TeamGallery />
        <Process />
        <Faq />
        <Contact />
      </main>
      <Footer />
    </>
  );
}

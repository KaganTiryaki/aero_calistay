import { StickyNav } from "@/components/nav/StickyNav";
import { Hero } from "@/components/hero/Hero";
import { VisionMission } from "@/components/sections/VisionMission";
import { Teams } from "@/components/sections/Teams";
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
        <Process />
        <Faq />
        <Contact />
      </main>
      <Footer />
    </>
  );
}

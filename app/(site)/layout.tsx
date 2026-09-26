import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { Preloader } from "@/components/motion/Preloader";
import { Cursor } from "@/components/motion/Cursor";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { SiteBackground } from "@/components/layout/SiteBackground";
import { SideRails } from "@/components/layout/SideRails";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <Preloader />
      <SiteBackground />
      <ScrollProgress />
      <SideRails />
      <Cursor />
      <SmoothScroll>{children}</SmoothScroll>
    </MotionProvider>
  );
}

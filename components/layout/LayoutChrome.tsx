"use client";

import { usePathname } from "next/navigation";
import { Preloader } from "@/components/motion/Preloader";
import { Cursor } from "@/components/motion/Cursor";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { SiteBackground } from "@/components/layout/SiteBackground";
import { SideRails } from "@/components/layout/SideRails";

/**
 * Eski (reddedilen) koyu kimliğin global chrome'u. /mockups altındaki yeni
 * aydınlık konseptler kendi sahnesini kurar; bu katman oraya sızarsa
 * konsept kendi zemininde değil, koyu yıldız alanının üstünde görünür.
 * Yeni yön seçilip site kurulunca bu bileşen tamamen kalkacak.
 */
export function LayoutChrome() {
  const pathname = usePathname();

  if (pathname?.startsWith("/mockups")) return null;

  return (
    <>
      <Preloader />
      <SiteBackground />
      <ScrollProgress />
      <SideRails />
      <Cursor />
    </>
  );
}

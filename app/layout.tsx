import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fraunces, hanken, plexMono } from "@/lib/fonts";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { Preloader } from "@/components/motion/Preloader";
import { Cursor } from "@/components/motion/Cursor";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { SiteBackground } from "@/components/layout/SiteBackground";
import { SideRails } from "@/components/layout/SideRails";
import { site } from "@/lib/content";

const fullTitle = `${site.event} ${site.year} — ${site.school}`;

export const metadata: Metadata = {
  title: `${fullTitle} · Ekip Başvuruları`,
  description: `${site.school} ${site.event} ${site.year} için ekip başvuruları açıldı. Sanattan hukuka, felsefeden sosyolojiye disiplinlerin akıntısında düşün, sorgula, üret.`,
  openGraph: {
    title: fullTitle,
    description: "Ekip başvurularımız açıldı.",
    locale: "tr_TR",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#05090c",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="tr"
      className={`${fraunces.variable} ${hanken.variable} ${plexMono.variable}`}
    >
      <body>
        <Preloader />
        <SiteBackground />
        <ScrollProgress />
        <SideRails />
        <Cursor />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { site } from "@/lib/content";
import { GeometriHero } from "./GeometriHero";

export const metadata: Metadata = {
  title: `${site.event} ${site.year} — Grafik Geometri`,
  robots: { index: false, follow: false },
};

export default function GeometriMockupPage() {
  return <GeometriHero />;
}

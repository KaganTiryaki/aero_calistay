import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

/**
 * Type system.
 * latin-ext subset is MANDATORY for Turkish glyphs (İ ı ş ğ ç ö ü).
 * - Fraunces  → oversized editorial display (with italic for the flow-word)
 * - Hanken Grotesk → refined body / UI (distinctive, not Inter)
 * - IBM Plex Mono → instrumented kickers, labels, FRC readouts
 */
export const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

export const hanken = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-hanken",
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});

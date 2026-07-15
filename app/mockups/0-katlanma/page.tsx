import type { Metadata } from "next";
import { KatlanmaHero } from "./KatlanmaHero";

export const metadata: Metadata = {
  title: "Katlanma — konsept",
  robots: { index: false, follow: false },
};

/**
 * KATLANMA
 *
 * Aynı yüzeyin uzak iki noktasını birleştiren tek şey kattır. Disiplinler arası
 * düşünmenin fiziksel modeli bu; atom/DNA/nöron gibi ödünç alınmış bir bilim
 * ikonu değil, düz kâğıt — lise öğrencisinin bildiği bir jest.
 *
 * Sirkülasyon = katın sayfa üstünde gezmesi: her kat başka iki uzak noktayı
 * buluşturuyor, açılınca geriye kırık izi kalıyor, sayfa yaşadıklarını taşıyor.
 */
export default function Page() {
  return <KatlanmaHero />;
}

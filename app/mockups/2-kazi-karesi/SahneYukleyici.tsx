"use client";

import dynamic from "next/dynamic";

/*
 * three ~150KB gzip. ssr:false + dynamic ZORUNLU: ilk bundle'a girerse projenin
 * <150KB bütçesini tek başına yer. Sadece tuval client'ta yüklenir; UI (page.tsx)
 * sunucuda render edilir, yani metin ilk boyada zaten ekranda.
 */
const KaziSahnesi = dynamic(
  () => import("./KaziSahnesi").then((m) => m.KaziSahnesi),
  { ssr: false },
);

export function SahneYukleyici({ className }: { className?: string }) {
  return <KaziSahnesi className={className} />;
}

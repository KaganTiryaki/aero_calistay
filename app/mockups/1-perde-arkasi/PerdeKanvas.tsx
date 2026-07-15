"use client";

import dynamic from "next/dynamic";

/*
 * three ~150KB gzip. İlk bundle'a girerse sayfanın bütçesini tek başına yer;
 * bu yüzden sahne yalnızca istemcide, ssr:false ile yükleniyor.
 */
const Sahne = dynamic(
  () => import("./PerdeSahnesi").then((m) => m.PerdeSahnesi),
  { ssr: false },
);

export function PerdeKanvas() {
  return <Sahne />;
}

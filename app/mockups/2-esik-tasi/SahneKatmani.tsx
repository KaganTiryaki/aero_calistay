"use client";

import dynamic from "next/dynamic";
import styles from "./esik.module.css";

// three ~150KB gzip: ilk bundle'a girerse projenin <150KB bütçesini tek başına
// yer. Ayrı chunk + yalnızca istemci.
const EsikSahnesi = dynamic(
  () => import("./EsikSahnesi").then((m) => m.EsikSahnesi),
  { ssr: false },
);

export function SahneKatmani() {
  return (
    <div className={styles.sahne} aria-hidden="true">
      <EsikSahnesi />
    </div>
  );
}

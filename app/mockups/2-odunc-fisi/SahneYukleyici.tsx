"use client";

import dynamic from "next/dynamic";
import styles from "./fis.module.css";

/*
 * three ~150KB gzip. ssr:false ZORUNLU — ilk bundle'a girerse projenin <150KB
 * bütçesini tek başına yer. Server Component'te ssr:false yasak olduğu için
 * dinamik import bu ince istemci sarmalayıcısında yapılıyor; metin HTML'i
 * sunucuda kalıyor (LCP metnin kendisi, sahne değil).
 */
const FisSahnesi = dynamic(() => import("./FisSahnesi").then((m) => m.FisSahnesi), {
  ssr: false,
});

export function SahneYukleyici() {
  return <FisSahnesi sinif={styles.tuval} />;
}

/*
 * YÜRÜYEN IŞIK — mekânın ölçüleri ve ışığın güzergâhı.
 * ---------------------------------------------------------------------------
 * Birim = metre. Sahne ile UI aynı sayıları kullanır: alt şeritteki disiplin
 * ışıkları burada tanımlı göz merkezlerinden örnekleniyor, yani ekranda gördüğün
 * sıra dünyadaki sırayla birebir aynı.
 *
 * TASARIM KARARI — neden ÇEMBER değil, ZİYARET SIRASI:
 * Işık gözleri 0,1,2,3… diye sırayla gezmiyor. ZIYARET dizisi bilinçli olarak
 * karışık: ışık avluyu çaprazlıyor, uzağa gidip geri dönüyor. Sıralı gezinti bir
 * düzen (ve dolaylı olarak bir çember) kurardı; karışık gezinti sirkülasyonu bir
 * düzen değil bir ziyaret sırası olarak okutuyor. Yan fayda: her adım kadrajda
 * uzun bir yol demek → ilk 3 saniyede ışık gözle görülür biçimde yer değiştiriyor.
 */

import * as THREE from "three";

// ---- cephe: eyvan ortada, iki yanda üçer göz = 7 disiplin ------------------
// Göz sayısı TEK olsun diye eyvan merkezde: kompozisyon bir AYAĞA değil bir
// BOŞLUĞA göre simetrik. Metnin arkasındaki şey duvar değil, derinlik.
export const CEPHE_KALIN = 1.1;
export const CEPHE_YUKSEK = 13.0;
export const AYAK_EN = 0.7;

export const EYVAN_EN = 10.5;
export const EYVAN_OMUZ = 4.6; // kemer başlangıç yüksekliği
export const EYVAN_TEPE = 10.6;
export const EYVAN_DIP_Z = -11.0; // eyvanın dip duvarı: metnin gerçek fonu

export const GOZ_EN = 2.5;
export const GOZ_OMUZ = 3.2;
export const GOZ_TEPE = 4.6;

export const REVAK_DIP_Z = -6.0; // gözlerin arkasındaki örtülü galeri
export const REVAK_TAVAN = 6.5;

/** Göz merkezleri (x), soldan sağa. İndeks = disciplines[] indeksi. */
export const GOZ_X: readonly number[] = (() => {
  const yari = EYVAN_EN / 2;
  const a = yari + AYAK_EN + GOZ_EN / 2; // 7.2
  const b = a + AYAK_EN + GOZ_EN; // 10.4
  const c = b + AYAK_EN + GOZ_EN; // 13.6
  return [-c, -b, -a, 0, a, b, c];
})();

/** Cephenin yarı genişliği: son gözün dış ayağının kenarı. */
export const CEPHE_YARI = EYVAN_EN / 2 + 3 * (AYAK_EN + GOZ_EN) + AYAK_EN; // 15.55

// ---- ışığın gezinti sırası -------------------------------------------------
// Ardışık hiçbir çift komşu değil; adım boyları da bilinçli olarak eşit değil
// (kısa adım bir es, uzun adım bir kat ediş gibi okuyor).
export const ZIYARET: readonly number[] = [1, 4, 6, 3, 0, 5, 2];

/** Tam tur. Jüri notu bağlayıcı: 24 s "hiçbir şey olmuyor" okuyor. 7 ziyaret
 *  × 2.2 s → kullanıcının baktığı ilk 6 saniyede ~2.5 ziyaret + iki uzun kat. */
export const DONGU = 15.4;

const IC_Z = -2.2; // gözün ağzında: ışık göze GİRİYOR
const DIS_Z = 2.9; // avluda: iki ziyaret arasında dışarı çıkıyor
const IC_Y = 2.15;
const DIS_Y = 2.35;

/** Kapalı Catmull-Rom: [iç_0, dış_0, iç_1, dış_1, …]. Nokta j → u = j/14. */
export function yolCizgisi() {
  const n = ZIYARET.length;
  const noktalar: THREE.Vector3[] = [];
  for (let k = 0; k < n; k++) {
    const x = GOZ_X[ZIYARET[k]];
    const xSonraki = GOZ_X[ZIYARET[(k + 1) % n]];
    noktalar.push(new THREE.Vector3(x, IC_Y, IC_Z));
    // Ara nokta iki gözün ortasında ama avluya doğru dışarıda: ışık gözden
    // ÇIKIP yürüyor, sonra öbürüne GİRİYOR. Düz kayma değil, bir gidiş.
    noktalar.push(new THREE.Vector3((x + xSonraki) * 0.5, DIS_Y, DIS_Z));
  }
  return new THREE.CatmullRomCurve3(noktalar, true, "centripetal", 0.5);
}

const yumusak = (x: number) => x * x * (3 - 2 * x);

/**
 * Zaman → eğri parametresi. Her ziyaretin son %22'sinde ışık DURUYOR: varış bir
 * duraklama, yani gerçekten bir "ziyaret". Kalan %78'de yol alıyor.
 * Nokta düzeni [iç,dış] olduğu için ziyaret k, u = 2k/14 → (2k+2)/14 aralığı.
 */
export function isikU(t: number) {
  const n = ZIYARET.length;
  const p = (((t / DONGU) % 1) + 1) % 1;
  const k = Math.floor(p * n);
  const l = p * n - k;
  const e = yumusak(Math.min(l / 0.78, 1));
  return (2 * k + 2 * e) / (2 * n);
}

/**
 * Her göz için 0..1 ışık payı — alt şeritteki disiplin adları bunu kullanıyor.
 * Işık avludayken (lz büyük) hiçbir göz "ziyaret ediliyor" saymaz: aradaki
 * yürüyüşte şeridin tamamı sönüyor. Okuma anı gerçekten dolaşıma bağlı.
 */
export function gozIsiklari(lx: number, lz: number, disari: number[]) {
  for (let i = 0; i < GOZ_X.length; i++) {
    const yan = THREE.MathUtils.clamp(1 - Math.abs(lx - GOZ_X[i]) / 4.6, 0, 1);
    const ic = THREE.MathUtils.clamp((1.6 - lz) / 3.4, 0, 1);
    disari[i] = yan * yan * ic;
  }
  return disari;
}

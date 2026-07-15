/**
 * ÖDÜNÇ FİŞİ — paylaşılan ölçüler.
 *
 * Bu dosya "harman"ın mühendisliği: kâğıttaki cetvel çizgilerini WebGL çiziyor,
 * metni HTML yazıyor. İkisi de BURADAN besleniyor, yoksa metin satırların
 * üstüne oturmaz. Sahne ile UI aynı ızgarayı paylaşır.
 *
 * Koordinat: "V" = kartın üstünden aşağı 0..1. UV'nin y'si tersidir (alttan).
 */

/** Kart, frustum'un kaçını kaplıyor (her iki eksende). Kalanı yığının payı. */
export const KART_KAPLAMA = 0.9;
/** Kartın ekranın üstünden başladığı yer (0..1). */
export const KART_UST = (1 - KART_KAPLAMA) / 2;

/* --- cetvel ızgarası ------------------------------------------------------ */
export const CIZGI_UST_V = 0.1;
export const CIZGI_ALT_V = 0.965;
export const SATIR_SAYISI = 15;
export const SATIR_ADIM_V = (CIZGI_ALT_V - CIZGI_UST_V) / SATIR_SAYISI;
/** Çizgi kalınlığı (V birimi). */
export const CIZGI_KALINLIK_V = 0.00055;

/** k. satırın çizgisinin kart V'si (0 = en üstteki çizgi). */
export const satirV = (k: number) => CIZGI_UST_V + (k + 1) * SATIR_ADIM_V;
/** k. satırın ekran yüzdesi (viewport üstünden). CSS bunu kullanır. */
export const satirYuzde = (k: number) => (KART_UST + satirV(k) * KART_KAPLAMA) * 100;
/** Bir satır adımının vh karşılığı — CSS satır yüksekliği bundan türer. */
export const SATIR_ADIM_VH = SATIR_ADIM_V * KART_KAPLAMA * 100;

/** Fişin kendi basılı dikey sütun çizgisi (kart U'su). Shader da bunu çiziyor. */
export const SUTUN_CIZGI_U = 0.085;
/** O çizginin viewport yüzdesi — nav ve metin bloğu ona hizalanır. */
export const SUTUN_YUZDE = (KART_UST + SUTUN_CIZGI_U * KART_KAPLAMA) * 100;

/* --- kaşe bandı ----------------------------------------------------------- */
/* Mürekkep BU banda hapsedilmiştir. Altındaki satırlar hiç boyanmaz: UI orada
 * yaşıyor. Perde değil — orası boş çünkü sıra sende. */
export const KASE_BANT_UST_V = 0.125;
export const KASE_BANT_ALT_V = 0.545;
/** Kaşenin en/boy oranı (mühür yüzü). Gerçek tarih kaşesi ~3.5:1. */
export const KASE_ORAN = 3.6;
/** Metin bölgesinin ilk satırı: mürekkep buraya asla inmez. */
export const ILK_BOS_SATIR = 8;

/** Ekranın en/boy oranına göre kaşe ızgarası.
 *
 * Dikey ekranda metin bloğu daha çok satır ister (başlık sarar), o yüzden
 * mürekkep bandı yukarı çekilir. Boş bölge her oranda metnin hakkı kadar. */
export function kaseIzgara(enBoy: number) {
  const yatay = enBoy > 1.25;
  const sutun = yatay ? 5 : 2;
  const satir = yatay ? 5 : 7;
  const altV = yatay ? KASE_BANT_ALT_V : 0.44;
  const adim = (altV - KASE_BANT_UST_V) / satir;
  return {
    sutun,
    satir,
    adim,
    kapasite: sutun * satir,
    yukseklikV: Math.min(0.078, adim * 0.92),
  };
}

/* --- palet (referans: @aero_cal · tek hue ailesi) -------------------------- */
export const RENK = {
  kagitAcik: "#f6f8f4",
  kagitKoyu: "#e9efe9",
  cizgi: "#a8cacb",
  murekkepYeni: "#0e4a46",
  murekkepEski: "#6fe0f0",
  cepKoyu: "#052d34",
  cepAcik: "#0f545c",
  golge: "#02171c",
  toz: "#a8ecf4",
} as const;

/*
 * ÇÖZÜLEN GÖLGE — geometri & döngü matematiği
 * ===========================================================================
 * Buradaki tek iddia şu: hizalanma AYARLANMIYOR, geometriden çıkıyor.
 *
 * Yönlü ışıkta (yön L) bir p noktasının duvardaki gölgesi p + L·t. Dolayısıyla
 * p ile p + a·L AYNI gölge noktasına düşer — L ekseni boyunca öteleme gölgeyi
 * DEĞİŞTİRMEZ. Aynı sebeple bir kutuyu L ekseni boyunca uzatmak da gölgesini
 * değiştirmez (uzatma = L boyunca ötelemelerin birleşimi).
 *
 * O yüzden kurulum şu:
 *   1. Hedef siluet (tek bant) L0'a DİK düzlemde tanımlanır.
 *   2. Bant hücrelere bölünür; her hücre bir kutunun KESİTİ olur.
 *   3. Her kutu yalnızca L0 ekseni boyunca ötelenir (a) ve uzatılır (len).
 *   → Gölgelerin birleşimi = hücrelerin birleşimi = bant. Her zaman. Tam.
 *
 * Bunun bedeli bir kısıt: parçalara DÖNÜŞ VERİLEMEZ. Dönüş kutunun L0'a dik
 * kesitini değiştirir, kesit değişince bant bozulur. Bütün örnekler tek ve
 * ortak bir yönelim paylaşır (aşağıdaki taban: U, V, L0).
 *
 * Işık L0'dan θ kadar saparsa, a ötelemeli bir parçanın gölgesi ≈ a·θ kadar
 * kayar. Kaçış a ile ORANTILI: a≈0 olan parçalar hiç dağılmaz. Bu yüzden
 * |a| ∈ [A_MIN, A_MAX] — sıfır çevresi bilinçli olarak BOŞ. Yoksa kaos anında
 * çizgi "gürültü içinde duran yoğun bir çekirdek" olarak hayatta kalır ve
 * çözülme okunmaz.
 */

// ---- taban: L0 = extrude ekseni ------------------------------------------
//
// L0 ağırlıklı olarak -z: gölgenin dip duvara düşmesi için şart. Hafif -y
// (gölge bulutun ~8 birim altına iner → olay duvarın ortasında, metnin
// üstünde) ve hafif -x (kamera SOLDA olduğu için kameraya bakan yüzler
// böylece ışığı ters açıyla alır → yapısal olarak gölgede).
export const L0: readonly [number, number, number] = [-0.12, -0.3, -0.95];

// Bant, L0'a dik düzlemde (U,V) tanımlı.
export const BANT_U = 22; // yarı uzunluk: çizgi kadrajı boydan boya geçer
const H_MIN = 0.22;
const H_MAX = 0.78;

/*
 * L0 boyunca dağılım — İŞARET TEK YÖNLÜ, bu şart:
 *
 * Bant düzlemi duvara L0 boyunca yalnız D0(=3) uzaklıkta. Öteleme +a duvara
 * DOĞRU gittiği için a > D0 olan her parça duvarın ARKASINA düşer: görünmez
 * olur ve duvarın ön yüzüne hiçbir şey düşürmez. İlk sürümde işaret rastgeleydi
 * → parçaların ~yarısı duvarın arkasındaydı ve her hücrenin kapsama garantisi
 * yazı-tura ile belirleniyordu; "kesintisiz ufuk" iddiası rastgele deliklerle
 * çöküyordu. Bu yüzden a HER ZAMAN NEGATİF: bütün bulut duvarla ışık arasında.
 *
 * Sıfır çevresi de boş (|a| ≥ A_MIN): kaçış a ile orantılı olduğu için a≈0 olan
 * parçalar hiç dağılmaz, çizgi kaos anında "gürültü içinde duran yoğun bir
 * çekirdek" olarak hayatta kalırdı.
 */
const A_MIN = 6;
const A_MAX = 26;

// Hücre bölme
const SUTUN_ADET = 26; // küme başına
const SATIR_BOL = 0.34; // hedef hücre yüksekliği (V) — satır sayısını bu belirler
const HUCRE_KOMSU_TASMA = 1.03; // bkz. hucreler(): dikiş kapatma

// ---- döngü ---------------------------------------------------------------
export const CEVRIM = 20; // saniye
const PENCERE = 0.22; // çözülme penceresinin yarı genişliği (faz cinsinden)
export const ACI_U = 0.2; // maks sapma (rad) — U ekseni etrafında
export const ACI_V = 0.19;

/** Deterministik gürültü — her yüklemede aynı kadraj. */
export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};

/** 6x⁵−15x⁴+10x³ — birinci VE ikinci türevi uçlarda sıfır. Çözülme anındaki
 *  "yavaşlama" bundan geliyor; smoothstep yeterince oyalanmıyordu. */
const smootherstep = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Yumuşak 1B değer gürültüsü — bandın kalınlık profili için. */
function gurultu1(x: number, rnd: () => number, n = 24) {
  const tepe = Array.from({ length: n }, () => rnd());
  return (u: number) => {
    const p = ((u % n) + n) % n;
    const i = Math.floor(p);
    const f = smoothstep(p - i);
    return tepe[i] * (1 - f) + tepe[(i + 1) % n] * f;
  };
}

/**
 * Bandın yarı kalınlığı. Sabit dikdörtgen bant CG kokuyor; bu profil ona
 * fırça darbesi ağırlığı veriyor — ortada dolgun, uçlarda inceliyor. Uçlarda
 * SIFIRA gitmiyor (dejenere hücre olurdu), 0.38'e kadar düşüyor: çizginin
 * kadraj kenarlarında kaleminin kalkması gibi.
 */
export function bantProfili(tohum: number) {
  const rnd = mulberry32(tohum);
  const g1 = gurultu1(0, rnd, 24);
  const g2 = gurultu1(0, rnd, 24);
  return (u: number) => {
    const s = (u + BANT_U) / (2 * BANT_U); // 0..1
    const konik = 0.38 + 0.62 * smoothstep(s / 0.16) * smoothstep((1 - s) / 0.16);
    const n = g1(s * 5.2) * 0.65 + g2(s * 11.7) * 0.35;
    return (H_MIN + (H_MAX - H_MIN) * n) * konik;
  };
}

export type Parca = {
  u: number;
  v: number;
  /** L0 boyunca merkez ötelemesi — gölgeyi ETKİLEMEZ. */
  a: number;
  /** kesit genişliği (U) */
  gu: number;
  /** kesit yüksekliği (V) */
  gv: number;
  /** L0 boyunca uzunluk — gölgeyi ETKİLEMEZ. */
  boy: number;
  /** hangi disipline ait (0..6) */
  kume: number;
};

/**
 * Bandı hücrelere böler ve her hücreye 1..4 parça asar.
 *
 * KAPSAMA GARANTİSİ: her hücrenin İLK parçası hücrenin kesitini TAM kaplar.
 * Bunların birleşimi = bant. Ek parçalar kesitin İÇİNDE küçültülür (alt küme →
 * birleşimi büyütmez, bozamaz) ve farklı a/boy alır: bulutu kalabalıklaştırır,
 * silueti çeşitlendirir, bandı bozmaz.
 *
 * DİKİŞLER: komşu hücreler tam teğet olsaydı gölge haritasının derinlik
 * hassasiyeti aralarında saç teli kalınlığında boşluklar bırakabilirdi —
 * "kesintisiz" iddiası oradan çatlardı. %3 taşma birleşimi ihmal edilebilir
 * miktarda büyütüyor, karşılığında dikişi imkânsız kılıyor.
 */
export function parcalar(kumeAdet: number, tohum = 20260715): Parca[] {
  const rnd = mulberry32(tohum);
  const h = bantProfili(tohum ^ 0x9e3779b9);
  const out: Parca[] = [];

  const kumeGen = (2 * BANT_U) / kumeAdet;

  for (let k = 0; k < kumeAdet; k++) {
    const u0 = -BANT_U + k * kumeGen;
    const gu = kumeGen / SUTUN_ADET;

    for (let c = 0; c < SUTUN_ADET; c++) {
      const uc = u0 + (c + 0.5) * gu;
      const hh = h(uc);

      // İnce bölgede az satır: hücreleri gölge haritası tekseli altına
      // düşürmenin anlamı yok.
      const satir = Math.max(1, Math.min(5, Math.round((2 * hh) / SATIR_BOL)));
      const gv = (2 * hh) / satir;
      // Parça boyu hücreyle ORANTILI olmalı, sabit değil: kesit küçüldükçe
      // sabit boy parçaları iğneye çeviriyor — spagetti okuması tam olarak bu.
      // ~1:1–3:1 civarı yonga hedefleniyor.
      const kesit = Math.max(gu, gv);

      for (let r = 0; r < satir; r++) {
        const vc = -hh + (r + 0.5) * gv;

        // --- kapsamayı garanti eden parça: kesiti hücrenin TAMAMI ---
        out.push({
          u: uc,
          v: vc,
          a: -(A_MIN + (A_MAX - A_MIN) * Math.pow(rnd(), 0.72)),
          gu: gu * HUCRE_KOMSU_TASMA,
          gv: gv * HUCRE_KOMSU_TASMA,
          // boy = L0 boyunca uzunluk → gölgeyi ETKİLEMEZ, yani bedava bir
          // sanat yönü kolu. İlk sürümde 0.8–5.0 SABİTTİ ve parçalar hepsi
          // aynı eksene paralel uzun çubuklar olduğu için tam da brief'in
          // uyardığı "spagetti/kibrit çöpü" gibi okuyordu.
          boy: kesit * (0.8 + rnd() * 2.2),
          kume: k,
        });

        // --- ek parçalar: kesitin alt kümesi, serbest a/boy ---
        const ek = rnd() < 0.55 ? (rnd() < 0.4 ? 2 : 1) : 0;
        for (let e = 0; e < ek; e++) {
          const kucult = 0.4 + rnd() * 0.5;
          out.push({
            // küçültülmüş kesit hücrenin İÇİNDE kalmalı → merkez kaydırması
            // kalan payla sınırlı. Taşarsa kapsama iddiası çöker.
            u: uc + (rnd() - 0.5) * gu * (1 - kucult),
            v: vc + (rnd() - 0.5) * gv * (1 - kucult),
            a: -(A_MIN + (A_MAX - A_MIN) * Math.pow(rnd(), 0.72)),
            gu: gu * kucult,
            gv: gv * kucult,
            boy: kesit * kucult * (0.8 + rnd() * 2.4),
            kume: k,
          });
        }
      }
    }
  }
  return out;
}

/**
 * Işığın sapması. Zarf e(p) ∈ [0,1] ile yön ψ(p) ayrı:
 *   · e = 0  → ışık TAM L0'da → hizalanma (ψ ne olursa olsun).
 *   · e = 1  → tam kaos; ψ dönmeye devam ettiği için gölgeler savruluyor.
 *
 * smootherstep zarfı p=0.5'te türevi de sıfırladığı için ışık çözülme açısında
 * belirgin biçimde YAVAŞLIYOR: e < 0.05 aralığı çevrimin ~%16'sı (20sn'de
 * ~3.2sn). Bu şart — düz sinüsle geçseydi hizalanma yarım saniyede olur,
 * kimse görmezdi.
 */
export function sapma(t: number): { u: number; v: number; e: number } {
  const p = ((t / CEVRIM) % 1 + 1) % 1;
  const x = Math.min(Math.abs(p - 0.5) / PENCERE, 1);
  const e = smootherstep(x);
  const psi = p * Math.PI * 2 + 0.6;
  return { u: e * ACI_U * Math.cos(psi), v: e * ACI_V * Math.sin(psi * 1.3), e };
}

/**
 * Şeride giden değer: 0 (kaos) → 1 (çözülmüş). Küme sırası U ekseni boyunca
 * soldan sağa dizili olduğu için disiplinler çizgiyle aynı sırada, hafif
 * gecikmeyle yanıyor: yedi ses, tek ufuk.
 */
export function cozulmeSerit(e: number, adet: number): number[] {
  const c = 1 - e;
  const kayma = 0.05;
  return Array.from({ length: adet }, (_, i) =>
    smoothstep((c - i * kayma) / (1 - (adet - 1) * kayma)),
  );
}

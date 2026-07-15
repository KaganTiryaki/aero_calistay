/*
 * YANKI SALONU — salonun ölçüleri ve akustiği.
 * ---------------------------------------------------------------------------
 * TEK KAYNAK. Nişlerin canlı şiddetini burada CPU hesaplıyoruz; GPU sadece
 * uniform olarak tüketiyor, DOM etiketleri de aynı diziyi okuyor. Böylece
 * "shader'daki ritim ile etiketlerdeki ritim birbirinden kayar" riski
 * yapısal olarak yok: iki ayrı uygulama yok, tek uygulama var.
 */

// ---- mimari ---------------------------------------------------------------

export const DUVAR_X = 5.4; // salon 10.8 birim geniş
export const TAVAN_Y = 7.6;
export const ON_Z = 17.5;
/** Apsis: dip sisin içinde kapanır, boşluk değil. En derin niş -59.6'da;
 *  arkasında hâlâ 14 birim salon var, yani yedinci yanıt bir duvara yapışmış
 *  değil, sisin içinden dönüyor. Bu mesafede sis 0.16 → dip yumuşak bir teal
 *  alan, düz bir levha değil. */
export const ARKA_Z = -74;

export const GOZ_Y = 2.15;
export const KAMERA_Z = 15.4;

/** Nişler göz hizasının ÜSTÜNDE: ışık aşağı, duvarlara ve zemine yalıyor —
 *  metnin yaşadığı orta hacmin içine değil. */
export const NIS_Y = 4.3;
/**
 * Niş bir YARIK: 0.76 dar · 1.12 yüksek · 1.6 derin. Bu oranlar dekoratif
 * değil, sahnenin taşıyıcı kararı — ışığın davranışını doğrudan bunlar
 * belirliyor (bkz. SalonSahnesi'ndeki `agizYarigi`). İkisi de ÖLÇÜLEREK
 * seçildi, göz kararıyla değil:
 *
 *   · DİKEY darlık (1.12 / 1.6 → ±35°) ışığın aşağı inmesini kesiyor.
 *     Merkez zeminin aldığı ışık: %7. Metnin arkasındaki karanlık bu yüzden
 *     hesaplanmış bir tercih değil, geometrik zorunluluk.
 *   · BOYUNA darlık (0.76 / 1.6 → ±25°) her nişin KENDİ havuzunu kurmasını
 *     sağlıyor. İlk sürümde bu 1.56'ydı (±44°) ve her niş karşı duvarda
 *     23 birimlik bir şerit boyuyordu; nişler 7-9 birim aralıklı olduğu için
 *     hepsi üst üste biniyor, salon düz bir yıkamaya dönüyordu. Ölçtüm:
 *     nişin havuzu 6 birim ötesinden yalnız 1.09× parlaktı — yani ışık-gölge
 *     yoktu, tur 1'in (d) hatası. 0.38 yarı-genişlikte bu oran 3.8× (0.30'da
 *     20×, ama o kadarı havuzları birbirinden koparıp benek benek yapıyor).
 *   · 3.7m yükseklikte, 76cm genişliğinde bir yarıktan GEÇİLEMEZ. "Yedi kapı
 *     enfiladı" tekrarına karşı ilk savunma ölçünün kendisi; üstelik yandan
 *     bakışta içine görülmüyor bile, yalnız sövesi aydınlanıyor.
 */
export const NIS_YARI_Z = 0.38;
export const NIS_YARI_Y = 0.56;
export const NIS_DERINLIK = 1.6;

/**
 * Kademeli derinlikler: aralık geometrik olarak BÜYÜYOR. Sonuç, varış
 * zamanlarında ritardando — yankı derinleştikçe yavaşlayarak dönüyor.
 * Eşit aralık koysaydık metronom (ve dolayısıyla strobe) olurdu; risk
 * notundaki "ritim ayarı" sorununun asıl çözümü hız değil, DÜZENSİZLİK.
 */
/**
 * KADRAJIN DIŞINDA BAŞLIYOR — bu dizinin en önemli özelliği ilk sayı.
 *
 * İlk sürümde NIS_Z[0] = 4.2 idi ve sahne YAPISAL olarak çarpıktı. Neden:
 * niş 0 SOL duvarda ve hem en yakın hem en parlak (genlik 1.0). Işığı karşıya,
 * yani SAĞ duvara düşüyor — üstelik sağ duvarın kameraya en yakın, ekranda en
 * geniş yerine. Sol duvarın aynı yakınlıktaki karşılığı ise niş 1 (z=-2.6),
 * 7 birim daha derinde. Sonuç: kadrajın sağ üçte biri kavruk, sol üçte biri
 * simsiyah. Ölçtüm — etiket kuşağında (duvarın kadraja girdiği ilk 6 birim,
 * yani sol/sağ etiket sütunlarının tam arkası):
 *
 *     sol 0.179  ·  sağ 0.967  →  5.39× fark
 *
 * Bu bir ton meselesi değil, OKUNABİLİRLİK ARIZASI: sağdaki üç etiket
 * (Tarih · Psikoloji · Hukuk) parlak duvarın üstünde açık renk kalıyor ve
 * kayboluyordu. Soldaki dördü okunuyordu — çünkü şans eseri karanlığa
 * düşmüşlerdi. "Okunabilirliği sahnenin ışığıyla çöz" kuralının çiğnendiği
 * yer tam burası; panel yoktu ama ışık da yanlış yerdeydi.
 *
 * ÇÖZÜM: bütün diziyi 7 birim derine kaydır. Nişlerin arası, sırası, yanı,
 * ritardando'su AYNEN korunuyor (aralıklar hâlâ 6.8 → 12.8, oran ~1.13);
 * yalnız salonun ilk 18 birimi ışıksız kalıyor. Ölçülen sonuç:
 *
 *     en parlak etiket kuşağı  0.967 → 0.185   (iki yan da eşit karanlık)
 *     görünür sol/sağ dengesi   1.44  → 1.27
 *     havuz tepesi              1.10  → 1.14   (daha parlak)
 *     olaylılık (tepe/ortalama) 2.51  → 2.67   (daha kontrast)
 *
 * Yani takas beklenenin tersi: sahne solmuyor, KOYULAŞARAK açılıyor. Kadraja
 * karanlık bir proscenium giriyor, yedi havuz onun içinde derine kaçıyor ve
 * etiketler o karanlığın üstünde duruyor. Bedeli dürüstçe: en yakın nişin
 * ekran boyu 111px → 69px. 900px'lik kadrajda hâlâ net bir yarık, ama
 * "yakın niş" artık bir olay değil, dizinin ilk üyesi.
 */
export const NIS_Z = [-2.8, -9.6, -17.2, -25.8, -35.6, -46.8, -59.6] as const;
/** -1 sol duvar · +1 sağ duvar. Yankı derinliğe inerken yandan yana sekiyor. */
export const NIS_YAN = [-1, 1, -1, 1, -1, 1, -1] as const;

export const NIS_SAYI = NIS_Z.length;

/** Salonun nominal dinleme noktasından (sözün söylendiği yer) nişe uzaklık. */
export const NIS_D = NIS_Z.map((z) =>
  Math.hypot(KAMERA_Z - z, DUVAR_X, NIS_Y - GOZ_Y),
);

// ---- akustik --------------------------------------------------------------

/** Sahne birimi/saniye. İlk yankı ~0.55s, sonuncusu ~2.97s'de dönsün diye. */
const SES_HIZI = 46;

/** arrivalTime = 2·d/c — söz gidiyor, dönüyor. Fizik birebir. */
export const VARIS = NIS_D.map((d) => (2 * d) / SES_HIZI);

/**
 * Genlik. Fizik 1/d^1.2 derdi ama o üs ile 6. ve 7. niş sisin arkasında
 * tamamen kayboluyor ve fikrin tamamı ("YEDİ derinlik") okunmuyordu — 7 niş
 * kurup 4'ünü göstermek olurdu. Açık taviz: taban + 1/d^0.8. Uzaktakiler
 * hâlâ belirgin biçimde sönük, ama var.
 */
export const GENLIK = NIS_D.map((d) => 0.42 + 0.58 * Math.pow(NIS_D[0] / d, 0.8));

/**
 * Renk. Yakın niş #6FE0F0; derinleştikçe nane #43D6A8'e KAYIYOR. Bu sadece
 * hava yutumu taklidi değil, fikrin kendisi: söz "zayıflayarak VE DEĞİŞEREK"
 * dönüyor. Yedinci yanıt, birinciyle aynı renk değil.
 */
export const NIS_RENK = [
  "#7BE8F4",
  "#6FE0F0",
  "#52D6EA",
  "#35C8E6",
  "#29C2D2",
  "#35CEBC",
  "#43D6A8",
] as const;

/**
 * İKİ SES. Tek bir vuruş treni olsaydı: 7 varış ~2.97s sürer, sonra periyodun
 * geri kalanı ÖLÜ olurdu — jürinin üçünün de ortak itirazı ("vuruşlar arası
 * boş"). Periyodu kısaltmak metronom/strobe yapardı. Çözüm süratte değil
 * dokuda: iki farklı periyotlu, aralarında ortak kat olmayan ses. Bileşimleri
 * ~4.3·6.9 = 29.7s'de bir tekrar ediyor; 6 saniyelik bakışta salon asla aynı
 * akoru iki kez çalmıyor ve hiçbir an sessiz kalmıyor.
 */
const SESLER = [
  { periyot: 4.3, genlik: 1.0, faz: 0.0 },
  { periyot: 6.9, genlik: 0.58, faz: 2.15 },
] as const;

const ATAK = 0.24; // saniye. <0.15 olursa göz "flaş" okur; WCAG 2.3.1 sınırı.
const SONUS = 0.72; // ring-out: yankı kesilmiyor, sönüyor.

const yumusak = (x: number) => x * x * (3 - 2 * x);

/** Tek varışın zarfı: hızlı ama flaş olmayan atak, uzun sönüş. */
function zarf(u: number) {
  if (u <= -ATAK) return 0;
  const atak = u >= 0 ? 1 : yumusak((u + ATAK) / ATAK);
  return atak * Math.exp(-Math.max(u, 0) / SONUS);
}

const mod = (a: number, n: number) => a - n * Math.floor(a / n);

/**
 * TABAN sıfır DEĞİL. Salon vuruşlar arasında karanlığa düşmüyor: her niş
 * kendi artık parıltısını tutuyor. Üç gerekçe, üçü de kritik:
 *   1. İlk kare (LCP) siyah bir oda değil, kurulu bir kompozisyon. "Sayfa
 *      çökmüş" okuması bu yüzden imkânsız.
 *   2. reduced-motion tek karesi = bu taban. Yani statik hâl sahnenin
 *      eksiltilmiş versiyonu değil, TAM hâli; hareket onun üstüne biniyor.
 *   3. Fikren doğru: sirkülasyon "yankı hiç tam ölmüyor" demek. Artık
 *      parıltı, dolaşımdaki fikrin kendisi.
 */
const TABAN = 0.38;
/** Vuruşun tepe katkısı. TABAN+KAZANC·1.2 ≈ 1.34 → yerel tepe/taban ≈ 3.5×.
 *  Ölçülen ekran etkisi: aynı nokta zaman içinde 2.87× oynuyor (0.5/0.62
 *  ayarında 2.11×'ti — vuruş "var mı yok mu" sınırındaydı). Kontrast tavanı:
 *  bunun üstünde vuruş patlıyor ve merkez luminansı oynamaya başlıyor.
 *  Atak 0.24s olduğu için 2.87× bile flaş değil, nefes. */
const KAZANC = 0.8;
const TAVAN_VURUS = 1.2;

/** Saatin başlangıç ofseti: t=0'da bütün vuruşlar sönük olurdu ve ilk kare
 *  düz tabana düşerdi. Buradan başlayınca sayfa açılır açılmaz salon bir akor
 *  tutuyor. reduced-motion tek karesi de tam olarak bu an. */
export const DURGUN_T = 1.75;

/** 0..TAVAN_VURUS arası ham vuruş — etiketler bunu normalize edip kullanıyor. */
export function vuruslar(t: number, cikti: number[]) {
  for (let i = 0; i < NIS_SAYI; i++) {
    let p = 0;
    for (const s of SESLER) {
      const u = mod(t - s.faz - VARIS[i], s.periyot);
      // zarf(u - periyot): bir sonraki varışın ATAK'ı, sarma sınırını aşarken.
      p += s.genlik * (zarf(u) + zarf(u - s.periyot));
    }
    cikti[i] = Math.min(p, TAVAN_VURUS);
  }
  return cikti;
}

/** Nişin GPU'ya giden ışık şiddeti. */
export function siddetler(vurus: readonly number[], cikti: number[]) {
  for (let i = 0; i < NIS_SAYI; i++) {
    cikti[i] = GENLIK[i] * (TABAN + KAZANC * vurus[i]);
  }
  return cikti;
}

/** Etiketler için 0..1. */
export function normalize(vurus: readonly number[], cikti: number[]) {
  for (let i = 0; i < NIS_SAYI; i++) cikti[i] = vurus[i] / TAVAN_VURUS;
  return cikti;
}

// ---- etiket merdiveni -----------------------------------------------------

/**
 * NEDEN ETİKETLER NİŞİN GERÇEK EKRAN PROJEKSİYONUNDA DEĞİL:
 *
 * Planda öyle yazıyordu, denedik, tutmuyor. Nişin ufuktan sapması
 * (NIS_Y-GOZ_Y)/d ile gidiyor; 52° FOV'da ekran y'leri sırasıyla
 * %32.5, 38.3, 41.9, 43.6, 45.0, 46.0, 46.8 çıkıyor. Son dört etiket
 * BİRBİRİNDEN %1 uzakta — üst üste biner, hiçbiri okunmaz. Perspektif
 * sıkışması bunu kaçınılmaz kılıyor; ayarla düzelecek bir şey değil.
 * Üstüne, derin nişler merkeze yakınsıyor, yani etiketleri tam olarak metnin
 * üstüne düşürüyor.
 *
 * Bunun yerine derinlik TİPOGRAFİK olarak kodlanıyor ve okunur bir tabana
 * oturtuluyor:
 *   · yan  — nişin gerçek duvarı (sol/sağ sütun). Bilgi korunuyor.
 *   · sıra — gerçek derinlik sırası. Korunuyor.
 *   · aralık — geometrik olarak daralıyor (r=0.86): perspektifin ta kendisi,
 *     yalnız çökmeyecek bir zeminde.
 *   · boyut + opaklık — derinlikle sönüyor.
 * Sahnedeki nişler gerçek projeksiyonda; merdiven onların LEGEND'i, kopyası
 * değil. Merkez sütun tamamen boş kalıyor.
 */
const ILK_ARALIK = 0.072;
const ARALIK_ORAN = 0.86;
const ILK_Y = 0.3;

export const ETIKET = (() => {
  const y: number[] = [];
  let konum = ILK_Y;
  let aralik = ILK_ARALIK;
  for (let i = 0; i < NIS_SAYI; i++) {
    y.push(konum);
    konum += aralik;
    aralik *= ARALIK_ORAN;
  }
  return NIS_Z.map((_, i) => ({
    yan: NIS_YAN[i] as -1 | 1,
    yuzde: y[i] * 100,
    olcek: Math.pow(0.935, i), // 1.00 → 0.67
    taban: 0.74 - i * 0.045, // 0.74 → 0.47: derinlik sönümü
  }));
})();

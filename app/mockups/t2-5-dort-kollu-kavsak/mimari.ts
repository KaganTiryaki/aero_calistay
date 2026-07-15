/*
 * DÖRT KOLLU KAVŞAK — paylaşılan geometri sabitleri + GLSL.
 * ---------------------------------------------------------------------------
 * Sahnenin TAMAMI tek bir analitik biçimden türüyor: iki beşik tonozun birleşimi.
 *
 *   tavan(x,z) = HS + sqrt(W² - min(x², z²))
 *
 * Bu tek satır hem koridorların tonozu hem de kavşaktaki ÇAPRAZ TONOZ. Çünkü
 * çapraz tonozun altındaki HACİM iki tünelin BİRLEŞİMİ (kesişimi değil) — bu
 * yüzden min(x²,z²), yani "iki kemerden YÜKSEK olanı". Kavşakta iki yüzey
 * |x|=|z| köşegenlerinde buluşuyor: gerçek tonoz sırtları (groin), CSG olmadan.
 *
 * Aynı fonksiyon üç yerde kullanılıyor ve hepsi birbirini doğruluyor:
 *   1. Tonoz mesh'lerinin discard'ı (birleşimin dışında kalan yüzeyi at).
 *   2. Ağız açıklığı testi = analitik gölge (aşağıya bkz).
 *   3. Hacimsel sis pass'inin ışık görünürlüğü → ışık huzmesi ile zemindeki
 *      "dil" AYNI matematikten çıkıyor, elle çizilmiş bir leke değil.
 */

// ---- ölçüler (metre) ------------------------------------------------------
/** Koridor yarı genişliği. Tonoz yarıçapı da bu → yarım daire kemer. */
export const W = 2.3;
/** Kemerin doğduğu yükseklik (impost). Tonoz tepesi = HS + W = 5.2. */
export const HS = 2.9;

/**
 * Kollar BİLİNÇLİ olarak eşit değil. Eşit uzunluk + eşit sis = oyun motoru
 * koridoru. Farklı derinlik + farklı sis + tek kolda kot farkı = mekân.
 */
export const KOL = {
  bati: 16.0, // ışık buradan gelir
  kuzey: 27.0, // en derin: metnin arkasındaki karanlık
  dogu: 8.5, // en kısa, en seyrek sis
  guney: 13.0, // kameranın içinde durduğu kol
} as const;

/** Batı kolu bir basamak YÜKSEK: ışık bir eşiğin üstünden dökülüyor. */
export const BATI_KOT = 0.25;

/**
 * Kol başına sis yoğunluğu (σ, 1/m). Hacimsel pass'in GLSL'i de, alt şeridin
 * parlaklığı da BURADAN türüyor — tek kaynak. Kuzey boğucu (metnin arkası),
 * doğu berrak. Eşit sis = oyun motoru koridoru.
 */
export const SIS_YOGUNLUK = {
  kuzey: 0.062,
  bati: 0.044,
  dogu: 0.019,
  guney: 0.030,
  kavsak: 0.036,
} as const;

/**
 * Işık kaynağı batı kolunun içinde, GÖZ HİZASININ ALTINDA (y≈1.3).
 * Bu yükseklik kompozisyonun kilidi: alçak ışık, ağızdan yayvan/sıyırıcı bir
 * kama hâlinde geçip kavşağın taşına uzanıyor ve orada ölüyor. Işığı yükseğe
 * koysaydık huzme kadrajın ortasını yıkardı ve metin ışığın ÜSTÜNE binerdi.
 * z'de hafif kaçık (0.35): tam simetrik dil "render" gibi okur.
 */
/**
 * Işık batı kolunun İÇİNDE ve YÜKSEKTE (y=3.8, tonoza yakın): kolun tavanındaki
 * görünmeyen bir delikten düşüyormuş gibi. Kaynak kadraja girmiyor, yaptığı iş
 * giriyor.
 *
 * İKİ KEZ TAŞINDI, ikisi de render'ın söylediğiyle:
 *  1. Önce (-9, 1.32): göz hizasında, yatay. Batı ve doğu AYNI beşik tonoz
 *     olduğu için huzme kavşaktan geçip doğu kolunu baştan sona yıkadı —
 *     "tek kol" iddiası çöktü.
 *  2. Asıl felaket hacimsel pass'te görüldü: yatay huzme, havada da parlayan
 *     YATAY BİR LEVHA demek. Kadrajın tam ortasına, metnin oturacağı yere
 *     boydan boya ışıyan bir buğu serdi. Sahne "sisli ve olaysız" çıktı.
 * Çözüm huzmeyi eksen boyunca değil DİK AŞAĞI atmak: kaynak yukarıda, nişan
 * kavşağın taşında. Huzme ağızdan girip zemine çakılıyor ve orada bitiyor;
 * kuzey kolu (metnin arkası) ile doğu kolu koninin AÇISAL olarak dışında kalıyor.
 */
export const ISIK_POS: readonly [number, number, number] = [-5.0, 3.8, 0.3];
/** Huzmenin çakıldığı taş: kavşağın ortası. "Dil" buradan doğuyor. */
export const ISIK_HEDEF: readonly [number, number, number] = [0.4, 0.0, 0.2];

const der = (d: number) => (d * Math.PI) / 180;
/** Koni yarı açıları (iç/dış) → penumbra.
 *  22°: kavşağın taşını dolduruyor ama doğu kolunu (ca≈0.909 < cos22°) DIŞARIDA
 *  bırakıyor. Açıyı büyütmek doğu kolunu geri açar — bu sayı kadrajın kilidi. */
export const KONI_IC = Math.cos(der(13));
export const KONI_DIS = Math.cos(der(22));

export const KAMERA_Y = 1.62;
/**
 * Kamera kavşağın AĞZINDA (z=3.3), güney kolunun içinde yalnız 1 m.
 *
 * DÜZELTİLDİ — bu sahnenin en büyük kusuru buradaydı. Önceki değer 6.2'ydi ve
 * o mesafeden yan kolları GÖRMEK GEOMETRİK OLARAK İMKÂNSIZDI: batı kolundaki bir
 * noktaya giden görüş doğrusu x=-W düzlemini |z|>W bölgesinde kesiyor, yani
 * güney kolunun KENDİ duvarı önce kapatıyor. Kadrajda ancak "koridor + dip
 * duvar" kalıyordu; render da tam olarak bunu gösterdi: kavşak değil, ODA.
 * "Dört ağız, dört ayrı derinlik" iddiası ekrana hiç ulaşmamıştı.
 *
 * z=3.3'te görüş doğrusu x=-W'yi |z|<W içinde (delikte) kesiyor → batı ve doğu
 * kolları AÇILIYOR. Kolların yalnız yakın kısmı görünüyor; dibi duvarın
 * arkasında kalıyor — mekânda doğrusu da bu.
 */
export const KAMERA_Z = 3.3;
/**
 * Geniş açı ZORUNLU: 52°'de tavan ancak 8.1 m ileride kadraja giriyordu, yani
 * sisin yuttuğu kuzey kolunun dibinde. Kadrajın üst %40'ı bomboş kalıyordu
 * ("olaysız" = reddedilme sebebi d). 68°'de tonoz 5.3 m'de giriyor: kavşağın
 * çapraz tonozu ve yan kemerler kadraja dahil.
 */
export const KAMERA_FOV = 68;

// ---- palet (IG referansı; tek hue ailesi + beyazın onlarca opaklığı) ------
/** Sahnenin EN KOYU değeri. Saf siyah yok — dip bu. */
export const KARANLIK = "#0e4a46";
export const ISIK_RENK = "#cfeef5"; // batıdan gelen ışık: beyaza yakın cyan
export const SEKME_RENK = "#43d6a8"; // taştan sekmiş nane — kavşağın yumuşak dolgusu
export const SIS_RENK = "#22b8dc"; // hacimsel sisin kendi rengi (çok düşük katkı)
export const TAS_RENK = "#dff2f4"; // taşın tam ışık altındaki albedosu

// ---- GLSL: her materyalin paylaştığı çekirdek ----------------------------
export const ORTAK_GLSL = /* glsl */ `
  const float W  = ${W.toFixed(3)};
  const float HS = ${HS.toFixed(3)};

  /* Çapraz tonoz dahil TÜM tavan. min() = iki kemerden yüksek olanı. */
  float tavan(vec2 p) {
    float m = min(abs(p.x), abs(p.y));
    return HS + sqrt(max(W * W - m * m, 0.0));
  }

  float hash31(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float gur3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
                   mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                   mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  /* ---- analitik gölge -----------------------------------------------------
   * Gölge haritası YOK. Işık batı kolunda; kavşağa ve öbür kollara ancak BATI
   * AĞZINDAN geçerek ulaşabilir. Ağız = x=-W düzlemindeki kemer biçimli delik.
   * Işıktan P'ye giden doğru parçası bu düzlemi nerede kesiyorsa, orada deliğin
   * içinde mi diye bakıyoruz. Tek bir smoothstep = penumbra.
   * Sonuç: zemindeki parlak dil, ağzın zemine düşen izdüşümünün TA KENDİSİ.
   */
  float agizX(vec3 A, vec3 B, float px) {
    float d = B.x - A.x;
    if (abs(d) < 1e-4) return 1.0;
    float t = (px - A.x) / d;
    if (t <= 0.0 || t >= 1.0) return 1.0;   // düzlemi hiç geçmiyor
    vec3 q = mix(A, B, t);
    float tv = tavan(vec2(px, q.z));
    return smoothstep(W, W - 0.30, abs(q.z))
         * smoothstep(-0.06, 0.30, q.y)
         * smoothstep(tv, tv - 0.50, q.y);
  }

  float agizZ(vec3 A, vec3 B, float pz) {
    float d = B.z - A.z;
    if (abs(d) < 1e-4) return 1.0;
    float t = (pz - A.z) / d;
    if (t <= 0.0 || t >= 1.0) return 1.0;
    vec3 q = mix(A, B, t);
    float tv = tavan(vec2(q.x, pz));
    return smoothstep(W, W - 0.30, abs(q.x))
         * smoothstep(-0.06, 0.30, q.y)
         * smoothstep(tv, tv - 0.50, q.y);
  }

  /* P noktası ışığı ne kadar görüyor? Hangi kolda olduğuna göre en fazla iki
     ağızdan geçmesi gerekir (batı ağzı + kendi kolunun ağzı). */
  float gorunurluk(vec3 L, vec3 P) {
    float v = 1.0;
    if (P.x > -W) v *= agizX(L, P, -W);
    if (P.x >  W) v *= agizX(L, P,  W);
    if (P.z < -W) v *= agizZ(L, P, -W);
    if (P.z >  W) v *= agizZ(L, P,  W);
    return v;
  }

  /* ters kare düşüm. d0=3 m → kaynağın yakını patlar (ACES yuvarlar),
     kavşakta ~0.1'e iner: dilin ÖLMESİ bu bölmenin sonucu. */
  float dusum(float d) {
    return 1.0 / (1.0 + (d * d) / 9.0);
  }

  /* Işığın bir noktaya bıraktığı TEK pay: düşüm × koni (penumbra) × ağız görünürlüğü.
     Hem taş pass'i hem hacimsel sis pass'i BUNU çağırıyor — o yüzden havadaki
     huzme ile zemindeki dil aynı şeyin iki yüzü, elle eşleştirilmiş iki efekt değil. */
  float isikPay(vec3 L, vec3 P, vec3 yon, float cosIc, float cosDis) {
    vec3 d = P - L;
    float dl = length(d);
    float ca = dot(d / max(dl, 0.001), yon);
    float koni = smoothstep(cosDis, cosIc, ca);
    if (koni <= 0.0) return 0.0;
    return dusum(dl) * koni * gorunurluk(L, P);
  }
`;

/** Deterministik gürültü — her yüklemede birebir aynı kadraj. */
export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

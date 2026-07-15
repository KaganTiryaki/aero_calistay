import { ORTAK_GLSL, SIS_YOGUNLUK as SY } from "./mimari";

/*
 * İki materyal var, ikisi de aynı ORTAK_GLSL'i paylaşıyor:
 *   1. TAS — bütün yüzeyler (zemin, duvar, tonoz, basamak, kapaklar).
 *   2. SIS — tam ekran hacimsel pass'i.
 * İkisi de AYNI `gorunurluk()` fonksiyonunu çağırıyor: yüzeydeki aydınlık leke
 * ile havadaki huzme aynı denklemin iki okuması, o yüzden birbirine oturuyorlar.
 */

// yuzey tipi: 0 = zemin, 1 = duvar, 2 = tonoz
export const TAS_VERT = /* glsl */ `
  varying vec3 vD;   // dünya konumu
  varying vec3 vN;   // dünya normali
  void main() {
    vec4 d = modelMatrix * vec4(position, 1.0);
    vD = d.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * d;
  }
`;

export const TAS_FRAG = /* glsl */ `
  uniform vec3  uIsikP;
  uniform vec3  uIsikYon;
  uniform float uKoniIc;
  uniform float uKoniDis;
  uniform vec3  uIsikRenk;
  uniform float uIsikGuc;
  uniform vec3  uSekmeRenk;
  uniform float uSekmeGuc;
  uniform vec3  uKaranlik;
  uniform vec3  uTasRenk;
  uniform float uYuzey;
  uniform int   uEksen;      // tonoz için: 0 = X beşiği, 1 = Z beşiği
  uniform float uKesme;      // 1 → birleşim discard'ı çalışsın

  varying vec3 vD;
  varying vec3 vN;

  ${ORTAK_GLSL}

  /* Taş dokusu: derz + blok başına değer oynaması + gren. Doku dosyası yok.
     Derz koordinatı yüzeye göre değişiyor, yoksa tonozda yatay çizgiler
     "sticker" gibi kayar. */
  vec2 derzUV() {
    if (uYuzey < 0.5) return vD.xz * 0.62;                 // zemin: büyük plaka
    if (uYuzey < 1.5) {
      // duvar: dizi yönü koridora göre
      float run = abs(vN.x) > 0.5 ? vD.z : vD.x;
      return vec2(run * 0.58, vD.y * 1.9);                 // sıra yüksekliği ~0.52 m
    }
    // tonoz: kemer boyunca açı + eksen boyunca mesafe (voussoir)
    float ax = uEksen == 0 ? vD.z : vD.x;
    float run = uEksen == 0 ? vD.x : vD.z;
    float aci = atan(ax, max(vD.y - HS, 0.001));
    return vec2(run * 0.62, aci * 2.4);
  }

  void main() {
    /* --- BİRLEŞİM CSG'si: iki beşiğin birleşimi dışında kalan yüzeyi at.
       Bu fragment'in temsil ettiği tavan, ÖTEKİ beşiğin tavanından alçaksa
       o hâlde bu parça öteki tünelin İÇİNDE gömülü kalıyor → görünmemeli.
       Köşegenlerde (|x|=|z|) iki koşul eşitlenir: tonoz sırtı oradan doğuyor. */
    if (uKesme > 0.5) {
      float oteki = uEksen == 0
        ? HS + sqrt(max(W * W - vD.x * vD.x, 0.0))   // Z beşiğinin tavanı
        : HS + sqrt(max(W * W - vD.z * vD.z, 0.0));  // X beşiğinin tavanı
      float kapsam = uEksen == 0 ? abs(vD.x) : abs(vD.z);
      if (kapsam <= W && oteki > vD.y + 0.002) discard;
    }

    /* Hepsi İÇ mekân yüzeyi: tonoz BackSide, duvarlar DoubleSide. Geometrinin
       normali dışarıyı gösteriyor → arka yüzde ters çevir, yoksa tonozun içi
       ışığa sırtını döner ve kavşak simsiyah çıkar. */
    vec3 N = gl_FrontFacing ? normalize(vN) : -normalize(vN);

    // --- taş ---
    vec2 uv = derzUV();
    vec2 blok = floor(uv);
    vec2 icDerz = abs(fract(uv) - 0.5);
    float derz = smoothstep(0.5, 0.42, max(icDerz.x, icDerz.y));  // 1 = blok içi
    float blokTon = 0.86 + hash31(vec3(blok, uYuzey)) * 0.28;
    float gren = gur3(vD * 26.0) * 0.10 + gur3(vD * 5.0) * 0.14;
    float asinma = gur3(vD * 1.7 + 11.0);
    vec3 albedo = uTasRenk * blokTon * (0.80 + gren) * mix(0.55, 1.0, derz);
    albedo *= mix(0.88, 1.06, asinma);

    // --- tek ışık: batı kolundan, alçak, zemine nişanlı sıyırıcı koni ---
    vec3 toL = uIsikP - vD;
    float dl = length(toL);
    vec3 L = toL / max(dl, 0.001);
    float lambert = max(dot(N, L), 0.0);
    vec3 dogrudan = uIsikRenk * uIsikGuc
                  * isikPay(uIsikP, vD, uIsikYon, uKoniIc, uKoniDis) * lambert;

    /* --- sekme: dilin çarptığı taştan kalkan dolgu. Kavşağın zemininde sanal bir
       kaynak; görünürlük testi YOK (dolaylı ışık köşeyi döner).
       Menzil iki ateş arasında: çok uzun → her yer nane (ilk render'da ds*0.55
       sahneyi boyamıştı), çok kısa → ds*1.7'de tonoz apeksine 0.032 düşüyordu,
       yani kadrajın üst yarısı ÖLÜYDÜ (reddedilme sebebi "olaysız").
       ds*1.25 ölçülerek seçildi (guc 0.55 ile):
         tonoz apeksi (5.1 m) 0.11 · kemer başlangıcı (3.0 m) 0.22
         kolun 8 m'si 0.048 · kuzeyin 14 m'si 0.016
       Yani ışık kavşağın taşına düşüyor, oradan sekip KAVŞAĞI dolduruyor
       (tonoz + dört kemer okunuyor), kollar karanlıkta kalıyor. Üstüne kolların
       sisi biniyor: ayrım daha da açılıyor. "Tek ışık kaynağı" bozulmadı —
       sekme o ışığın kendi ikinci sıçraması. */
    vec3 sp = vec3(0.0, 0.12, 0.0);
    float ds = length(sp - vD);
    float yukari = max(dot(N, normalize(sp - vD + vec3(0.0, 0.35, 0.0))), 0.0);
    /* yukari üssü: zemin kendi sekmesine YALAYAN açıyla bakar (yukari≈0.23),
       tonoz ise tam karşıdan (yukari≈1). Üs almak bu farkı açıyor → dolgu
       tonoza/kemere gidiyor, ayakların dibindeki zemini yakmıyor. Şeridin
       oturduğu bant bu sayede okunur kalıyor: perde değil, geometri. */
    vec3 sekme = uSekmeRenk * uSekmeGuc * dusum(ds * 1.25)
               * (0.16 + 0.84 * pow(yukari, 1.6));

    // --- dip: sahnenin en koyu değeri. Altına inilmiyor → saf siyah imkânsız.
    vec3 dip = uKaranlik * mix(0.5, 0.8, clamp(N.y * 0.5 + 0.5, 0.0, 1.0));

    gl_FragColor = vec4(dip + albedo * (dogrudan + sekme), 1.0);
  }
`;

/*
 * HACİMSEL SİS — depth texture tabanlı ray-march.
 * Bloom yerine bu: bloom parlak pikselleri şişirip şeker-cyan'a kaçırırdı.
 * Burada ışık havada GERÇEKTEN yol alıyor; ağızdan geçen kama, kolların farklı
 * yoğunluğu ve metnin arkasındaki karanlık hep aynı integralden çıkıyor.
 */
/* RawShaderMaterial: three hiçbir şey enjekte etmez → precision ve attribute'ları
   elle bildiriyoruz. Tam ekran üçgen/quad: projeksiyon yok, doğrudan clip space. */
export const SIS_VERT = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const sisFrag = (adim: number) => /* glsl */ `
  precision highp float;
  uniform sampler2D tRenk;
  uniform sampler2D tDerinlik;
  uniform mat4  uTersVP;
  uniform vec3  uKamera;
  uniform vec3  uIsikP;
  uniform vec3  uIsikYon;
  uniform float uKoniIc;
  uniform float uKoniDis;
  uniform vec3  uIsikRenk;
  uniform float uIsikGuc;
  uniform vec3  uSisRenk;
  uniform vec3  uKaranlik;
  uniform float uZaman;
  uniform float uPozlama;
  uniform vec2  uCozunurluk;

  varying vec2 vUv;

  ${ORTAK_GLSL}

  /* Kollar farklı yoğunlukta: kuzey boğucu, doğu berrak. "Aynı koridorun dört
     kopyası" okumasını kıran şeylerden biri bu. */
  float yogunluk(vec3 p) {
    float d;
    if (p.z < -W)      d = ${SY.kuzey};   // kuzey: en derin, en yoğun
    else if (p.x < -W) d = ${SY.bati};    // batı: ışıklı → sis GÖRÜNÜR olan kol
    else if (p.x >  W) d = ${SY.dogu};    // doğu: kısa ve berrak
    else if (p.z >  W) d = ${SY.guney};   // güney: kameranın kolu
    else               d = ${SY.kavsak};  // kavşak
    d *= 1.0 + 0.40 * (gur3(p * 0.26 + vec3(0.0, uZaman * 0.02, uZaman * 0.05)) - 0.5);
    d *= mix(1.30, 0.80, smoothstep(0.0, 4.2, p.y));  // ağır hava dipte
    return max(d, 0.0);
  }

  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }

  void main() {
    float dz = texture2D(tDerinlik, vUv).x;
    vec4 clip = vec4(vUv * 2.0 - 1.0, dz * 2.0 - 1.0, 1.0);
    vec4 dunya = uTersVP * clip;
    dunya /= dunya.w;

    vec3 ro = uKamera;
    vec3 fark = dunya.xyz - ro;
    float uzak = min(length(fark), 90.0);
    vec3 rd = fark / max(length(fark), 0.001);

    /* Zıplatma (jitter): bantlaşmayı öldürür. 18 adım az; bant yerine gren
       bırakmak doğru takas — üstüne CSS film greni de biniyor. */
    float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uZaman) * 43758.5453);
    float dt = uzak / float(${adim});

    vec3 birikim = vec3(0.0);
    float gecir = 1.0;

    for (int i = 0; i < ${adim}; i++) {
      float t = (float(i) + jit) * dt;
      vec3 p = ro + rd * t;
      float sig = yogunluk(p);

      /* Havadaki huzme: yüzeydeki dille AYNI isikPay(). Koni olmadan bu pass
         bütün kadrajı dolduran bir buğu üretiyordu — huzmenin kenarı olmuyordu. */
      vec3 kazanc = uIsikRenk * uIsikGuc
                  * isikPay(uIsikP, p, uIsikYon, uKoniIc, uKoniDis) * 0.38;
      kazanc += uSisRenk * 0.012 + uKaranlik * 0.045;   // dip saçılım: hiçbir yer boş değil

      birikim += gecir * sig * kazanc * dt;
      gecir *= exp(-sig * dt);
      if (gecir < 0.004) break;
    }

    vec3 col = texture2D(tRenk, vUv).rgb * gecir + birikim;

    // vinyet: kadrajın kenarını topla, gözü kavşağa çivile
    vec2 q = (vUv - 0.5) * vec2(uCozunurluk.x / max(uCozunurluk.y, 1.0), 1.0);
    col *= mix(1.0, 0.62, smoothstep(0.34, 1.02, length(q)));

    col = aces(col * uPozlama);
    col = pow(max(col, 0.0), vec3(1.0 / 2.2));   // lineer → sRGB (elle: pass ham)
    gl_FragColor = vec4(col, 1.0);
  }
`;

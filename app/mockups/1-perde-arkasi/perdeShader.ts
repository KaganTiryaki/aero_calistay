/*
 * PERDE ARKASI — arkadan aydınlatılmış bez perde ve arkasındaki siluetler.
 *
 * Fizik özeti (kodun tamamı bu üç satırdan çıkıyor):
 *   1) Transmisyon çarpımdır:  T = Π(1 − aᵢ). Sentez = çakışma = çarpımın dibi.
 *   2) Penumbra derinlikle genişler ve gölge çekirdeği aynı anda AÇILIR:
 *      perdeden uzaklaşan cisim hem bulanıklaşır hem soluklaşır (yaygın kaynak).
 *      Metin bandının arkası bu yüzden kendiliğinden sakin — perde/scrim yok.
 *   3) Beer–Lambert: ışık bezden geçerken kanal başına farklı sönüyor
 *      (sigma). Kırmızı en çok soğrulur → gölge kendiliğinden teal'e iner.
 *
 * Bezin kıvrımları gölgeyi BOZAR (gölge kumaşın üstüne düşer, kumaş düz değil):
 * örnekleme noktası kıvrım yüksekliği kadar ışık yönünde kayar. Düz quad'ın
 * üç boyutlu okumasının tek sebebi bu.
 */

export const perdeVert = /* glsl */ `
  uniform float uTime;
  uniform float uAspect;
  uniform float uCover;
  uniform float uFoldAmp;
  uniform float uFoldWorld;

  varying vec2  vP;
  varying float vFold;
  varying vec3  vNrm;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }

  // Yukarıdan asılı bir bezin sarkması: tepede çivili, aşağı indikçe serbest.
  float drape(vec2 p, float t) {
    float hang = smoothstep(0.58, -0.5, p.y);
    float ph = p.x * 9.0 + fbm(vec2(p.x * 1.2, t * 0.03)) * 3.0;
    float folds = sin(ph) * 0.5 + sin(ph * 0.43 + 1.7) * 0.34;
    float breath = sin(p.x * 2.3 - t * 0.19) * cos(p.y * 1.5 + t * 0.14) * 0.5;
    float crease = (fbm(p * 2.6 + vec2(t * 0.015, 0.0)) - 0.5) * 1.0;
    return (folds * 0.5 + breath * 0.3 + crease * 0.62) * hang * uFoldAmp;
  }

  void main() {
    vec2 p = (uv - 0.5) * uCover * vec2(uAspect, 1.0);
    vP = p;

    float e = 0.004;
    float h  = drape(p, uTime);
    float hx = drape(p + vec2(e, 0.0), uTime);
    float hy = drape(p + vec2(0.0, e), uTime);
    vFold = h;
    // p normalize edilmiş (x ve y aynı ölçekte) → gradyandan gerçek normal çıkar.
    vNrm = normalize(vec3(-(hx - h) / e, -(hy - h) / e, 1.0));

    vec3 pos = position;
    pos.z += h * uFoldWorld;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const perdeFrag = /* glsl */ `
  precision highp float;

  #define NFIG 6

  uniform float uTime;
  uniform float uAspect;
  uniform float uCover;
  uniform float uWeave;
  uniform int   uCount;
  uniform float uGrain;
  uniform vec4  uFigA[NFIG];  // x: temel x · y: y · z: derinlik 0..1 · w: hız
  uniform vec4  uFigB[NFIG];  // x: ölçek · y: tohum · z: yön (±1) · w: salınım

  varying vec2  vP;
  varying float vFold;
  varying vec3  vNrm;

  const vec3 LAMBA  = vec3(1.000, 0.984, 0.944);  // kremsi ampul
  const vec3 ONISIK = vec3(0.018, 0.045, 0.052);  // odanın soğuk ön dolgusu
  const vec3 SIGMA  = vec3(1.46, 0.70, 0.575);    // Beer–Lambert: kırmızı en çok söner
  const vec3 NANE   = vec3(0.263, 0.839, 0.659);  // #43D6A8
  const float KAYNAK = 0.022;                     // lambanın görünen büyüklüğü

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }

  float sdSeg(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
  }
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  // Filmik omuz: 0.82'nin üstü asimptotik olarak sıkışır, hiçbir kanal 1.0'a
  // ULAŞAMAZ. Askı kenarındaki sızıntı saf beyaza kırpılıyordu (ölü, dijital
  // bir leke); artık ışık beze doğru yumuşak yuvarlanıyor.
  vec3 omuz(vec3 c) {
    const float K = 0.82;
    vec3 hi = K + (1.0 - K) * (1.0 - exp(-(c - K) / (1.0 - K)));
    return mix(c, hi, step(vec3(K), c));
  }

  /*
   * Tek bir siluet. Blob değil: baş · gövde · eteklenen alt beden · iki
   * eklemli kol. Poz tohumdan geliyor, kollar çok yavaş açılıp kapanıyor —
   * "canlı ama tanımlanamaz". Boy ≈ 1.0 (y ∈ [-0.5, 0.5]).
   */
  float sdFigur(vec2 p, float seed, float t) {
    float s1 = fract(sin(seed * 12.9898) * 43758.5453);
    float s2 = fract(sin(seed * 78.2330) * 24634.6345);
    float s3 = fract(sin(seed * 43.7585) * 15731.7431);
    float w  = t * 0.28 + seed * 6.2831;

    // baş — hafif tereddütlü
    vec2 hc = vec2(0.02 + sin(w * 0.7) * 0.014, 0.395 + sin(w * 0.5) * 0.006);
    float d = length(p - hc) - 0.072;
    // boyun + gövde
    d = smin(d, sdSeg(p, vec2(0.005, 0.325), vec2(0.02, 0.02), 0.082), 0.045);
    // alt beden: aşağı doğru genişleyen bir giysi
    d = smin(d, sdSeg(p, vec2(0.015, 0.05), vec2(-0.03 + s1 * 0.07, -0.44),
                      0.07 + s2 * 0.035), 0.065);

    // ön kol (omuz → dirsek → el). Uzuvlar KALIN: deriden kesilmiş bir kukla
    // gibi. İnce çubuk kollar penumbra içinde eriyip lav lambası bırakıyordu.
    float a1 = mix(-2.55, 0.85, s1) + sin(w) * 0.24;
    float a2 = a1 + mix(-1.15, 1.15, s2) + sin(w * 1.27 + 1.0) * 0.3;
    vec2 sh = vec2(0.075, 0.275);
    vec2 el = sh + 0.155 * vec2(cos(a1), sin(a1));
    vec2 hd = el + 0.145 * vec2(cos(a2), sin(a2));
    d = smin(d, min(sdSeg(p, sh, el, 0.045), sdSeg(p, el, hd, 0.034)), 0.036);
    // bazı figürler elinde bir şey taşıyor (yassı bir disk)
    d = smin(d, length((p - hd) / vec2(1.0, 0.62)) - step(0.58, s3) * 0.07, 0.03);

    // arka kol
    float b1 = mix(-2.65, 0.35, s3) + sin(w * 0.83 + 2.0) * 0.2;
    float b2 = b1 + mix(-1.05, 1.2, s1);
    vec2 sh2 = vec2(-0.055, 0.275);
    vec2 el2 = sh2 + 0.15 * vec2(cos(b1), sin(b1));
    vec2 hd2 = el2 + 0.14 * vec2(cos(b2), sin(b2));
    d = smin(d, min(sdSeg(p, sh2, el2, 0.042), sdSeg(p, el2, hd2, 0.031)), 0.036);

    return d;
  }

  void main() {
    vec2 p = vP;
    float t = uTime;

    // --- Gölgeler bezin ÜSTÜNE düşer, bez düzse düşmez: kıvrım kaydırması ---
    // Örnekleme noktası, kıvrım yüksekliği kadar ışığın geliş yönünde kayar.
    vec2 lamba = vec2(0.0, 0.10);
    vec2 isikYon = normalize(p - lamba + vec2(1e-4));
    vec2 sp = p + isikYon * vFold * 3.2;

    // --- Siluetler: T = Π(1−a), S = Σa ---
    float span = uAspect * uCover + 1.9;
    float T = 1.0;
    float S = 0.0;

    for (int i = 0; i < NFIG; i++) {
      if (i >= uCount) break;
      vec4 A = uFigA[i];
      vec4 B = uFigB[i];

      float x = mod(A.x + A.w * t + span * 0.5, span) - span * 0.5;
      float y = A.y + sin(t * B.w + B.y * 5.0) * 0.012;

      // SAHNENİN TEK MEKANİZMASI — derinlik, yatay konumun fonksiyonu.
      // Kuklacı figürü kadranın kenarında perdeye BASTIRIR (küçük, jilet keskin,
      // koyu); merkeze yürürken perdeden çekip lambaya yaklaştırır (büyür,
      // penumbra açılır, çekirdek dolar → soluk dev). Gölge oyununun gerçek
      // tekniği bu; uydurma değil.
      //
      // Üç işi birden yapıyor:
      //   1) Metin bandı (merkez) kendiliğinden sakin, seyrek, derin kalıyor —
      //      üstüne perde/scrim gradyanı çekmeden. Okunabilirlik sahnenin kendi
      //      ışığından geliyor.
      //   2) Kenarlar serbest kalıyor: keskin, iri, koyu figürler artık dar
      //      raflara hapis değil. UI büyürse sistem çökmüyor (ölçekleniyor).
      //   3) Tez: fikirler kenarda ayrı ve keskin, merkezde birbirine karışıp
      //      dağılıyor, sonra öbür yanda yeniden ayrışıyor = SİRKÜLASYON.
      // Eşikler DÜNYA biriminde ve kasten kadraja göre ölçeklenmiyor: sakin
      // bölge kameranın değil, SAHNENİN bir özelliği — kuklacının lambaya yakın
      // tuttuğu orta alan. Sonucu ölçtüm, tahmin etmedim:
      //   · Geniş kadraj (1.6): kenarlar bu bölgenin DIŞINDA kalıyor → orada
      //     keskin, koyu, iri figürler yaşıyor. Başlık en kötü anda 4.03:1.
      //   · Dar kadraj (0.65): kadrajın TAMAMI bu bölgenin içine düşüyor →
      //     her figür derin ve soluk. Bu bir kusur değil, ZORUNLULUK: telefonda
      //     başlık genişliğin neredeyse tamamını kaplıyor, yani "boş kenar" diye
      //     bir yer yok. Eşiği kadraja oranlayıp (fw*0.82) kenarı keskinleştirmeyi
      //     denedim: telefonda başlık 4.03 → 1.93:1'e çöktü, çünkü keskin figür
      //     doğrudan harflerin arkasına giriyor. Ölçüm fikri öldürdü, geri aldım.
      float merkez = smoothstep(0.66, 0.12, abs(x));
      float z = mix(A.z, 0.95, merkez);

      // Tek fizik, üç sonuç:
      //   büyüme   → M = D/(D−z)              (izdüşüm)
      //   yumuşama → pen = kaynak · (M − 1)   (büyüme ile bulanıklık AYNI M'den;
      //              ayrı uydurulmuş iki sayı olunca derinlik okuması ölüyor)
      //   solma    → deri yarı saydam + bez ışığı yanal saçıyor.
      // Derinlik katsayısı 0.60: 0.84'te M=4.95 → dev figürün yarı boyu 0.69,
      // kadranın yarı boyu ise 0.58. Yani dev kadraja SIĞMIYOR, gövdesinin bir
      // dilimi kalıyordu ve figür değil soyut bir çubuk/duman gibi okuyordu.
      // 0.60'ta M=2.33 → yarı boy 0.33: dev kadrajın içinde, bütün bir figür.
      float M    = 1.0 / (1.0 - z * 0.60);
      float mag  = B.x * M;
      float pen  = 0.004 + KAYNAK * (M - 1.0);
      // Kenarda 0.86 (koyu, kesin) → merkezde 0.22 (hayalet). Merkez ucu düşük
      // tutuluyor ki birkaç dev üst üste binince bile başlığın arkası açık
      // kalsın; çarpım mürekkebi ancak aydınlık zeminde kontrastı korur.
      float peak = mix(0.86, 0.22, z);

      vec2 q = (sp - vec2(x, y)) / mag;
      q.x *= B.z;
      // kaba sınır kutusu — pikselin çoğu figürün dışında, boşuna SDF çözme
      float pad = pen / mag;
      if (abs(q.x) > 0.55 + pad || abs(q.y) > 0.60 + pad) continue;

      float d = sdFigur(q, B.y, t) * mag;
      float a = smoothstep(pen, -pen, d) * peak;
      T *= (1.0 - a);
      S += a;
    }

    float A = 1.0 - T;
    // Çakışma göstergesi: tek katman varsa S == A → O = 0. İki siluet üst üste
    // binince O yükselir. Sentez bedava: ekstra kod değil, çarpımın artığı.
    float O = clamp(S - A, 0.0, 1.0);

    // --- Bez: dokuma + iplik damarları + bulutlanma ---
    vec2 tp = p * uWeave;
    float aa = 1.0 - smoothstep(0.30, 0.80, fwidth(tp.x));  // moire kalkanı
    vec2 cell = floor(tp);
    float over = mod(cell.x + cell.y, 2.0);
    vec2 f = fract(tp) - 0.5;
    float thread = mix(cos(f.x * 3.1416), cos(f.y * 3.1416), over);
    float slub = mix(vnoise(vec2(cell.x * 0.37, tp.y * 0.018)),
                     vnoise(vec2(tp.x * 0.018, cell.y * 0.37)), over);
    float bulut = fbm(p * 5.5) - 0.5;

    // Kıvrımın yamacında kumaş toplanır → ışığın kat ettiği yol uzar → koyulaşır.
    float egim = length(vNrm.xy);
    float yol = 1.0 + egim * 2.1;
    float bezT = exp(-(0.048 + (0.032 + slub * 0.032) * thread * aa
                        + bulut * 0.09) * yol);

    // --- Işık alanı: tek kaynak + asılı bezin kenar sızıntısı ---
    // Yön AYDINLIK: temiz bez krem-beyaz kalmalı. Teal SADECE siluetten gelir,
    // ışık alanından değil.
    // Aralık 0.74→0.98 idi: 0.24'lük bir bant, yani neredeyse DÜZ. Kadraj süt
    // gibi okuyordu — arkada bir lamba olduğu hissedilmiyordu. Şimdi 0.58→1.00:
    // lambanın havuzu gerçekten görünüyor, kenarlar derinleşiyor. Bu bir scrim
    // DEĞİL — sahnede zaten var olan tek ışık kaynağının kendi düşüşü. Havuz
    // metnin durduğu merkezde en parlak: okunabilirlik ışığın kendisinden.
    float r = length((p - lamba) * vec2(0.60, 1.0));
    float alan = 0.58 + 0.42 * exp(-r * r * 1.4);
    // vinyet: çok hafif, sadece son dilimde (görüntü alanına göre, beze göre değil)
    alan *= mix(0.90, 1.0, smoothstep(uAspect * 0.5 + 0.02, uAspect * 0.5 - 0.34, abs(p.x)));
    alan *= mix(0.93, 1.0, smoothstep(0.56, 0.28, abs(p.y)));
    // üstte askı kenarı: bezin tepesinden ışık taşıyor, altında dikiş çizgisi
    alan += smoothstep(0.415, 0.50, p.y) * 0.13;
    alan -= exp(-pow((p.y - 0.427) / 0.005, 2.0)) * 0.09;
    // altta serbest uç: ışık bezin altından sıyırıyor
    alan += smoothstep(-0.42, -0.50, p.y) * 0.10;

    // --- Beer–Lambert: gölge derinleştikçe hue kendiliğinden teal'e iniyor ---
    float Tt = clamp(T * bezT, 0.0015, 1.0);
    vec3 col = LAMBA * alan * pow(vec3(Tt), SIGMA) + ONISIK;

    // Bezin ön yüzü odadan da azıcık aydınlanıyor → kıvrım sırtları modelleniyor.
    float lam = max(dot(vNrm, normalize(vec3(-0.35, 0.55, 0.9))), 0.0);
    col *= 0.955 + lam * 0.075;

    // Sentez: iki siluetin çakıştığı yerde doğan üçüncü form, kenarında nane.
    float rim = smoothstep(0.04, 0.16, O) * (1.0 - smoothstep(0.30, 0.62, O));
    col += NANE * rim * 0.055 * alan;

    // Işık beze doğru yuvarlansın, kırpılmasın — saf beyaz yok.
    col = omuz(col);

    // film graini (aynı zamanda banding kırıcı)
    float g = hash21(gl_FragCoord.xy + floor(t * 11.0) * 17.3) - 0.5;
    col += g * uGrain;

    // Renk uzayı notu: ShaderMaterial'da colorspace chunk'ı yok — değerler
    // doğrudan ekrana (sRGB) gidiyor. Sabitler de zaten ekran uzayında seçildi.
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

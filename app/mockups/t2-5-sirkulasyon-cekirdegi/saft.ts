import * as THREE from "three";

/*
 * SİRKÜLASYON ÇEKİRDEĞİ — şaftın ölçüleri, kat planı ve ortak GLSL.
 *
 * "Sirkülasyon" mimarlıkta zaten bunun adı: bir yapının merdiven/koridor
 * çekirdeği. Tema yapıştırma metafor değil, terimin kendisi.
 *
 * Plan gerçek bir DOĞRAMA (dog-leg) merdiven çekirdeği:
 *   · Sahanlıklar iki uçta, X boyunca; sırayla sağ / sol.
 *   · İki kol Z'de yan yana, X'te ters yönlerde koşuyor.
 *   · Aralarında kalan boşluk = KUYU. Kamera kuyunun dibinde durur ve
 *     yukarı bakar. Kat atlayamazsın: yukarı çıkmak yedisinden de geçmek.
 */

export const SAFT = {
  xMin: -5.2,
  xMax: 5.2,
  zMin: -4.2,
  zMax: 4.2,
  /**
   * Kuyunun Z'deki yarı genişliği: kollar bunun dışında kalır.
   * 1.5 → 2.6: dar kuyu şaftı KÖR ediyordu. Dipten bakan ışın kuyuyu 3 birimde
   * terk edip ilk kolun altına çarpıyor, yani "yedi sahanlık yukarı kaçıyor"
   * yerine "bir sahanlığın altı" görünüyordu. Kuyu derinleşince aynı bakış
   * açısında ışın çok daha yukarı tırmanıyor. Kollar 1.6'ya iniyor — dar değil,
   * gerçek bir merdiven kolu genişliği.
   */
  kuyuZ: 2.6,
  /** Kolların koşu sınırı; |x| > kosuX bölgesi sahanlıktır. */
  kosuX: 3.0,
  tavanY: 26.5,
  duvarKalin: 0.4,
  sahanlikKalin: 0.34,
  kolKalin: 0.28,
  korkulukBoy: 0.95,
} as const;

/**
 * Yedi sahanlık = yedi disiplin. Aralıklar BİLEREK eşit değil (3.35 · 3.25 ·
 * 3.55 · 3.15 · 3.65 · 3.15 · 3.60). Eşit aralık + simetri = Escher/Vertigo
 * klişesinin ta kendisi; jüri bunu pazarlık dışı saydı. Sapma, kadrajda
 * "perspektif" gibi okunacak kadar küçük, ritmi mekanik olmaktan çıkaracak
 * kadar büyük.
 */
export const SAHANLIK_Y = [3.35, 6.6, 10.15, 13.3, 16.95, 20.1, 23.7] as const;

/** +1 = sağ (x>0), -1 = sol. Sahanlıklar sırayla yer değiştirir. */
export const sahanlikYon = (i: number) => (i % 2 === 0 ? 1 : -1);

/** Sahanlık gövde merkezi: kosuX ile dış duvar arasının ortası (±4.1). */
export const sahanlikX = (i: number) => sahanlikYon(i) * ((SAFT.kosuX + SAFT.xMax) / 2);

export const SAHANLIK_DERIN = SAFT.xMax - SAFT.kosuX; // 2.2 (X'te)
export const SAHANLIK_EN = SAFT.zMax - SAFT.zMin; // 8.4 (Z'de)
export const KOL_EN = SAFT.zMax - SAFT.kuyuZ; // 2.7

/**
 * Tek yüksek yan pencere — z = zMax duvarında, YÜKSEKTE ve merkezden KAÇIK.
 * Kamera -z'ye baktığı için pencere kadrajın ARKASINDA kalır: kaynağı hiç
 * görmeyiz, yalnız işini görürüz. Işık ta tepeden değil YANDAN geldiği için
 * aydınlanan şey karşı duvar (z = zMin) ve sahanlık burunlarıdır; kameranın
 * durduğu dip kotuna hiçbir doğrudan ışık düşmez.
 */
export const PENCERE = { x0: 0.2, x1: 4.3, y0: 17.6, y1: 21.8 } as const;

/**
 * Pencereden giren ışının yönü: -x'e doğru, aşağı, ve -z (karşı duvara).
 *
 * x bileşeninin İŞARETİ kritik. İlk kurulumda +0.12'ydi: ışık sağ duvara
 * gidiyor, SOL duvarın iç yüzü (normali +x) sistematik olarak gölgede kalıyordu
 * — kadrajın sol üçte biri ölü bir lekeydi. İşaret ters çevrilince sol duvar
 * ışığı alan yüzey oluyor; pencere de sağa kaydırıldığı için ışık çapraz
 * iniyor ve sahanlıklar sola doğru uzun gölgeler düşürüyor.
 */
export const ISIK_YON = new THREE.Vector3(-0.24, -0.5, -0.83).normalize();

/* ---- palet: tek hue ailesi + beyazın onlarca opaklığı -------------------- */

export const PALET = {
  /** En koyu değer. Saf siyah palet dışı — dip bu tonda biter. */
  dip: "#073f49",
  /** Şaftın tepesi: pencerenin yıkadığı hava. */
  tepe: "#bfe9f3",
  siva: "#d3e7eb",
  tas: "#c2dbe1",
  korkuluk: "#2c6b74",
  pencere: "#eafdff",
  etiket: "#dff6fb",
} as const;

/* ---- kollar (flights) ---------------------------------------------------- */

export type Kol = {
  /** Koşunun başlangıç/bitiş burun çizgisi (x,y). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Kolun Z'deki merkezi: arka yarı (-2.85) veya ön yarı (+2.85). */
  zMerkez: number;
  /** Korkuluğun oturduğu kuyu kenarı: -kuyuZ veya +kuyuZ. */
  kuyuKenarZ: number;
};

/**
 * Kol i, sahanlık i-1'i sahanlık i'ye bağlar (kol 0 zeminden başlar).
 * Sahanlıklar X'te taraf değiştirdiği için kollar da Z'de yarı değiştirir —
 * gerçek bir doğrama merdiven böyle çalışır.
 */
export function kollar(): Kol[] {
  const out: Kol[] = [];
  for (let i = 0; i < SAHANLIK_Y.length; i++) {
    const bitis = sahanlikYon(i);
    const basla = -bitis;
    const arka = i % 2 === 0;
    out.push({
      x0: basla * SAFT.kosuX,
      y0: i === 0 ? 0 : SAHANLIK_Y[i - 1],
      x1: bitis * SAFT.kosuX,
      y1: SAHANLIK_Y[i],
      zMerkez: arka ? (SAFT.zMin - SAFT.kuyuZ) / 2 : (SAFT.zMax + SAFT.kuyuZ) / 2,
      kuyuKenarZ: arka ? -SAFT.kuyuZ : SAFT.kuyuZ,
    });
  }
  return out;
}

/** Koşu yönüne dik, DAİMA yukarı bakan birim vektör (ters kollarda da). */
export function dikYukari(k: Kol) {
  const dx = k.x1 - k.x0;
  const dy = k.y1 - k.y0;
  const u = Math.hypot(dx, dy);
  const p = new THREE.Vector2(-dy / u, dx / u);
  return p.y > 0 ? p : p.negate();
}

/* ---- ortak GLSL ---------------------------------------------------------- */

/**
 * YÜKSEKLİĞE BAĞLI ÜSTEL SİS.
 *
 * three'nin FogExp2'si yükseklik bilmez: yoğunluğu yalnız mesafeye bağlar.
 * Bize gereken tam tersi — dipte yoğun, tepede seyrek bir hava. Bu yüzden
 * yoğunluğu d(y) = d0 * exp(-k*y) alıp ışın boyunca ANALİTİK integralini
 * alıyoruz (klasik yükseklik sisi çözümü):
 *
 *   ∫ d0*exp(-k*y) ds = D * d0 * (exp(-k*yc) - exp(-k*yf)) / (k*(yf-yc))
 *
 * yf ≈ yc olduğunda pay ve payda birlikte sıfıra gider → o dalda düz
 * exp(-k*yc) kullanılıyor, yoksa 0/0 NaN üretir ve fragman siyah patlar.
 */
export const SIS_GLSL = /* glsl */ `
uniform vec3 uSisDip;
uniform vec3 uSisTepe;
uniform float uSisD0;
uniform float uSisK;
uniform float uSisAlt;
uniform float uSisUst;

float saftSisi(vec3 p, vec3 goz) {
  float D = distance(p, goz);
  float yc = goz.y;
  float yf = p.y;
  float dy = yf - yc;
  float derinlik;
  if (abs(dy) < 0.002) {
    derinlik = D * uSisD0 * exp(-uSisK * yc);
  } else {
    derinlik = D * uSisD0 * (exp(-uSisK * yc) - exp(-uSisK * yf)) / (uSisK * dy);
  }
  return 1.0 - exp(-max(derinlik, 0.0));
}

// Sisin RENGİ de yükseklikle değişir: dipteki hava ışıksızdır (koyu teal),
// pencere kotundaki hava yıkanmıştır (açık cyan). Örnekleme noktası ışının
// orta noktasına yakın alınıyor — tek bir uçtan okumak bantlama yapıyor.
vec3 saftSisRengi(vec3 p, vec3 goz) {
  float ym = mix(goz.y, p.y, 0.62);
  return mix(uSisDip, uSisTepe, smoothstep(uSisAlt, uSisUst, ym));
}
`;

/**
 * SEKME IŞIĞI (yükseklik kapılı dolaylı aydınlanma).
 *
 * Neden gerekli: sis diptekini karartamaz. Dip, kameraya YAKIN olduğu için
 * kısa optik yol → az sis. Yani "metin bölgesi en koyu yer" iddiası sisle
 * DEĞİL, ışıkla kurulmak zorunda. Gerçek bir şaftta pencereden inen sekme
 * ışığı derinlikle üstel söner; onu birebir modelliyoruz:
 *
 *   g = exp(-(pencereKotu - y) * k)
 *
 * Dipte (y≈2, pencere 19.5) g ≈ 0.06 → geometri neredeyse ışıksız.
 * Aşağı bakan yüzler (soffit = sahanlık altı) payı kapar: sekme aşağıdan,
 * aydınlanmış sahanlık üstlerinden gelir. HemisphereLight bunu yapamazdı —
 * o yükseklik bilmez, dibi de eşit aydınlatıp kompozisyonu öldürürdü.
 */
export const SEKME_GLSL = /* glsl */ `
uniform vec3 uSekmeRenk;
uniform float uSekmeY;
uniform float uSekmeK;

vec3 saftSekmesi(vec3 p, vec3 n) {
  // max() DEĞİL abs(): sekme pencere kotundan İKİ YÖNE de sönmeli. max() ile
  // pencerenin ÜSTÜ (y>19.5) sabit g=1 alıyordu → tavan ve üst duvarlar tam
  // dolaylı ışık yiyip kadrajın tepesine düz parlak bir KAPAK basıyordu.
  // Sekme aydınlanmış sahanlıklardan gelir; kaynaktan uzaklaştıkça söner —
  // yukarı doğru da. Böylece kadrajın en parlak yeri tavan değil, pencere
  // bandı oluyor: ışığın nereden geldiği okunuyor.
  float g = exp(-abs(p.y - uSekmeY) * uSekmeK);
  float alt = clamp(-n.y * 0.5 + 0.5, 0.0, 1.0);
  return uSekmeRenk * g * (0.2 + 0.8 * alt * alt);
}
`;

/**
 * Sıva/taş greni. Doku dosyası yok — 3B değer gürültüsü.
 *
 * Neden zorunlu: ilk render'da duvarlar pürüzsüz MeshStandardMaterial'di ve
 * sisin içinde SAF GRADYAN gibi okuyorlardı. Metnin arkasındaki koyu bant
 * "sakin mimari" değil "düz panel" gibi görünüyordu — yani tam olarak
 * yasaklanan scrim etkisini geometriyle üretiyordum. Grenin işi o bandı
 * yüzeye çevirmek: değeri değiştirmeden tutuş vermek.
 *
 * Damar dikeyde uzun (p.y * 0.22): şaft duvarında sıva izleri dikey akar.
 */
export const GREN_GLSL = /* glsl */ `
float saftHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float saftNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(saftHash(i + vec3(0,0,0)), saftHash(i + vec3(1,0,0)), f.x),
                 mix(saftHash(i + vec3(0,1,0)), saftHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(saftHash(i + vec3(0,0,1)), saftHash(i + vec3(1,0,1)), f.x),
                 mix(saftHash(i + vec3(0,1,1)), saftHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float saftGren(vec3 p) {
  float damar = saftNoise(vec3(p.x * 1.6, p.y * 0.22, p.z * 1.6)) * 0.55
              + saftNoise(vec3(p.x * 4.1, p.y * 0.7, p.z * 4.1)) * 0.30
              + saftNoise(p * 13.0) * 0.15;
  return damar;
}
`;

export type SaftU = Record<string, THREE.IUniform>;

export function saftUniformlari(): SaftU {
  return {
    uSisDip: { value: new THREE.Color(PALET.dip) },
    uSisTepe: { value: new THREE.Color(PALET.tepe) },
    // 0.17 → 0.065. RENDER'DA ÖLÇÜLEN KUSUR: 0.17'de sis, 7 birimde %56 ve
    // 25 birimde %62 veriyordu — yani şaftın TAMAMINA neredeyse SABİT bir %60
    // perde. Sabit perde tanımı gereği kontrast öldürür: dip de tepe de aynı
    // orta teal'e oturuyordu, kadraj tek düz renge çöküyordu (reddedilme
    // sebebi (d): "kontrastsız sisli sahne sakin değil OLAYSIZ okur").
    // Sisin işi derinliği AYIRMAK; ancak yakın ile uzak arasında FARK yaratırsa
    // iş görür. 0.065'te dip %29, pencere bandı %35, tavan %38 → gerçek bir
    // derinlik rampası ve geometri sisin altından çıkıyor.
    uSisD0: { value: 0.065 },
    uSisK: { value: 0.11 },
    // Rampa 2.5..13.5 → 5.5..21. 13.5'te tavan sis rengi %100 uSisTepe
    // (#bfe9f3) oluyordu: kadrajın üstü parlak, DOYGUN bir teal duvar kâğıdı.
    // Rampayı pencere kotuna yaklaştırınca yıkanan hava gerçekten pencerenin
    // çevresinde toplanıyor; dip (y<5.5) rampanın tümüyle dışında kalıyor →
    // metnin oturduğu bant ham koyu değerinde, %29 sis de dip renginde.
    uSisAlt: { value: 5.5 },
    uSisUst: { value: 21 },
    uSekmeRenk: { value: new THREE.Color("#b6e4ef") },
    uSekmeY: { value: 19.5 },
    // 0.155 → 0.125: sekme orta kota kadar insin. Dipte hâlâ exp(-17.5*0.125)
    // ≈ 0.11, yani neredeyse ışıksız — panel testi bozulmuyor.
    uSekmeK: { value: 0.125 },
  };
}

/** Dünya konumu + dünya normali varying'leri. USE_INSTANCING'i elle çözüyoruz:
 *  basamaklar/korkuluklar InstancedMesh, modelMatrix tek başına yetmez. */
const VS_ORTAK = /* glsl */ `
  varying vec3 vSaftP;
  varying vec3 vSaftN;
`;

export function sisliStandart(
  par: THREE.MeshStandardMaterialParameters,
  u: SaftU,
): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial(par);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\n${VS_ORTAK}`)
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        {
          vec3 sn = objectNormal;
          #ifdef USE_INSTANCING
            sn = mat3(instanceMatrix) * sn;
          #endif
          vSaftN = normalize(mat3(modelMatrix) * sn);
        }`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec4 sp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            sp = instanceMatrix * sp;
          #endif
          vSaftP = (modelMatrix * sp).xyz;
        }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\n${VS_ORTAK}\n${SIS_GLSL}\n${SEKME_GLSL}\n${GREN_GLSL}`,
      )
      // Gren albedo'ya biner: değeri değil, tutuşu değiştiriyor.
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         diffuseColor.rgb *= 1.0 + (saftGren(vSaftP) - 0.5) * 0.26;`,
      )
      // irradiance, lights_fragment_begin'de tanımlı ve burada hâlâ kapsamda.
      // Sekmeyi buraya eklemek onu materyalin kendi BRDF'inden geçirir —
      // outgoingLight'a elle eklemek albedo'yu ve roughness'ı atlardı.
      .replace(
        "#include <lights_fragment_end>",
        `irradiance += saftSekmesi(vSaftP, normalize(vSaftN));
         #include <lights_fragment_end>`,
      )
      // Sis tonemap'ten ÖNCE: sis sahne-lineer bir radyans katkısıdır,
      // tonemap sonrası karıştırmak açık uçları yanlış sıkıştırır.
      .replace(
        "#include <tonemapping_fragment>",
        `gl_FragColor.rgb = mix(
           gl_FragColor.rgb,
           saftSisRengi(vSaftP, cameraPosition),
           saftSisi(vSaftP, cameraPosition)
         );
         #include <tonemapping_fragment>`,
      );
  };
  m.customProgramCacheKey = () => "saft-standart";
  return m;
}

/** Basic materyalin vertex shader'ında beginnormal_vertex KOŞULLU (envmap/skin
 *  yoksa hiç yok) → burada normal isteyemeyiz. Yalnız sis. */
export function sisliBasic(
  par: THREE.MeshBasicMaterialParameters,
  u: SaftU,
): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial(par);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSaftP;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec4 sp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            sp = instanceMatrix * sp;
          #endif
          vSaftP = (modelMatrix * sp).xyz;
        }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vSaftP;\n${SIS_GLSL}`)
      .replace(
        "#include <tonemapping_fragment>",
        `gl_FragColor.rgb = mix(
           gl_FragColor.rgb,
           saftSisRengi(vSaftP, cameraPosition),
           saftSisi(vSaftP, cameraPosition)
         );
         #include <tonemapping_fragment>`,
      );
  };
  m.customProgramCacheKey = () => "saft-basic";
  return m;
}

/* ---- prosedürel dokular (dosya YOK) -------------------------------------- */

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

/**
 * Hava katmanı dokusu: yumuşak lekeler + KENARDA sıfıra inen alfa.
 * Kenar sönümü şart — düzlem kuyunun içinde yüzüyor, sert kenarı duvara
 * değdiği anda "kesik kâğıt" gibi okur.
 */
export function havaDokusu(): THREE.CanvasTexture | null {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const rnd = mulberry32(70425);

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 80; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 22 + rnd() * 74;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.09)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 'lighter' rgb'yi de biriktirdi: kenarlar gri kaldı. Alfayı koruyup rgb'yi
  // beyaza sabitle, yoksa sisin içinde kirli bir leke gibi durur.
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 256, 256);

  ctx.globalCompositeOperation = "destination-in";
  const f = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  f.addColorStop(0, "rgba(255,255,255,1)");
  f.addColorStop(0.55, "rgba(255,255,255,0.85)");
  f.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = f;
  ctx.fillRect(0, 0, 256, 256);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Disiplin adı → şeffaf zeminde beyaz mono yazı. Sahanlığın burun taşına biner. */
export function etiketCiz(ctx: CanvasRenderingContext2D, metin: string, aile: string) {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.font = `500 ${Math.round(h * 0.46)}px ${aile}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  // letterSpacing: Chrome 99+. Desteklenmezse sessizce normal aralık.
  try {
    ctx.letterSpacing = `${Math.round(h * 0.1)}px`;
  } catch {
    /* yoksay */
  }
  ctx.fillText(metin, w / 2, h * 0.54);
}

export function etiketDokusu(metin: string, aile: string): THREE.CanvasTexture | null {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  etiketCiz(ctx, metin, aile);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

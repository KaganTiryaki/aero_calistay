"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  ARKA_Z,
  DUVAR_X,
  DURGUN_T,
  GOZ_Y,
  KAMERA_Z,
  NIS_DERINLIK,
  NIS_RENK,
  NIS_SAYI,
  NIS_YAN,
  NIS_YARI_Y,
  NIS_YARI_Z,
  NIS_Y,
  NIS_Z,
  ON_Z,
  TAVAN_Y,
  normalize,
  siddetler,
  vuruslar,
} from "./yanki";

/*
 * YANKI SALONU — YEDİ YANIT
 * ---------------------------------------------------------------------------
 * Lambası olmayan uzun bir taş salon. Tek ışık kaynağı sesin kendisi: söz
 * gidiyor, yedi FARKLI DERİNLİKTEKİ duvar nişinden yedi ayrı anda dönüyor ve
 * salonu her dönüşte yeniden görünür kılıyor.
 *
 * Neden halka değil: yedi disiplin çember üzerine dizilmiyor, YEDİ DERİNLİĞE
 * diziliyor. Sıralarını mesafe belirliyor, açı değil. Kamera eksende.
 *
 * PANEL TESTİ — tasarımın merkezindeki karar:
 *   Işık kaynakları YANLARDAKİ duvarların İÇİNDE ve göz hizasının üstünde.
 *   Her nişin ışığı, yuvanın ağzıyla bir koniye hapsedilmiş (aşağıdaki
 *   `agiz` terimi) ve o koni KARŞI duvara + zemine bakıyor. Kadrajın merkez
 *   hacmi — metnin yaşadığı yer — aydınlatma geometrisi gereği ışık almıyor.
 *   Orada yalnız sis ve yakınsayan çizgiler var. Metnin arkasındaki karanlık
 *   hesaplanmış bir perde değil, ışık düzeninin kaçınılmaz sonucu.
 *   "Bu panel olmasa metin okunur muydu?" — panel yok. Sorunun konusu yok.
 *
 * NİŞ ≠ GEÇİT (risk notundaki "yedi kapı enfiladı" tekrarı):
 *   Asıl savunma ÖLÇÜNÜN kendisi ve bakış açısı. 3.7m yükseklikte 76cm'lik
 *   bir yarıktan geçilmez; üstelik kamera salonun ekseninde durduğu için her
 *   nişe ~17° veya daha grazing bakıyoruz. ÖLÇTÜM: dip plakayı görebilmek
 *   için bakışın |dz/dx| oranı ağız/derinlik = 0.475'in altında olmalı;
 *   en yakın nişte bile bu oran 2.6. Yani DİP PLAKA HİÇBİR NİŞTE GÖRÜNMÜYOR —
 *   yuvanın ağzından içerisi okunmuyor, sadece ışığın kendisi sızıyor.
 *   Bir geçitte içerisi görünürdü. Burada görünmüyor: yarık, kapı değil.
 *   (Plaka yine de çiziliyor: ağzın kenarında sızan hüzme onun rengini
 *   taşıyor ve reduced-motion tek karesinde niş yeri belli oluyor.)
 *
 * Işık modeli: RectAreaLight/gölge haritası YOK. 7 analitik kaynak, kapalı
 * formda. Gölge hesabına gerek de yok: kütlenin ışığa bakmayan yüzü zaten
 * N·L=0 alıyor, yani siluet bedava çıkıyor.
 */

/*
 * PALET — tek hue ailesi (soluk gri-teal taş + cyan/nane ışık).
 *
 * Taş bilinçli olarak AÇIK. İlk denemede albedo #124C54 (koyu teal) idi ve
 * sahne kurtarılamıyordu: koyu albedo × ışık = koyu, ne kadar ışık verirsem
 * vereyim bant asla parlamıyordu; gain'i zorlayınca da kırmızı kanalı sıfıra
 * yakın olduğu için doygun "şeker cyan"a kaçıyordu. Yanlış kurgu.
 * Gerçek karanlık iç mekânlar böyle çalışmıyor: taş soluktur, karanlık
 * IŞIĞIN YOKLUĞUNDAN gelir. Soluk taş + az ışık = derin karanlık; soluk taş +
 * bant = beyaza yakın soluk teal. Doyma da kendiliğinden çözülüyor.
 */
const TAS_DUVAR = "#5C878D";
const TAS_TAVAN = "#3E666C";
const TAS_DETAY = "#6E979C"; // söve, korniş, kaide — bir tık açık
const TAS_KUTLE = "#24525A"; // nişin içindeki dolu kütle: siluet için koyu
const TAS_ZEMIN = "#4A757C";
/** Salonun en koyu değeri. albedo×ortam'a bırakılırsa soluk taşla bile
 *  neredeyse siyah çıkıyor (ölçtüm: #010A0C). Bu yüzden taban ALBEDO'DAN
 *  BAĞIMSIZ, toplanarak veriliyor: "saf siyah yok · en koyu #073F49 civarı"
 *  kuralı böylece bir umut değil, kodun garantisi. */
const ORTAM = "#093A43";
const SIS = "#0B3E45";

// Yüzey türleri (aTur): tek materyal, dallanma shader'da.
const T_DUVAR = 0;
const T_ZEMIN = 1;
const T_TAVAN = 2;
const T_PLAKA = 3; // nişin ışık veren dip plakası
const T_DETAY = 4;
const T_KUTLE = 5;

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Yan duvar düzlemi. s=-1 sol (normal +X), s=+1 sağ (normal -X). */
function yanQuad(
  s: number,
  x: number,
  z0: number,
  z1: number,
  y0: number,
  y1: number,
) {
  const w = Math.abs(z1 - z0);
  const h = Math.abs(y1 - y0);
  const g = new THREE.PlaneGeometry(w, h, Math.max(1, Math.round(w / 7)), 1);
  g.rotateY(s < 0 ? Math.PI / 2 : -Math.PI / 2);
  g.translate(x, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

/** Yatay düzlem. yon=+1 yukarı bakar, -1 aşağı. */
function yatayQuad(
  yon: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y: number,
  bol = 1,
) {
  const g = new THREE.PlaneGeometry(
    Math.abs(x1 - x0),
    Math.abs(z1 - z0),
    bol,
    bol * 10,
  );
  g.rotateX(yon > 0 ? -Math.PI / 2 : Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  return g;
}

function isaretle(g: THREE.BufferGeometry, tur: number, nis = -1) {
  const n = g.attributes.position.count;
  g.setAttribute(
    "aTur",
    new THREE.BufferAttribute(new Float32Array(n).fill(tur), 1),
  );
  g.setAttribute(
    "aNis",
    new THREE.BufferAttribute(new Float32Array(n).fill(nis), 1),
  );
  return g;
}

/** Kadraj: dar ekranda FOV açılır, gerekirse kamera geri çekilir ki en yakın
 *  niş kadrajın dışında kalmasın. Akustik nominal dinleme noktasından
 *  hesaplandığı için (KAMERA_Z sabiti) kameranın çekilmesi ritmi bozmaz —
 *  sözü söyleyen salonun dinleme noktası, lens değil. */
function cerceve(aspect: number) {
  const fov = THREE.MathUtils.clamp(
    50 / THREE.MathUtils.clamp(aspect, 0.42, 1.15),
    44,
    76,
  );
  const yariH = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const yariW = yariH * aspect;
  const gerek = DUVAR_X / (0.92 * yariW) + NIS_Z[0];
  return { fov, kameraZ: Math.max(KAMERA_Z, Math.min(gerek, 30)) };
}

type Props = {
  /** Her karede niş başına 0..1 vuruş. setState YOK — doğrudan DOM. */
  bildir?: (isik: number[]) => void;
  sinif?: string;
};

export function SalonSahnesi({ bildir, sinif }: Props) {
  const kapRef = useRef<HTMLDivElement>(null);
  const bildirRef = useRef(bildir);
  bildirRef.current = bildir;

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const statik = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kaba = window.matchMedia("(pointer: coarse)").matches;

    // ---- sahne ----------------------------------------------------------
    const sahne = new THREE.Scene();
    const sisRenk = new THREE.Color(SIS);
    sahne.background = sisRenk;
    // Yoğunluk: 7. niş (~68 birim) ~%35 görünür kalsın, apsis (~81) sise
    // gömülsün ama YOK olmasın. Dip düz siyah değil, yumuşak teal bir alan.
    sahne.fog = new THREE.FogExp2(sisRenk.getHex(), 0.0151);

    const k0 = cerceve(
      Math.max(kap.clientWidth, 1) / Math.max(kap.clientHeight, 1),
    );
    const kamera = new THREE.PerspectiveCamera(k0.fov, 1, 0.1, 220);
    kamera.position.set(0, GOZ_Y, k0.kameraZ);
    // lookAt yok: ufuk kadrajda çivili kalır, parallaks yalnız konumu oynatır.
    kamera.rotation.set(0, 0, 0);

    const cizer = new THREE.WebGLRenderer({
      antialias: !kaba,
      powerPreference: "high-performance",
    });
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, kaba ? 1.5 : 1.75));
    cizer.setSize(kap.clientWidth, kap.clientHeight);
    // ACES: parlak nişler doyup "şeker cyan" olmuyor, beyaza doğru yuvarlanıyor.
    cizer.toneMapping = THREE.ACESFilmicToneMapping;
    cizer.toneMappingExposure = 1.0;
    kap.appendChild(cizer.domElement);

    // ---- geometri: tek merge, tek çizim çağrısı --------------------------
    const parcalar: THREE.BufferGeometry[] = [];
    const rnd = mulberry32(20260716);

    const KORNIS_Y = 5.62;
    const KORNIS_CIK = 0.3;
    const KAIDE_Y = 0.46;
    const KAIDE_CIK = 0.24;

    for (const s of [-1, 1]) {
      const x = s * DUVAR_X;
      // alt bant + üst bant: niş ağızlarının altı ve üstü, boydan boya
      parcalar.push(
        isaretle(yanQuad(s, x, ARKA_Z, ON_Z, 0, NIS_Y - NIS_YARI_Y), T_DUVAR),
      );
      parcalar.push(
        isaretle(
          yanQuad(s, x, ARKA_Z, ON_Z, NIS_Y + NIS_YARI_Y, TAVAN_Y),
          T_DUVAR,
        ),
      );

      // orta bant: yalnız nişlerin ARASINDA — ağızlar gerçek delik.
      let kenar = ON_Z;
      for (let i = 0; i < NIS_SAYI; i++) {
        if (NIS_YAN[i] !== s) continue;
        const ust = NIS_Z[i] + NIS_YARI_Z;
        if (kenar > ust + 0.02) {
          parcalar.push(
            isaretle(
              yanQuad(s, x, ust, kenar, NIS_Y - NIS_YARI_Y, NIS_Y + NIS_YARI_Y),
              T_DUVAR,
            ),
          );
        }
        kenar = NIS_Z[i] - NIS_YARI_Z;
      }
      if (kenar > ARKA_Z + 0.02) {
        parcalar.push(
          isaretle(
            yanQuad(s, x, ARKA_Z, kenar, NIS_Y - NIS_YARI_Y, NIS_Y + NIS_YARI_Y),
            T_DUVAR,
          ),
        );
      }

      // korniş: nişlerin üstünde boydan boya çıkıntı. Alt yüzü KARŞI duvarın
      // nişinden ışık alıyor → derinliğe koşan keskin bir aydınlık çizgi.
      // Sahnenin "ışık-gölge var, soluk değil" iddiasının taşıyıcısı.
      parcalar.push(
        isaretle(
          yatayQuad(
            -1,
            s * (DUVAR_X - KORNIS_CIK),
            x,
            ARKA_Z,
            ON_Z,
            KORNIS_Y,
            1,
          ),
          T_DETAY,
        ),
      );
      parcalar.push(
        isaretle(
          yanQuad(
            s,
            s * (DUVAR_X - KORNIS_CIK),
            ARKA_Z,
            ON_Z,
            KORNIS_Y,
            KORNIS_Y + 0.32,
          ),
          T_DETAY,
        ),
      );

      // kaide: duvarın dibi. Üst yüzü zeminden gelen parlamayı kesiyor,
      // duvar/zemin birleşimine bir değer basamağı koyuyor.
      parcalar.push(
        isaretle(
          yanQuad(s, s * (DUVAR_X - KAIDE_CIK), ARKA_Z, ON_Z, 0, KAIDE_Y),
          T_DETAY,
        ),
      );
      parcalar.push(
        isaretle(
          yatayQuad(1, s * (DUVAR_X - KAIDE_CIK), x, ARKA_Z, ON_Z, KAIDE_Y, 1),
          T_DETAY,
        ),
      );
    }

    // nişler
    for (let i = 0; i < NIS_SAYI; i++) {
      const s = NIS_YAN[i];
      const z = NIS_Z[i];
      const xAgiz = s * DUVAR_X;
      const xDip = s * (DUVAR_X + NIS_DERINLIK);
      const xOrta = (xAgiz + xDip) / 2;

      // dip plaka = ışığın kaynağı. Görünür, yakın, parlak.
      parcalar.push(
        isaretle(
          yanQuad(
            s,
            xDip,
            z - NIS_YARI_Z,
            z + NIS_YARI_Z,
            NIS_Y - NIS_YARI_Y,
            NIS_Y + NIS_YARI_Y,
          ),
          T_PLAKA,
          i,
        ),
      );

      // söveler: üst, alt, ve iki yan. Yuvanın kalınlığını gösteriyor.
      parcalar.push(
        isaretle(
          yatayQuad(
            -1,
            Math.min(xAgiz, xDip),
            Math.max(xAgiz, xDip),
            z - NIS_YARI_Z,
            z + NIS_YARI_Z,
            NIS_Y + NIS_YARI_Y,
          ),
          T_DETAY,
        ),
      );
      parcalar.push(
        isaretle(
          yatayQuad(
            1,
            Math.min(xAgiz, xDip),
            Math.max(xAgiz, xDip),
            z - NIS_YARI_Z,
            z + NIS_YARI_Z,
            NIS_Y - NIS_YARI_Y,
          ),
          T_DETAY,
        ),
      );
      for (const zy of [-1, 1]) {
        const g = new THREE.PlaneGeometry(NIS_DERINLIK, NIS_YARI_Y * 2);
        if (zy > 0) g.rotateY(Math.PI); // normal -Z: yuvanın içine bakıyor
        g.translate(xOrta, NIS_Y, z + zy * NIS_YARI_Z);
        parcalar.push(isaretle(g, T_DETAY));
      }

      // DOLU KÜTLE: plakanın önünde duran taş blok. Işığa sırtı dönük →
      // N·L=0 → siyah siluet. Nişin geçit değil, dolu bir yuva olduğunun
      // görsel ispatı. Boy/konum nişten nişe deterministik olarak oynuyor
      // (kusursuz klon dizisi CG kokar).
      // Yarık 0.76 dar → kütle z'de 0.76'yı AŞMAMALI, yoksa söveden dışarı
      // taşar. Yükseklik plakanın 1.12'sinin ~%55-82'si: siluet için yeterli.
      const kb = 0.62 + rnd() * 0.3;
      const kg = new THREE.BoxGeometry(0.34, kb, 0.26 + rnd() * 0.14);
      kg.translate(
        s * (DUVAR_X + 0.5),
        NIS_Y - NIS_YARI_Y + kb / 2,
        z + (rnd() - 0.5) * 0.42,
      );
      parcalar.push(isaretle(kg, T_KUTLE));
    }

    // zemin · tavan · apsis
    parcalar.push(
      isaretle(
        yatayQuad(1, -DUVAR_X, DUVAR_X, ARKA_Z, ON_Z, 0, 4),
        T_ZEMIN,
      ),
    );
    parcalar.push(
      isaretle(
        yatayQuad(-1, -DUVAR_X, DUVAR_X, ARKA_Z, ON_Z, TAVAN_Y, 2),
        T_TAVAN,
      ),
    );
    const apsis = new THREE.PlaneGeometry(DUVAR_X * 2, TAVAN_Y);
    apsis.translate(0, TAVAN_Y / 2, ARKA_Z);
    parcalar.push(isaretle(apsis, T_DUVAR));

    const salonGeo = mergeGeometries(parcalar)!;
    for (const p of parcalar) p.dispose();

    // ---- ışık uniform'ları ----------------------------------------------
    const nisP: THREE.Vector3[] = [];
    const nisN: THREE.Vector3[] = [];
    const nisC: THREE.Color[] = [];
    for (let i = 0; i < NIS_SAYI; i++) {
      const s = NIS_YAN[i];
      nisP.push(new THREE.Vector3(s * (DUVAR_X + NIS_DERINLIK * 0.6), NIS_Y, NIS_Z[i]));
      nisN.push(new THREE.Vector3(-s, 0, 0));
      nisC.push(new THREE.Color(NIS_RENK[i]));
    }

    const salonMat = new THREE.ShaderMaterial({
      fog: true, // ShaderMaterial'da varsayılan false
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uNisP: { value: nisP },
          uNisN: { value: nisN },
          uNisC: { value: nisC },
          uNisI: { value: new Array(NIS_SAYI).fill(0.5) },
          uTasDuvar: { value: new THREE.Color(TAS_DUVAR) },
          uTasTavan: { value: new THREE.Color(TAS_TAVAN) },
          uTasDetay: { value: new THREE.Color(TAS_DETAY) },
          uTasKutle: { value: new THREE.Color(TAS_KUTLE) },
          uTasZemin: { value: new THREE.Color(TAS_ZEMIN) },
          uOrtam: { value: new THREE.Color(ORTAM) },
          uCila: { value: kaba ? 0.0 : 1.0 },
        },
      ]),
      vertexShader: /* glsl */ `
        attribute float aTur;
        attribute float aNis;
        varying vec3 vN;
        varying vec3 vP;
        varying float vTur;
        varying float vNis;
        varying float vDer;

        #include <common>
        #include <fog_pars_vertex>

        void main() {
          vTur = aTur;
          vNis = aNis;
          vec4 dunya = modelMatrix * vec4(position, 1.0);
          vP = dunya.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 mvPosition = viewMatrix * dunya;
          vDer = -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uNisP[${NIS_SAYI}];
        uniform vec3 uNisN[${NIS_SAYI}];
        uniform vec3 uNisC[${NIS_SAYI}];
        uniform float uNisI[${NIS_SAYI}];
        uniform vec3 uTasDuvar;
        uniform vec3 uTasTavan;
        uniform vec3 uTasDetay;
        uniform vec3 uTasKutle;
        uniform vec3 uTasZemin;
        uniform vec3 uOrtam;
        uniform float uCila;

        varying vec3 vN;
        varying vec3 vP;
        varying float vTur;
        varying float vNis;
        varying float vDer;

        #include <common>
        #include <fog_pars_fragment>

        // 3B değer gürültüsü — taş greni. Doku dosyası yok.
        float hash31(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float gurultu(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
                         mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                         mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
        }

        /*
         * YARIK AĞZI — bu sahnenin tek en önemli 4 satırı.
         *
         * Niş izotropik bir koni değil, bir YARIK: 0.76 uzun, 1.12 yüksek,
         * 1.6 derin. Böyle bir ağızdan çıkan ışık dikeyde ~±35°, uzunlamasına
         * ~±25° ile sınırlı. Dar boyuna kapı her nişin KENDİ havuzunu kurmasını
         * sağlıyor: ölçtüm, karşı duvarda havuz profili 1.00 → 0.00 → 1.00
         * gidiyor, yani gerçek ışık-gölge var, düz yıkama değil.
         *
         * İlk denemede izotropik koni kullandım ve tam da bu yüzden ışık
         * merkez zemini yıkıyordu (ölçtüm: agiz=1.0, taban aydınlığın ~%98'i).
         * Yarık, "merkez ışık bütçesinin dışında" iddiasını bir tercih
         * olmaktan çıkarıp geometrik zorunluluğa çeviriyor.
         * Sınırlar yuvanın ölçülerinden türüyor, elle seçilmedi:
         *   dikey  = 2·NIS_YARI_Y / NIS_DERINLIK = ${(( 2 * NIS_YARI_Y) / NIS_DERINLIK).toFixed(3)}
         *   boyuna = 2·NIS_YARI_Z / NIS_DERINLIK = ${((2 * NIS_YARI_Z) / NIS_DERINLIK).toFixed(3)}
         */
        float agizYarigi(vec3 D, vec3 Nl) {
          float ax = dot(D, Nl);
          if (ax <= 0.0) return 0.0;
          float ty = abs(D.y) / max(ax, 1e-3);
          float tz = abs(D.z) / max(ax, 1e-3);
          float ky = 1.0 - smoothstep(${(((2 * NIS_YARI_Y) / NIS_DERINLIK) * 0.6).toFixed(3)},
                                      ${(((2 * NIS_YARI_Y) / NIS_DERINLIK) * 1.35).toFixed(3)}, ty);
          float kz = 1.0 - smoothstep(${(((2 * NIS_YARI_Z) / NIS_DERINLIK) * 0.6).toFixed(3)},
                                      ${(((2 * NIS_YARI_Z) / NIS_DERINLIK) * 1.35).toFixed(3)}, tz);
          return ky * kz;
        }

        // 7 analitik kaynak. Gölge haritası yok ve gerekmiyor: kaynak yuvanın
        // dibinde, yüzeyler dışbükey → N·L ile yarık ağzı doğru siluetleri
        // zaten bedava veriyor.
        vec3 isinim(vec3 P, vec3 N) {
          vec3 acc = vec3(0.0);
          for (int i = 0; i < ${NIS_SAYI}; i++) {
            vec3 dv = uNisP[i] - P;
            float d2 = max(dot(dv, dv), 0.05);
            float d = sqrt(d2);
            vec3 L = dv / d;
            float ndl = max(dot(N, L), 0.0);
            float agiz = agizYarigi(-L, uNisN[i]);
            float g = ndl * agiz / (1.0 + d2 * 0.012);
            acc += uNisC[i] * (uNisI[i] * g);
          }
          // Kazanç: karşı duvardaki bant (d≈11.8 → düşüm 0.376) tepe vuruşta
          // ~1.7 ışık alsın; soluk taşla çarpılıp ACES'ten geçince beyaza
          // yakın soluk teal bir bant çıkıyor, doygun cyan değil.
          return acc * 4.5;
        }

        /*
         * CİLALI ZEMİN — sahte yansıma düzlemi, ayrı render pass'i YOK.
         *
         * Oda bir kutu olduğu için yansıma ışınını KAPALI FORMDA izleyebiliyoruz:
         * zeminden yansıyan bakış ışını hangi düzleme çarpıyorsa o noktanın
         * ışınımını hesaplayıp geri veriyoruz. Bir Reflector pass'inin bedeli
         * ikinci bir sahne çizimi; buradaki bedel tek bir ekstra isinim().
         *
         * Yansıyan şey KAYNAK değil, kaynağın karşı duvara düşürdüğü BANT —
         * yarık ağzı yüzünden plaka zaten zeminin gördüğü açıdan görünmüyor.
         * Gerçek cilalı taşın gösterdiği şey de budur. Sonuç: kadrajın alt
         * yarısı, duvarlardaki bantların kaçış noktasına koşan uzun
         * yansımalarıyla doluyor — merkez yine karanlık kalarak.
         */
        vec3 zeminYansima(vec3 P, vec3 V) {
          vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
          float t = 1e5;
          vec3 Nq = vec3(0.0);
          if (abs(R.x) > 1e-4) {
            float tx = ((R.x > 0.0 ? ${DUVAR_X.toFixed(2)} : ${(-DUVAR_X).toFixed(2)}) - P.x) / R.x;
            if (tx > 0.0 && tx < t) { t = tx; Nq = vec3(R.x > 0.0 ? -1.0 : 1.0, 0.0, 0.0); }
          }
          if (R.y > 1e-4) {
            float tc = (${TAVAN_Y.toFixed(2)} - P.y) / R.y;
            if (tc > 0.0 && tc < t) { t = tc; Nq = vec3(0.0, -1.0, 0.0); }
          }
          if (R.z < -1e-4) {
            float ta = (${ARKA_Z.toFixed(2)} - P.z) / R.z;
            if (ta > 0.0 && ta < t) { t = ta; Nq = vec3(0.0, 0.0, 1.0); }
          }
          if (t >= 1e5) return vec3(0.0);
          vec3 Q = P + R * t;
          vec3 c = uOrtam * 0.8 + uTasDuvar * isinim(Q, Nq);
          // Yansıyan görüntü fazladan t kadar yol gitti → fazladan sis yer.
          float s = exp(-pow(0.0151 * t, 2.0));
          return c * s;
        }

        // Plakanın kendi rengi. GLSL ES 1.0'da uniform diziyi değişkenle
        // indeksleyemiyoruz → döngü + sabit indeks.
        vec3 plaka(float ni) {
          vec3 c = vec3(0.0);
          for (int i = 0; i < ${NIS_SAYI}; i++) {
            if (abs(float(i) - ni) < 0.5) c = uNisC[i] * uNisI[i];
          }
          return c;
        }

        void main() {
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vP);
          float tur = vTur;

          // Nişin dip plakası: ışığın kaynağı, kendi başına parlak.
          if (tur > 2.5 && tur < 3.5) {
            vec3 c = plaka(vNis);
            // Plaka düz bir dikdörtgen leke değil: dikeyde merkeze doğru
            // toplanıyor, kenarlarda söveye karışıyor. Yuva okuması bundan.
            float ic = 1.0 - smoothstep(0.1, ${NIS_YARI_Y.toFixed(2)},
                                        abs(vP.y - ${NIS_Y.toFixed(2)}));
            gl_FragColor = vec4(c * (0.55 + 0.5 * ic), 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            #include <fog_fragment>
            return;
          }

          // --- albedo ---
          vec3 albedo = uTasDuvar;
          if (tur > 0.5 && tur < 1.5) albedo = uTasZemin;
          else if (tur > 1.5 && tur < 2.5) albedo = uTasTavan;
          else if (tur > 3.5 && tur < 4.5) albedo = uTasDetay;
          else if (tur > 4.5) albedo = uTasKutle;

          // --- taş greni: yakında damar, uzakta susuyor (aliasing) ---
          float yakin = 1.0 - smoothstep(8.0, 34.0, vDer);
          float damar = gurultu(vP * vec3(0.42, 1.9, 0.42)) * 0.6
                      + gurultu(vP * vec3(1.3, 5.2, 1.3)) * 0.4;
          float tane = (gurultu(vP * 26.0) - 0.5) * 0.16 * yakin;
          albedo *= 1.0 + (damar - 0.5) * 0.30 * yakin + tane;

          // --- ortam ---
          // İlk render'da ortam albedo'yla ÇARPILIYORDU ve 0.30-0.44'tü: sahne
          // düz bir teal çorbaydı, çünkü ortam doğrudan ışığın ~4 KATIYDI —
          // ışık-gölge diye bir şey yoktu (tur 1'in (d) hatası). Şimdi ortam
          // albedo'dan bağımsız ve TOPLANIYOR: en koyu değeri palet garanti
          // ediyor, biçimi ise yalnızca ışık kuruyor.
          float gok = N.y * 0.5 + 0.5;
          vec3 col = uOrtam * (0.72 + gok * 0.5) + albedo * isinim(vP, N);

          // --- cilalı zemin: analitik düzlem yansıması + Fresnel ---
          if (tur > 0.5 && tur < 1.5) {
            // Fresnel: dibe bakınca taş, ufka doğru ayna. Uzak zemin
            // duvarlardaki bantları kaçış noktasına doğru uzatıyor.
            float fres = mix(0.03, 0.62, pow(1.0 - max(dot(N, V), 0.0), 4.0));
            col = mix(col, zeminYansima(vP, V), fres * uCila);
          }

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });

    const salon = new THREE.Mesh(salonGeo, salonMat);
    salon.frustumCulled = false;
    sahne.add(salon);

    const uI = salonMat.uniforms.uNisI.value as number[];

    // ---- fare parallaksı -------------------------------------------------
    const fare = { x: 0, y: 0 };
    const hedef = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedef.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedef.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba) {
      window.addEventListener("pointermove", fareOynat, { passive: true });
    }

    // ---- döngü ------------------------------------------------------------
    const vurus = new Array(NIS_SAYI).fill(0);
    const norm = new Array(NIS_SAYI).fill(0);
    let temelZ = k0.kameraZ;
    let id = 0;
    let gorunur = false;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const yaz = (t: number) => {
      vuruslar(t, vurus);
      siddetler(vurus, uI);
      bildirRef.current?.(normalize(vurus, norm));
    };

    const ciz = () => {
      // DURGUN_T ofseti: t=0'da bütün vuruşlar sönük olurdu, yani AÇILIŞ KARESİ
      // düz tabana düşerdi. Buradan başlayınca sayfa açılır açılmaz salon bir
      // akor tutuyor.
      yaz(saat.getElapsedTime() + DURGUN_T);

      fare.x += (hedef.x - fare.x) * 0.04;
      fare.y += (hedef.y - fare.y) * 0.04;
      kamera.position.x = fare.x * 0.62;
      kamera.position.y = GOZ_Y - fare.y * 0.26;
      kamera.position.z = temelZ;

      cizer.render(sahne, kamera);
      id = requestAnimationFrame(ciz);
    };

    const basla = () => {
      if (calisiyor || statik) return;
      calisiyor = true;
      id = requestAnimationFrame(ciz);
    };
    const dur = () => {
      calisiyor = false;
      cancelAnimationFrame(id);
    };

    // reduced-motion BASE katman: rAF hiç başlamaz. Tek kare DURGUN_T anında
    // donduruluyor — yani salonun tam hâli, eksiltilmişi değil: yedi derinlik,
    // yedi ayrı değer, ritim sadece durmuş.
    const tekKare = () => {
      yaz(DURGUN_T);
      cizer.render(sahne, kamera);
    };

    const io = new IntersectionObserver(
      ([g]) => {
        gorunur = g.isIntersecting;
        if (gorunur && !document.hidden) basla();
        else dur();
      },
      { threshold: 0 },
    );
    io.observe(kap);

    const gorunurluk = () => {
      if (document.hidden) dur();
      else if (gorunur) basla();
    };
    document.addEventListener("visibilitychange", gorunurluk);

    const boyutla = () => {
      const w = kap.clientWidth;
      const h = kap.clientHeight;
      if (!w || !h) return;
      const k = cerceve(w / h);
      temelZ = k.kameraZ;
      kamera.fov = k.fov;
      kamera.aspect = w / h;
      kamera.position.z = k.kameraZ;
      kamera.updateProjectionMatrix();
      cizer.setSize(w, h);
      if (statik) tekKare();
    };
    boyutla();
    if (statik) tekKare();

    const ro = new ResizeObserver(boyutla);
    ro.observe(kap);

    return () => {
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", fareOynat);
      salonGeo.dispose();
      salonMat.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

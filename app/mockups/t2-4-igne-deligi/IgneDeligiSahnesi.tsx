"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  ACIKLIK_DAR,
  ACIKLIK_GENIS,
  BANT_GLSL,
  CIKIS_GLSL,
  DELIK,
  DIS_YARI_FOV,
  DURGUN_T,
  DUSME,
  GNOMONIK_GLSL,
  GURULTU_GLSL,
  KAMERA_Y,
  KAMERA_Z,
  NEFES_HIZ,
  ODA,
  P,
  YARI_ACI,
  bant,
} from "./oda";

/*
 * İĞNE DELİĞİ — AERO'nun WebGL sahnesi.
 *
 * İki geçiş:
 *   (1) DIŞARISI → 256² RTT. Prosedürel: cyan gökyüzü, kıyı silüeti, sürüklenen
 *       bulut bantları ve suyun üstünden geçen koyu kütleler. Dünya akıyor.
 *   (2) ODA → ekran. Kutunun iç yüzeyi tek bir shader'la boyanıyor; delikten
 *       gelen her yön RTT'yi gnomonik olarak örnekliyor. Bulanıklık yarıçapı =
 *       delik çapı (fizik: uzak nesnenin bulanıklık dairesi tam olarak budur).
 *   (3) KONİ → additive. Ray-cone kesişimi + 12 adımlık tek katman raymarch;
 *       huzme dışarıdaki görüntüyü TAŞIYOR (koyu kütle geçince huzme kararıyor).
 *
 * HARMAN — perde/scrim YOK ve gerekmiyor:
 *   Oda inşaat gereği karanlık. Delik sağ üstte, oval sol üstte, koni ikisinin
 *   arasındaki bantta. Kadrajın alt yarısı (dip duvarın dibi + taban) sahnenin
 *   tanımı gereği ışık almıyor → metin oraya oturuyor. "Bu panel olmasa metin
 *   okunur muydu?" — panel yok; okunabilirlik sahnenin ışığından geliyor.
 *
 * Zorunlu kapılar: DPR cap ≤2 · IntersectionObserver · visibilitychange ·
 * prefers-reduced-motion'da rAF hiç başlamaz (tek statik kare) ·
 * pointer:coarse'da tap/adım sayısı düşer + antialias kapanır · tam dispose.
 */

/** Kadraj: dar ekranda FOV açılır ama sınırlanır, kamera de geri çekilir —
 *  yoksa delik (x=+7) kadrajın dışına taşar ve sahnenin olayı kaybolur.
 *
 *  NİYET DOĞRUYDU, SAYILAR TUTMUYORDU. 390×844'te (aspect 0.462) hesap:
 *    fov_v  = 2·atan(0.756/0.462) = 117° → 76'ya KIRPILIYOR
 *    kenar  = tan(38°)·0.462 = 0.361
 *    delik  = 7 / (8.881+10.1) = 0.369  →  0.369 > 0.361, yani DELİK KADRAJIN
 *             DIŞINDA. Sahnenin tek olayı mobilde kesiliyordu.
 *  FOV kırpması kaldırılamaz (76'nın üstü balıkgözü). Tek kaldıraç kamerayı
 *  geri çekmek: 5.8/9.0 ile 390×844'te kameraZ = 12.04 → delik 7/22.14 = 0.316,
 *  yani %12 payla içeride. Üst sınır 9.0: kameraZ ≤ 13.4 < girisZ (14), kamera
 *  giriş duvarını asla delmiyor. Masaüstünde (1.674) etki 4.76→5.01, ihmal
 *  edilebilir. Dokunmatikte parallaks kapalı, o yüzden ±0.7 payı da gerekmiyor.
 */
function cerceve(aspect: number) {
  const yatayYari = 0.756; // tan(hHalf) @ 16:9 tasarım kadrajı
  const fov = THREE.MathUtils.clamp(
    THREE.MathUtils.radToDeg(2 * Math.atan(yatayYari / Math.max(aspect, 0.32))),
    44,
    76,
  );
  const kameraZ = KAMERA_Z + THREE.MathUtils.clamp((1.78 - aspect) * 5.8, 0, 9.0);
  return { fov, kameraZ };
}

type Props = {
  /** Alt şeritteki disiplinlerin dış-görüntü x konumları (bant fazı örneği). */
  ornekA: readonly number[];
  /** Her karede disiplin başına 0..1 ışık. setState YOK — doğrudan DOM. */
  bildir?: (isik: number[]) => void;
  sinif?: string;
};

export function IgneDeligiSahnesi({ ornekA, bildir, sinif }: Props) {
  const kapRef = useRef<HTMLDivElement>(null);
  const bildirRef = useRef(bildir);
  bildirRef.current = bildir;
  const ornekRef = useRef(ornekA);
  ornekRef.current = ornekA;

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const statik = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kaba = window.matchMedia("(pointer: coarse)").matches;

    // ---- bağlam: verilmeyebilir (sekme limiti, sürücü reddi) -------------
    let cizer: THREE.WebGLRenderer;
    try {
      cizer = new THREE.WebGLRenderer({
        antialias: !kaba,
        powerPreference: "high-performance",
      });
    } catch {
      return; // CSS koyu teal zemin kalır, metin okunur.
    }
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, kaba ? 1.5 : 2));
    cizer.setSize(kap.clientWidth || 1, kap.clientHeight || 1);
    kap.appendChild(cizer.domElement);

    // ---- delik ekseni ve dış dünyanın bakış çerçevesi ---------------------
    const delik = new THREE.Vector3(...DELIK);
    const dusme = new THREE.Vector3(...DUSME);
    const eksen = dusme.clone().sub(delik).normalize(); // delik → duvar
    const koniBoy = dusme.distanceTo(delik);

    // Deliğin DIŞARIYA baktığı yön eksenin tersi. Duvar normali (+X) değil:
    // delik kalın duvarda eğik açılmış bir bore. F/R/U ortonormal çerçeve.
    const F = eksen.clone().negate();
    const R = new THREE.Vector3(0, 1, 0).cross(F).normalize();
    const U = F.clone().cross(R).normalize();

    const disK = 0.5 / Math.tan(DIS_YARI_FOV);

    // ---- (1) dışarısı: 256² RTT ------------------------------------------
    // HalfFloat: gökyüzü lineer uzayda 1.0'ı aşabilsin, projeksiyon cesur
    // kalabilsin. Utangaç bir projeksiyon bu sahneyi öldürür.
    // 256² dar açıklıkta darboğazdı: ACIKLIK_DAR'ın bulanıklık yarıçapı ~2
      // teksele denk geliyordu, yani "delik daralınca dünya çözülür" vaadinin
      // çözecek bir şeyi yoktu. 512'de dar uç gerçekten keskinleşiyor. Shader
      // ucuz (tek quad, 4 oktav fbm) — dokunmatikte yine 256.
    const rtBoyut = kaba ? 256 : 512;
    const rt = new THREE.WebGLRenderTarget(rtBoyut, rtBoyut, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    });

    const disariSahne = new THREE.Scene();
    const disariKam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const disariGeo = new THREE.PlaneGeometry(2, 2);
    const disariMat = new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: DURGUN_T },
        uCyan: { value: new THREE.Color(P.cyan) },
        uCyanOrta: { value: new THREE.Color(P.cyanOrta) },
        uCyanAcik: { value: new THREE.Color(P.cyanAcik) },
        uNane: { value: new THREE.Color(P.nane) },
        uTeal: { value: new THREE.Color(P.teal) },
        uKoyu: { value: new THREE.Color(P.koyu) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uT;
        uniform vec3 uCyan, uCyanOrta, uCyanAcik, uNane, uTeal, uKoyu;
        varying vec2 vUv;
        ${GURULTU_GLSL}
        ${BANT_GLSL}

        /*
         * Dışarısı: bir su kütlesi ve karşı kıyı. Neden su + gökyüzü?
         *   · Sabit olan (kıyı) ile akan (bulut, kütleler) aynı karede: dolaşım
         *     görünür olmalı ama sahne "animasyon" gibi çırpınmamalı.
         *   · Ağır bulanıklıkta bile okunur kalan tek kompozisyon: yatay bantlar.
         *     Delik geniştir → görüntü yumuşak renk bantlarına iner; delik
         *     daralınca kütleler ve kıyı çözülür.
         *   · Kaynağı Vermeer'in odası: manzara, diyagram değil. Bilim
         *     register'ına (atom/nöron/tel-kafes) hiç değmiyor.
         */
        void main() {
          vec2 p = vUv * 2.0 - 1.0;      // +y yukarı, yatay ≈ 19°

          // ÖLÇEK, ilk sürümün asıl hatasıydı. Delik dünyanın ~16°'lik bir
          // dilimini duvarda ~200px'lik bir ovale basıyor; oradan da bulanıklık
          // dairesi geçiyor. İlk kompozisyonun kıyısı ±0.078'lik bir kıpırtı,
          // tekneleri 0.075 genişliğindeydi → duvarda 9–17px, yani bulanıklıkta
          // TAMAMEN siliniyordu. Ölçüm bunu doğruladı: oval'in dikey profili
          // (90 97 108 139 199 191 179 123 59) tek bir düzgün tümsek — yani
          // gördüğümüz şey görüntü değil, bore vinyetinin zarfıydı. 40 satırlık
          // dünya çöpe gidiyordu ve sahnenin bütün argümanı ("dışarısı içeri
          // giriyor ve ÇEVRİLİYOR") görünmez kalıyordu.
          // Kural: bu ovalde yalnız BÜYÜK ve SERT formlar hayatta kalır.
          float ufuk = -0.06;

          // --- gökyüzü: ufukta açık, tepede doygun ---
          float ph = clamp((p.y - ufuk) / (1.0 - ufuk), 0.0, 1.0);
          vec3 gok = mix(uCyanAcik * 1.30, uCyan, pow(ph, 0.60));
          gok = mix(gok, uCyanOrta, (1.0 - ph) * 0.22);

          // --- bulutlar: akış. Aynı 'bant' fonksiyonu CPU'da disiplinleri sürer.
          float bb = bant(p.x * 3.0, uT);
          float detay = fbm2(vec2(p.x * 4.2 - uT * 0.045, p.y * 6.4 + 2.0));
          float bulut = smoothstep(0.46, 0.92, bb * 0.66 + detay * 0.44)
                      * smoothstep(0.0, 0.26, ph);
          // Bulut = beyazın bir opaklığı, beyaz duvar değil: hue korunsun.
          gok = mix(gok, mix(uCyanAcik, vec3(1.0), 0.60) * 1.45, bulut * 0.55);

          // --- karşı kıyı: ufkun üstünde GERÇEK bir kara kütlesi ------------
          // Artık silüet bir çizgi değil, bir BANT: tepe (sırt) ile suHatti
          // arasında paletin en koyu ucunda duran bir yaka. Sert kenar +
          // büyük genlik = bulanıklıktan sağ çıkan tek şey. Duvarda baş aşağı
          // göründüğü için "çevrilmişlik" ancak böyle okunuyor.
          float tepe = ufuk + 0.34 * fbm2(vec2(p.x * 0.9 + 4.0, 0.0))
                     + 0.09 * sin(p.x * 1.7 + 1.0);
          float suHatti = ufuk - 0.055;

          // --- su: en koyu değer #073F49'da diplenir ---
          vec3 su = mix(uTeal, uKoyu, smoothstep(suHatti, -1.0, p.y));
          float alt = max(suHatti - p.y, 0.0);
          su += uNane * exp(-alt / 0.05) * 0.50;      // kıyı çizgisinde nane parıltı
          su += uCyanAcik * exp(-alt / 0.30) * 0.16;  // gökyüzünün sudaki sekmesi

          // --- kara: silüet. uKoyu'nun ALTINA inmiyor (palet tabanı #073F49).
          vec3 kara = uKoyu * 0.86;
          kara = mix(kara, uTeal * 0.62, smoothstep(suHatti, tepe, p.y) * 0.55);

          vec3 col = gok;
          col = mix(col, kara, smoothstep(0.010, -0.010, p.y - tepe));
          col = mix(col, su, smoothstep(0.008, -0.008, p.y - suHatti));

          // --- geçen kütleler: dolaşımın okunur tanesi ----------------------
          // İlk sürümde bunlar KOYU suyun üstünde KOYU lekelerdi: görünmezdi.
          // Artık suyun üstünde parlayan ışıklar — koyu suda tek okunur tane.
          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float bx = mod(fi * 1.15 + uT * 0.030 + 2.4, 3.4) - 1.7;
            float by = suHatti - 0.075 - fi * 0.055;
            float m = exp(-(pow((p.x - bx) / 0.10, 2.0)
                          + pow((p.y - by) / 0.020, 2.0)));
            col += uCyanAcik * m * 0.85;
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    disariSahne.add(new THREE.Mesh(disariGeo, disariMat));

    // ---- (2) oda: kutunun iç yüzeyi --------------------------------------
    const odaGeo = new THREE.BoxGeometry(
      ODA.yariEn * 2,
      ODA.yukseklik,
      ODA.girisZ - ODA.dipZ,
    );
    odaGeo.translate(0, ODA.yukseklik / 2, (ODA.dipZ + ODA.girisZ) / 2);

    const odaMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      defines: { TAP: kaba ? 10 : 20 },
      uniforms: {
        tDisari: { value: rt.texture },
        uDelik: { value: delik },
        uEksen: { value: eksen },
        uDusme: { value: dusme },
        uR: { value: R },
        uU: { value: U },
        uF: { value: F },
        uK: { value: disK },
        uTanFov: { value: Math.tan(DIS_YARI_FOV) },
        uYariAci: { value: YARI_ACI },
        uAciklik: { value: ACIKLIK_GENIS },
        uProjGuc: { value: 1.0 },
        uKoyu: { value: new THREE.Color(P.koyu) },
        uTeal: { value: new THREE.Color(P.teal) },
        uCyanAcik: { value: new THREE.Color(P.cyanAcik) },
        uSisYog: { value: 0.0138 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        varying vec3 vN;
        varying float vDerinlik;
        void main() {
          vec4 d = modelMatrix * vec4(position, 1.0);
          vPos = d.xyz;
          // BoxGeometry normalleri DIŞA bakar; iç yüzeyi boyuyoruz → çevir.
          vN = normalize(mat3(modelMatrix) * -normal);
          vec4 mv = viewMatrix * d;
          vDerinlik = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDisari;
        uniform vec3 uDelik, uEksen, uDusme, uR, uU, uF;
        uniform float uK, uTanFov, uYariAci, uAciklik, uProjGuc, uSisYog;
        uniform vec3 uKoyu, uTeal, uCyanAcik;

        varying vec3 vPos;
        varying vec3 vN;
        varying float vDerinlik;

        ${GURULTU_GLSL}
        ${GNOMONIK_GLSL}
        ${CIKIS_GLSL}

        void main() {
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vPos);

          // --- taban: sıva. ---
          // İlk render'da taban uKoyu→uTeal arası karışıyordu ve oda düpedüz
          // AYDINLIKTI: her yüzey aynı orta teal, ışık-gölge yok, yani tur 1'in
          // (d) maddesi — "sakin" değil OLAYSIZ. Camera obscura'nın tek kuralı
          // odanın karanlık olması; taban artık paletin en koyu değerinde
          // (#073F49) duruyor ve ondan YUKARI çıkan tek şey deliğin ışığı.
          // Metnin okunabilirliği tam olarak buradan geliyor: perde değil, oda.
          float yakin = 1.0 - smoothstep(5.0, 24.0, vDerinlik);
          float g1 = fbm3(vPos * 0.80);
          float g2 = fbm3(vPos * 3.05 + 11.0);
          float tane = (hash31(floor(vPos * 42.0)) - 0.5) * 0.13 * yakin;
          vec3 col = uKoyu * (0.72 + g1 * 0.40);
          col *= 1.0 + (g2 - 0.5) * 0.30 + tane;
          // Tealin sıcak ucu yalnız sıvanın en açık damarlarında görünsün:
          // renk bilgisi kalsın ama değer yükselmesin.
          col = mix(col, uTeal * 0.42, smoothstep(0.55, 0.95, g1) * 0.35);

          // --- projeksiyon: dışarısı, baş aşağı ---
          vec3 toFrag = vPos - uDelik;
          float L = length(toFrag);
          vec3 dir = toFrag / max(L, 1e-4);
          float aci = acos(clamp(dot(dir, uEksen), -1.0, 1.0));
          // bore vinyeti: kalın duvardaki delik kenarda ışığı keser → oval'in
          // yumuşak kenarı buradan gelir. Dikdörtgen perde asla oluşamaz.
          // 0.66 çok erken kısıyordu: oval'in dış %34'ü düz bir rampaydı ve
          // görüntünün kenarını yiyordu — profil ölçümünde tek tümsek olarak
          // görünen zarf buydu. Gerçek bir bore kenarda SERT keser.
          float bore = 1.0 - smoothstep(uYariAci * 0.82, uYariAci, aci);

          if (bore > 0.003) {
            vec3 uvf = disariUV(dir, uR, uU, uF, uK);
            if (uvf.z > 0.0) {
              // Bulanıklık dairesinin dünya çapı = delik çapı (uzak nesne).
              // uv birimine çevir: uv [0,1] ≈ 2*L*tan(yarıFOV) dünya genişliği.
              float rad = uAciklik / max(2.0 * L * uTanFov, 1e-3);
              // Her fragmentte dönüş: 20 tap'lik spiral banding yapmasın.
              float rot = hash21(gl_FragCoord.xy) * 6.28318;
              vec3 acc = vec3(0.0);
              for (int i = 0; i < TAP; i++) {
                float fi = float(i) + 0.5;
                float rr = sqrt(fi / float(TAP));
                float th = fi * 2.39996323 + rot;
                acc += texture2D(tDisari, uvf.xy + vec2(cos(th), sin(th)) * rr * rad).rgb;
              }
              acc /= float(TAP);

              // Yüzeye geliş açısı: yalayan yüzey aynı ışığı geniş alana yayar
              // → sönük. Oval'in tavana/sol duvara taşan ucu bu yüzden zayıflar.
              float gelme = clamp(dot(-dir, N), 0.0, 1.0);
              float dususs = pow(clamp(14.0 / L, 0.0, 2.0), 1.25);
              col += acc * bore * gelme * dususs * uProjGuc;
            }
          }

          // --- delik: sahnenin olayı. Üç katmanlı parlama, post-process yok. ---
          // Katmanlar ilk denemede çok GENİŞTİ (hale 0.20, kanama 1.25): delik
          // 60px'lik yumuşak bir leke gibi okuyordu, "keskin nokta" değil.
          // Artık çekirdek küçük ve gerçekten patlıyor, hale ona sıkıca oturuyor,
          // kanama sadece duvara ışığın sızdığını söylüyor.
          float dd = distance(vPos, uDelik);
          col += uCyanAcik * exp(-dd * dd / 0.0075) * 90.0;  // çekirdek: patlar
          col += uCyanAcik * exp(-dd / 0.085) * 4.0;         // hale: sıkı
          col += uCyanAcik * exp(-dd / 0.60) * 0.22;         // kanama: duvara sızma

          // --- ışık-gölge: iki gerçek kaynak, gerçek ters-kare düşüş ---------
          // ÖNCEKİ HALİ ÖLÜ KODDU. Pay 0.10, payda (1 + d*d*0.16) idi; oda
          // ölçeğinde (d ≈ 15–25) katkı ~0.001'e iniyordu. Piksel ölçümü bunu
          // doğruladı: tavan (7,59,68) · sol duvar (7,59,68) · sağ duvar
          // (6,60,69) · dip duvar (7,57,66) · taban (6,54,62) — beş ayrı
          // yönelim, beş ayrı derinlik, TEK değer. Işık-gölge yoktu; oda düz
          // bir #073F49 dolgusuydu ve tur 1'in (d) maddesine ("kontrastsız =
          // olaysız") tam olarak düşüyordu.
          //
          // Kaynaklar artık gerçekten yayıyor. Kritik nokta: bu, metnin
          // arkasını AYDINLATMIYOR ve aydınlatamaz —
          //   · dip duvarın normali +Z, oval de dip duvarın ÜSTÜNDE duruyor →
          //     N·L = 0, yani başlığın oturduğu yüzey oval'den MATEMATİKSEL
          //     OLARAK sıfır ışık alıyor;
          //   · metin bandı (ortada, önde, alçakta) her iki kaynağa da uzak →
          //     ters-kare onu gölgede bırakıyor.
          // Kazanılan şey: oval'in ışığı sol-arka köşeyi ve tavanı yıkıyor,
          // delik sağ tarafı tutuyor. Karanlık artık global bir dolgu değil,
          // IŞIĞIN BİTTİĞİ YER — okunabilirlik perdeden değil, mesafeden.
          vec3 Lb = uDusme - vPos;
          float bd = length(Lb);
          float nb = max(dot(N, Lb / bd), 0.0);
          col += uCyanAcik * nb * 0.45 / (0.9 + bd * bd * 0.055);

          vec3 Lh = uDelik - vPos;
          float hd = length(Lh);
          float nh = max(dot(N, Lh / hd), 0.0);
          col += uCyanAcik * nh * 0.30 / (0.8 + hd * hd * 0.09);

          // Oval'in KENDİ düzlemine sızması — sıvanın içinde saçılan ışık.
          // Buna ihtiyaç var çünkü dip duvarın normali +Z ve oval de o duvarın
          // üstünde: N·L = 0, yani dip duvar yukarıdaki terimden tam olarak
          // SIFIR alıyor. İlk düzeltmemde katsayılar 0.95/0.60'tı ve sonuç
          // görüldü: tavan ile yan duvarlar patladı, dip duvar aralarında DÜZ
          // BİR KOYU DİKDÖRTGEN olarak okudu — yani yasaklanan panel, sadece
          // açık değil koyu olanı. Katsayılar kısıldı ve duvara kendi içinden
          // yumuşak, köşegen bir gradyan verildi: kenarları artık mutlak değil.
          // Oval sol ÜSTTE, metin alt ORTADA → gradyan metne varmadan sönüyor.
          col += uCyanAcik * exp(-bd / 3.2) * 0.16;

          // --- taban: cilalı taş, deliğin YALAYAN parıltısı ---
          // İlk render'da buradaki iki lob (özellikle üs=30 olan yayvan oval
          // yansıması) tabanın alt yarısını yıkayıp başlığın ve CTA'nın arkasına
          // parlak bir leke koyuyordu: yani tam olarak yasaklanan scrim, sadece
          // CSS yerine ışıktan yapılmış hali. Loblar sertleştirildi ve kısıldı;
          // parıltı artık deliğin altında, kadrajın SAĞINDA, metin bloğunun
          // dışında duran ince bir çizgi — bir kontrast çıpası, zemin değil.
          float taban = smoothstep(0.86, 0.99, N.y);
          if (taban > 0.001) {
            vec3 Hh = normalize(Lh / hd + V);
            col += uCyanAcik * taban * pow(max(dot(N, Hh), 0.0), 620.0)
                 * 1.5 / (1.0 + hd * hd * 0.05);
            vec3 Hb = normalize(Lb / bd + V);
            col += uCyanAcik * taban * pow(max(dot(N, Hb), 0.0), 190.0) * 0.09;
          }

          // --- sis: FogExp2, elle. Fog rengi = paletin en koyu değeri, yani
          //     uzaklık her şeyi #073F49'a çeker. Saf siyah matematiksel olarak
          //     imkânsız.
          float sis = 1.0 - exp(-uSisYog * uSisYog * vDerinlik * vDerinlik);
          col = mix(col, uKoyu, sis);

          gl_FragColor = vec4(dizle(col), 1.0);
          #include <colorspace_fragment>
          // 1 LSB dither: koyu teal gradyanların bantlanmasını öldürür.
          gl_FragColor.rgb += (hash21(gl_FragCoord.xy + 7.3) - 0.5) / 255.0;
        }
      `,
    });
    const oda = new THREE.Mesh(odaGeo, odaMat);

    const sahne = new THREE.Scene();
    sahne.background = new THREE.Color(P.koyu);
    sahne.add(oda);

    // ---- (3) koni: huzmenin kendisi --------------------------------------
    // FrontSide: ön yüz ışının koniye GİRİŞ noktası, hiçbir zaman duvar
    // tarafından yutulmaz. Çıkış noktası analitik hesaplanıyor ve oda
    // kutusuyla kırpılıyor → huzme dip duvarın ÖNÜNDE de görünür kalır.
    // (BackSide denenirse: koninin arka yüzü duvarın arkasına düşünce
    //  depth test huzmeyi tamamen siler.)
    const koniBoyTam = koniBoy + 1.4; // dip duvarın içine göm
    const koniGeo = new THREE.CylinderGeometry(
      0.02,
      koniBoyTam * Math.tan(YARI_ACI),
      koniBoyTam,
      44,
      1,
      true,
    );
    const koni = new THREE.Mesh(
      koniGeo,
      new THREE.ShaderMaterial({
        side: THREE.FrontSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        defines: { ADIM: kaba ? 6 : 12 },
        uniforms: {
          tDisari: { value: rt.texture },
          uT: { value: DURGUN_T },
          uDelik: { value: delik },
          uEksen: { value: eksen },
          uR: { value: R },
          uU: { value: U },
          uF: { value: F },
          uK: { value: disK },
          uCos: { value: Math.cos(YARI_ACI) },
          uTan: { value: Math.tan(YARI_ACI) },
          uBoy: { value: koniBoy },
          uKutuMin: {
            value: new THREE.Vector3(-ODA.yariEn, 0, ODA.dipZ),
          },
          uKutuMax: {
            value: new THREE.Vector3(ODA.yariEn, ODA.yukseklik, ODA.girisZ),
          },
          uGuc: { value: 0.052 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vPos;
          void main() {
            vec4 d = modelMatrix * vec4(position, 1.0);
            vPos = d.xyz;
            gl_Position = projectionMatrix * viewMatrix * d;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D tDisari;
          uniform float uT, uK, uCos, uTan, uBoy, uGuc;
          uniform vec3 uDelik, uEksen, uR, uU, uF, uKutuMin, uKutuMax;
          varying vec3 vPos;

          ${GURULTU_GLSL}
          ${GNOMONIK_GLSL}
          ${CIKIS_GLSL}

          // Işının kutudan ÇIKIŞ mesafesi: huzmeyi duvarda kes.
          float kutuCikis(vec3 ro, vec3 rd) {
            vec3 t1 = (uKutuMin - ro) / rd;
            vec3 t2 = (uKutuMax - ro) / rd;
            vec3 tmax = max(t1, t2);
            return min(min(tmax.x, tmax.y), tmax.z);
          }

          void main() {
            vec3 ro = cameraPosition;
            vec3 rd = normalize(vPos - ro);

            // --- sonsuz koni ile analitik kesişim ---
            vec3 co = ro - uDelik;
            float dv = dot(rd, uEksen);
            float cv = dot(co, uEksen);
            float c2 = uCos * uCos;
            float a = dv * dv - c2;
            float b = 2.0 * (dv * cv - dot(rd, co) * c2);
            float c = cv * cv - dot(co, co) * c2;
            if (abs(a) < 1e-5) discard;
            float disc = b * b - 4.0 * a * c;
            if (disc < 0.0) discard;
            float sq = sqrt(disc);
            float ta = (-b - sq) / (2.0 * a);
            float tb = (-b + sq) / (2.0 * a);
            float t0 = min(ta, tb);
            float t1 = max(ta, tb);
            t0 = max(t0, 0.0);
            t1 = min(t1, kutuCikis(ro, rd));
            if (t1 <= t0) discard;

            // --- tek katman raymarch: huzme dışarıdaki görüntüyü TAŞIYOR ---
            vec3 acc = vec3(0.0);
            float dt = (t1 - t0) / float(ADIM);
            for (int i = 0; i < ADIM; i++) {
              vec3 p = ro + rd * (t0 + dt * (float(i) + 0.5));
              vec3 rel = p - uDelik;
              float h = dot(rel, uEksen);
              // Yanlış nappe ve duvarın ötesi: katkı yok.
              if (h <= 0.02 || h > uBoy) continue;
              float rr = length(rel - uEksen * h);
              float radial = 1.0 - smoothstep(0.55, 1.0, rr / max(h * uTan, 1e-3));
              if (radial <= 0.0) continue;

              vec3 uvf = disariUV(rel / max(length(rel), 1e-4), uR, uU, uF, uK);
              vec3 img = uvf.z > 0.0 ? texture2D(tDisari, uvf.xy).rgb : vec3(0.0);

              // Toz: havanın kendisi. Ayrı parçacık sistemi yok — huzmenin
              // içindeki 3B gürültü hacmi veriyor, bütçe de büyümüyor.
              float toz = 0.60 + 0.40 * fbm3(p * 0.62 + vec3(0.0, uT * 0.045, uT * 0.02));
              // Gerçek düşüş 1/h²; ham bırakılırsa huzme delikten 2 birim sonra
              // ölüyor ve salon "olaysız" kalıyor. Yumuşatılmış düşüş.
              float dus = 1.0 / (0.55 + h * h * 0.020);
              acc += img * radial * toz * dus;
            }
            acc *= dt * uGuc;

            gl_FragColor = vec4(dizle(acc), 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    );
    koni.position.copy(delik).addScaledVector(eksen, koniBoyTam / 2);
    koni.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      eksen.clone().negate(), // +Y → apekse doğru: dar uç delikte
    );
    koni.renderOrder = 2;
    sahne.add(koni);

    // ---- kamera -----------------------------------------------------------
    const k0 = cerceve((kap.clientWidth || 16) / (kap.clientHeight || 9));
    const kamera = new THREE.PerspectiveCamera(k0.fov, 1, 0.1, 80);
    kamera.position.set(0, KAMERA_Y, k0.kameraZ);
    // lookAt yok: eğim sabit → ufuk kadrajda çivili, oval ve delik yerinden
    // oynamaz. Fare parallaksı yalnız konumu oynatır.

    // ---- fare parallaksı --------------------------------------------------
    const fare = { x: 0, y: 0 };
    const hedef = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedef.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedef.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba) {
      window.addEventListener("pointermove", fareOynat, { passive: true });
    }

    // ---- disiplin şeridi: dışarıdaki akışın CPU örneği --------------------
    const isikGonder = (t: number) => {
      const f = bildirRef.current;
      if (!f) return;
      f(
        ornekRef.current.map((a) =>
          THREE.MathUtils.clamp((bant(a, t) - 0.28) / 0.5, 0, 1),
        ),
      );
    };

    const oU = odaMat.uniforms;
    const kU = (koni.material as THREE.ShaderMaterial).uniforms;

    /** Açıklık nefesi: delik daralınca görüntü keskinleşir. Parlaklık gerçekte
     *  çap² ile düşer; burada yalnız hafifçe bağlandı — tam bağlanırsa dar
     *  açıklıkta sahne kararıp "olaysız" oluyor (tur 1, madde d). */
    const nefes = (t: number) => {
      const s = 0.5 + 0.5 * Math.sin(t * NEFES_HIZ);
      const cap = ACIKLIK_DAR + (ACIKLIK_GENIS - ACIKLIK_DAR) * s;
      oU.uAciklik.value = cap;
      // Üstel diz mid'leri bir miktar indiriyor; projeksiyon buradan telafi
      // ediliyor. Utangaç bir projeksiyon bu sahneyi öldürür — cesur tut.
      oU.uProjGuc.value = 1.30 + 0.34 * s;
    };

    const cizKare = (t: number) => {
      disariMat.uniforms.uT.value = t;
      kU.uT.value = t;
      nefes(t);
      cizer.setRenderTarget(rt);
      cizer.render(disariSahne, disariKam);
      cizer.setRenderTarget(null);
      cizer.render(sahne, kamera);
      isikGonder(t);
    };

    // ---- döngü ------------------------------------------------------------
    let id = 0;
    let gorunur = false;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const ciz = () => {
      const t = saat.getElapsedTime();
      fare.x += (hedef.x - fare.x) * 0.042;
      fare.y += (hedef.y - fare.y) * 0.042;
      kamera.position.x = fare.x * 0.7;
      kamera.position.y = KAMERA_Y - fare.y * 0.3 + Math.sin(t * 0.22) * 0.04;
      cizKare(t);
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

    const boyutla = () => {
      const w = kap.clientWidth;
      const h = kap.clientHeight;
      if (!w || !h) return;
      const k = cerceve(w / h);
      kamera.fov = k.fov;
      kamera.aspect = w / h;
      kamera.position.z = k.kameraZ;
      kamera.updateProjectionMatrix();
      cizer.setSize(w, h);
      if (statik) cizKare(DURGUN_T);
    };
    boyutla();

    // reduced-motion BASE katman: rAF hiç başlamaz, tek statik kare.
    if (statik) cizKare(DURGUN_T);

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

    const ro = new ResizeObserver(boyutla);
    ro.observe(kap);

    return () => {
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", fareOynat);
      odaGeo.dispose();
      odaMat.dispose();
      koniGeo.dispose();
      (koni.material as THREE.ShaderMaterial).dispose();
      disariGeo.dispose();
      disariMat.dispose();
      rt.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

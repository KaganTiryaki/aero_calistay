"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  BOLME_ALT,
  BOLME_SAYI,
  BOLME_UST,
  DIP,
  DURGUN_T,
  GOK,
  GOVDE,
  ISIK,
  KULE_GLSL,
  NANE,
  SAFT_H,
  SEKME,
  SIVA,
  YARI_ALT,
  YARI_UST,
  bolmeKesir,
  mulberry32,
  yariCap,
} from "./kule";

/*
 * RÜZGÂR KULESİ (BÂDGİR)
 * ---------------------------------------------------------------------------
 * Kamera bir rüzgâr kulesinin DİBİNDE, yukarı bakıyor. Dört duvar yukarıdaki
 * gök ağzına doğru yakınsıyor. Ortada, kameranın yukarısından başlayıp ağza
 * kadar uzanan YEDİ DÜŞEY OLUK var: bâdgir'in hava kanalları. Işık her oluğa
 * ayrı ayrı iniyor → karşı duvarda düşey aydınlık-karanlık şeritleri. Metin,
 * bölmelerin ALTINDA, ışığın 1/d² ile öldüğü sakin dipte duruyor.
 *
 * Neden god-ray / katedral DEĞİL (en ciddi risk buydu):
 *   · Işık kaynağı HUZME değil ALAN: ağız bir dikdörtgen, aydınlatma analitik
 *     form faktörü (bkz. kule.ts agizIsigi). Yönlü lamba, spot, cone YOK.
 *   · Hacimsel katman (hava) bölme gölgesi TAŞIMIYOR — bilerek. Havada şerit
 *     olsaydı ışık "huzme" olarak görünürdü ve fikir yanardı. Şeritler sadece
 *     KATI YÜZEYLERDE.
 *
 * Neden MERDİVEN değil (tur 1'in ölümcül kusuru):
 *   Merdiven yatay bir tekrardır. Bu sahnede yatay tekrar KALMADI: bölmeler
 *   düşey, sıva damarları düşey akıntı. Tur 1'deki yatay hatıl sıraları da
 *   kaldırıldı — basamak okumasını besleyen tek şey onlardı.
 *
 * Neden "beyaz dikdörtgen perde" YOK:
 *   Metnin oturduğu dip, GEOMETRİ GEREĞİ en karanlık yer — hem ağız oradan en
 *   uzak, hem duvarın yatay normaline en dik, hem de bölmeler ağza kadar
 *   uzandığı için dipten ağzın çok küçük bir kısmı görünüyor. Panel gereksiz.
 */

// ---- kadraj ---------------------------------------------------------------
// Mobil 9:16 BAŞTAN planlandı (sonradan yama değil). three'de `fov` DİKEY'dir:
// dar ekranda dikey kadraj kendiliğinden değişmez, yalnız yanlar kırpılır.
// O yüzden dar ekranda fov'u AÇIP eğimi DÜŞÜRÜYORUZ → dipte metnin oturacağı
// sakin duvar bandı büyüyor, ağız hâlâ kadrajda kalıyor.
//
// Eğim neden bu kadar yüksek (57°): ağız kameradan ~80° yukarıda. Kadrajın
// TEPESİ ağzın ÜSTÜNE (≈88°) çıkmalı ki ağzın üstünde yakın duvarın koyu
// şeridi kalsın — üst bar (marka/nav/CTA) oraya oturuyor. Tur 1'de kadraj
// tepesi 75°'deydi: ağız kırpılıyordu VE nav tam ağzın parlaklığına biniyordu,
// yani okunmuyordu.
//
// kamZ NEDEN MERKEZE YAKIN (2.9, duvar 6.5'te) — iki kusuru birden çözüyor:
//   · Görünen gök yarığının en-boy oranı = 7·cos(yükseliş açısı). Kamera
//     duvarın dibindeyken (z=5.0) ağız 72°'de kalıyordu → oran 2.2 → uzun dar
//     dikdörtgen → KAPI okuması. Merkeze çekilince açı 80° → oran 1.2 → kare
//     bir açıklık.
//   · Duvarın dibindeyken yan duvarlar sıyırma açısıyla görünüyordu ve ağızdan
//     inen ışık onlara YELPAZE gibi düşüyordu — ekranda huzme okuyordu.
//     Merkezden bakınca yan duvarlar sıyırma açısından çıkıyor, yelpaze bitiyor.
// Kamera yine de eksende DEĞİL: tam eksende ağız simetrik bir hedef tahtası
// olurdu. z=2.9 hem merkeze yakın hem hafif kaçık.
function cerceve(aspect: number) {
  const dar = THREE.MathUtils.clamp((1.5 - aspect) / (1.5 - 0.62), 0, 1);
  return {
    fov: THREE.MathUtils.lerp(62, 72, dar),
    egim: THREE.MathUtils.degToRad(THREE.MathUtils.lerp(57, 52, dar)),
    kamY: THREE.MathUtils.lerp(1.8, 1.9, dar),
    kamZ: THREE.MathUtils.lerp(2.9, 3.2, dar),
    dar,
  };
}

/** Şaft + bölme yüzeyleri: tek shader, iki materyal (normal kaynağı farklı). */
function yuzeyMateryali(duvar: boolean) {
  return new THREE.ShaderMaterial({
    fog: true, // ShaderMaterial'da fog varsayılan kapalı
    side: duvar ? THREE.BackSide : THREE.DoubleSide,
    defines: duvar ? { DUVAR: "" } : {},
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uDip: { value: new THREE.Color(DIP) },
        uSiva: { value: new THREE.Color(SIVA) },
        uIsik: { value: new THREE.Color(ISIK) },
        uSekme: { value: new THREE.Color(SEKME) },
        // Kazanç yalnız AĞIZ ışığını ölçekliyor, sekmeyi değil: tepe filmik
        // rolloff'a girip BEYAZA yuvarlansın ama dip teal kalsın.
        // Sekme tabanı yükseltildiği için (bkz. kule.ts sekmeIsigi) kazanç da
        // indi: yoksa dip yıkanıp "sarnıç sütunları" gibi soluk bir kadraj
        // oluyordu. Anahtar/dolgu oranı hâlâ ağızdan yana.
        uKazanc: { value: duvar ? 3.8 : 3.2 },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec3 vDunya;
      varying vec3 vNormalGeo;
      varying float vDerinlik;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vec4 dunya = modelMatrix * vec4(position, 1.0);
        vDunya = dunya.xyz;
        vNormalGeo = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * dunya;
        vDerinlik = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uDip;
      uniform vec3 uSiva;
      uniform vec3 uIsik;
      uniform vec3 uSekme;
      uniform float uKazanc;

      varying vec3 vDunya;
      varying vec3 vNormalGeo;
      varying float vDerinlik;

      #include <common>
      #include <fog_pars_fragment>
      ${KULE_GLSL}

      void main() {
        vec3 P = vDunya;

        #ifdef DUVAR
          // Daralan kare şaftın İÇ normali analitik: hangi duvardaysak
          // (|x| mi |z| mi büyük) yüzey x = a - b*y düzlemi. Türev/flat-shading
          // hilesi gerekmiyor, köşeler tam keskin çıkıyor.
          float b = (YARI_ALT - YARI_UST) / SAFT_H;
          vec3 N;
          if (abs(P.x) > abs(P.z)) N = normalize(vec3(-sign(P.x), -b, 0.0));
          else                     N = normalize(vec3(0.0, -b, -sign(P.z)));
        #else
          // Bölmeler sıfır kalınlıkta düzlem (analitik gölge modeli de tam
          // olarak bunu varsayıyor → geometri ile ışık BİREBİR aynı şey).
          // İki yüzü de var → normali bakan tarafa çevir.
          vec3 N = normalize(vNormalGeo) * (gl_FrontFacing ? 1.0 : -1.0);
        #endif

        // Gölge biası: yüzey kendini gölgelemesin; bölmede normal yönü
        // örnek noktasını doğru oluğa itiyor.
        float agiz = agizIsigi(P + N * 0.02, N) * uKazanc;
        float sekme = sekmeIsigi(P.y);

        // Işık BEYAZ, sekme CYAN → parlak uç beyaza, gölge teal'e gidiyor.
        // Tur 1'de ikisi de cyan'dı ve çarpım R kanalını öldürüyordu.
        vec3 I = uIsik * agiz + uSekme * sekme;

        // --- sıva greni: kerpiç kule ama soğuk sıva. Bej/kum YOK, sadece
        // DEĞER oynaması — hue tek ailede kalıyor.
        float yakin = 1.0 - smoothstep(8.0, 30.0, vDerinlik);
        float damar = gurultu3(P * 0.9) * 0.55 + gurultu3(P * 3.1) * 0.30
                    + gurultu3(P * 11.0) * 0.15;
        damar = damar * 2.0 - 1.0;
        float tane = (gurultu3(P * 38.0) - 0.5) * 0.10 * yakin;
        // Sıva lekesi: YÖNSÜZ (izotropik) olmak ZORUNDA.
        // Tur 1'de burada YATAY hatıl sıraları vardı → basamak okumasını
        // besleyen ikinci suçluydu. İlk düzeltmede DÜŞEY akıntıya çevirdim ve
        // daha beter oldu: yan duvarlar sıyırma açısından görünüyor, dünyada
        // düşey olan her çizgi ekranda kaçış noktasına yakınsıyor → kadrajın
        // altı ışık huzmesi gibi RADYAL şeritlerle doldu, yani tam olarak
        // kaçındığımız god-ray okuması. Yönlü hiçbir doku güvenli değil:
        // yatay → merdiven, düşey → huzme. İzotropik leke ikisini de vermiyor,
        // ölçeği de damar + tane zaten taşıyor.
        float leke = gurultu3(P * 1.6) * 0.6 + gurultu3(P * 5.5) * 0.4;
        leke = smoothstep(0.5, 0.9, leke) * 0.09 * yakin;

        vec3 col = uDip + uSiva * I * (1.0 + damar * 0.14 + tane);
        col *= 1.0 - leke;

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

type Props = { sinif?: string };

export function BadgirSahnesi({ sinif }: Props) {
  const kapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const statik = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kaba = window.matchMedia("(pointer: coarse)").matches;

    // ---- kurulum ---------------------------------------------------------
    const sahne = new THREE.Scene();
    // Arka plan = ağızdan görünen gökyüzü. Şaft kapalı olduğu için arka plan
    // yalnız ağzın içinden görünür.
    sahne.background = new THREE.Color(GOK);
    sahne.fog = new THREE.FogExp2(new THREE.Color(GOVDE).getHex(), 0.007);

    const k0 = cerceve(Math.max(kap.clientWidth, 1) / Math.max(kap.clientHeight, 1));
    const kamera = new THREE.PerspectiveCamera(k0.fov, 1, 0.1, 120);
    kamera.position.set(0, k0.kamY, k0.kamZ);
    // lookAt YOK: eğim sabit → ağız kadrajda çivili kalır, fare parallaksı
    // yalnız konumu oynatır. Metin bloğu asla ışığın içine kaymaz.
    kamera.rotation.set(k0.egim, 0, 0);
    sahne.add(kamera); // hacim katmanı kameranın çocuğu → traverse edilmeli

    const cizer = new THREE.WebGLRenderer({
      antialias: !kaba,
      powerPreference: "high-performance",
    });
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, kaba ? 1.25 : 1.5));
    cizer.setSize(kap.clientWidth, kap.clientHeight);
    // Ağız aşırı parlak: filmik rolloff olmadan saf beyaza kırpar. ACES tepeyi
    // beyaza yuvarlıyor — ışık beyaz olduğu için artık gerçekten BEYAZA.
    cizer.toneMapping = THREE.ACESFilmicToneMapping;
    cizer.toneMappingExposure = 1.05;
    kap.appendChild(cizer.domElement);

    // ---- şaft: daralan kare baca ----------------------------------------
    // CylinderGeometry(radialSegments=4) = kare kesitli kesik piramit. "radius"
    // çevrel yarıçap → apotem = r·cos(45°), o yüzden /cos(PI/4).
    const kSec = Math.cos(Math.PI / 4);
    const saftGeo = new THREE.CylinderGeometry(
      YARI_UST / kSec,
      YARI_ALT / kSec,
      SAFT_H,
      4,
      18, // yükseklik bölmesi: fog tepe-başına hesaplanıyor, az bölme bantlar
      true,
    );
    saftGeo.rotateY(Math.PI / 4); // köşeler değil YÜZLER eksenlere baksın
    saftGeo.translate(0, SAFT_H / 2, 0);
    const duvarMat = yuzeyMateryali(true);
    const saft = new THREE.Mesh(saftGeo, duvarMat);
    sahne.add(saft);

    // Zemin: şaftın dibi açık olduğu için arka planın (gök) sızmasını kapatıyor.
    const zeminGeo = new THREE.PlaneGeometry(60, 60);
    const zeminMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(DIP), fog: true });
    const zemin = new THREE.Mesh(zeminGeo, zeminMat);
    zemin.rotation.x = -Math.PI / 2;
    sahne.add(zemin);

    // ---- düşey bölmeler: kulenin hava olukları ---------------------------
    // Her bölme s = a_i düzleminde bir yamuk: dünyada x = a_i·yariCap(y).
    // yariCap y'de lineer olduğu için yamuk DÜZLEMSEL — analitik gölge testi
    // de tam olarak bu düzlemi varsayıyor, yani geometri ile ışık aynı model.
    const bolmeGeo = new THREE.BufferGeometry();
    const kose: number[] = [];
    const normal: number[] = [];
    const bEgim = (YARI_UST - YARI_ALT) / SAFT_H; // dx/dy katsayısı
    for (let i = 0; i < BOLME_SAYI; i++) {
      const a = bolmeKesir(i);
      const wAlt = yariCap(BOLME_ALT);
      const wUst = yariCap(BOLME_UST);
      // Yamuğun dört köşesi: bölme ASILI — üst kenarı ağza DEĞMİYOR (bkz. kule.ts
      // BOLME_UST notu: ağza değince oluk kolimatör oluyor ve dibe huzme atıyor).
      const p = [
        [a * wAlt, BOLME_ALT, -wAlt],
        [a * wAlt, BOLME_ALT, wAlt],
        [a * wUst, BOLME_UST, wUst],
        [a * wUst, BOLME_UST, -wUst],
      ];
      // Düzlem: x - a·(YARI_ALT + bEgim·y) = 0 → normal ∝ (1, -a·bEgim, 0)
      const n = new THREE.Vector3(1, -a * bEgim, 0).normalize();
      for (const [x, y, z] of [p[0], p[1], p[2], p[0], p[2], p[3]]) {
        kose.push(x, y, z);
        normal.push(n.x, n.y, n.z);
      }
    }
    bolmeGeo.setAttribute("position", new THREE.Float32BufferAttribute(kose, 3));
    bolmeGeo.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
    bolmeGeo.computeBoundingSphere();
    const bolmeMat = yuzeyMateryali(false);
    const bolmeler = new THREE.Mesh(bolmeGeo, bolmeMat);
    sahne.add(bolmeler);

    // ---- toz: ağızdan inen hava ------------------------------------------
    // Konum tamamen vertex shader'da (CPU'da buffer güncellemesi yok).
    // Parlaklık SADECE yüksekliğin fonksiyonu — bölme gölgesi UYGULANMIYOR,
    // yoksa havada ışık levhaları belirir = god-ray.
    const tozAdet = kaba ? 11000 : 40000;
    const tozGeo = new THREE.BufferGeometry();
    const tohum = new Float32Array(tozAdet * 4);
    const rnd = mulberry32(20260715);
    for (let i = 0; i < tozAdet; i++) {
      tohum[i * 4 + 0] = rnd();
      tohum[i * 4 + 1] = rnd();
      tohum[i * 4 + 2] = rnd();
      tohum[i * 4 + 3] = rnd();
    }
    tozGeo.setAttribute("aTohum", new THREE.BufferAttribute(tohum, 4));
    // position şart (three bounding hesabı için) — gerçek konum shader'da.
    tozGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tozAdet * 3), 3));
    tozGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, SAFT_H / 2, 0), SAFT_H);

    const tozMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uT: { value: DURGUN_T },
        uBoy: { value: 0 },
        uIsik: { value: new THREE.Color(ISIK) },
        uNane: { value: new THREE.Color(NANE) },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aTohum;
        uniform float uT;
        uniform float uBoy;
        varying float vGuc;
        varying float vNane;
        ${KULE_GLSL}
        void main() {
          float hiz = 0.5 + aTohum.w * 0.55;
          // Aşağı akış + sarma: hava ağızdan giriyor, dipte kayboluyor.
          float y = SAFT_H - mod(aTohum.y * SAFT_H + uT * hiz, SAFT_H);
          float r = yariCap(y) * 0.94;
          // Kare kesit — halka/yörünge olmasın diye kutupsal dağılım YOK.
          vec3 p = vec3((aTohum.x - 0.5) * 2.0 * r, y, (aTohum.z - 0.5) * 2.0 * r);
          // Kıvrım: hava düz düşmüyor, duvarlara sürtünüp savruluyor.
          p.x += sin(y * 0.33 + aTohum.x * 6.283 + uT * 0.21) * 0.85;
          p.z += cos(y * 0.29 + aTohum.z * 6.283 + uT * 0.17) * 0.85;

          float t = clamp(y / SAFT_H, 0.0, 1.0);
          vGuc = pow(t, 1.7) * (0.35 + aTohum.w * 0.65);
          vNane = step(0.94, aTohum.w); // çok seyrek nane kırıntısı
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          // uBoy = (piksel yüksekliği / 2); çarpan = tozun DÜNYA boyutu.
          gl_PointSize = uBoy * (0.03 + aTohum.w * 0.05) / max(-mv.z, 0.6);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uIsik;
        uniform vec3 uNane;
        varying float vGuc;
        varying float vNane;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.05, d) * vGuc * 0.5;
          if (a < 0.004) discard;
          gl_FragColor = vec4(mix(uIsik, uNane, vNane * 0.6) * a, a);
        }
      `,
    });
    const toz = new THREE.Points(tozGeo, tozMat);
    toz.frustumCulled = false;
    sahne.add(toz);

    // ---- hava: kameraya bakan additive dilimler --------------------------
    // Kameranın ÇOCUĞU: parallaks ile dilimler dünyada kayıyor, gürültü dünya
    // uzayında örneklendiği için hava yerinde duruyor. Bedava ve doğru.
    // Derinlik testi açık / yazma kapalı → duvarlar ve bölmeler önünü kesiyor.
    const dilimSayi = kaba ? 9 : 18;
    const havaGeo = new THREE.PlaneGeometry(1, 1);
    const havaMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uT: { value: DURGUN_T },
        uIsik: { value: new THREE.Color(ISIK) },
        uYogun: { value: 1.0 / dilimSayi },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDunya;
        void main() {
          vec4 d = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vDunya = d.xyz;
          gl_Position = projectionMatrix * viewMatrix * d;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uT;
        uniform vec3 uIsik;
        uniform float uYogun;
        varying vec3 vDunya;
        ${KULE_GLSL}
        void main() {
          vec3 P = vDunya;
          // Şaftın dışı hava değil → yumuşak kenarla kes.
          float w = yariCap(P.y);
          float ic = smoothstep(w, w - 1.6, abs(P.x)) * smoothstep(w, w - 1.6, abs(P.z));
          ic *= smoothstep(0.0, 2.0, P.y) * smoothstep(SAFT_H, SAFT_H - 3.0, P.y);
          if (ic < 0.002) discard;

          // Aşağı ötelenen + kıvrılan yoğunluk. İki oktav yetiyor.
          vec3 q = P * 0.16 + vec3(sin(P.y * 0.2 + uT * 0.1) * 0.4, -uT * 0.09, 0.0);
          float d = gurultu3(q) * 0.65 + gurultu3(q * 2.7 + 3.1) * 0.35;
          d = smoothstep(0.35, 0.95, d);

          // Parlaklık YALNIZ yükseklikle artıyor: ağza yakın hava aydınlık.
          // Bölme gölgesi BİLEREK yok — havadaki şerit = huzme = god-ray.
          float t = clamp(P.y / SAFT_H, 0.0, 1.0);
          float a = d * ic * uYogun * pow(t, 1.9) * 0.85;
          if (a < 0.002) discard;
          gl_FragColor = vec4(uIsik * a, a);
        }
      `,
    });
    const hava = new THREE.InstancedMesh(havaGeo, havaMat, dilimSayi);
    hava.frustumCulled = false;
    hava.renderOrder = 2;
    kamera.add(hava);

    const gecici = new THREE.Object3D();
    /** Dilimleri kameranın önüne, frustumu kaplayacak şekilde diz. */
    const havaKur = (fov: number, aspect: number) => {
      const yakin = 1.6;
      const uzak = 34;
      for (let i = 0; i < dilimSayi; i++) {
        const z = yakin + ((uzak - yakin) * i) / (dilimSayi - 1);
        const h = 2 * z * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * 1.15;
        gecici.position.set(0, 0, -z);
        gecici.rotation.set(0, 0, 0);
        gecici.scale.set(h * aspect, h, 1);
        gecici.updateMatrix();
        hava.setMatrixAt(i, gecici.matrix);
      }
      hava.instanceMatrix.needsUpdate = true;
    };

    // ---- fare parallaksı: ±2°, yalnız ince işaretçi + hareket açıkken -----
    const fare = { x: 0, y: 0 };
    const hedef = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedef.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedef.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba) {
      window.addEventListener("pointermove", fareOynat, { passive: true });
    }

    // ---- döngü -----------------------------------------------------------
    let id = 0;
    let gorunur = false;
    let calisiyor = false;
    let temelY = k0.kamY;
    let temelZ = k0.kamZ;
    const saat = new THREE.Clock();

    const ciz = () => {
      const t = saat.getElapsedTime();
      tozMat.uniforms.uT.value = t;
      havaMat.uniforms.uT.value = t;

      fare.x += (hedef.x - fare.x) * 0.045;
      fare.y += (hedef.y - fare.y) * 0.045;
      kamera.position.x = fare.x * 0.7;
      // Minik dolly + nefes: donmuş render hissini kıran, neredeyse görünmez.
      kamera.position.z = temelZ + fare.y * 0.5;
      kamera.position.y = temelY + Math.sin(t * 0.23) * 0.05;

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

    // reduced-motion BASE katman: rAF hiç başlamıyor, tek statik kare.
    // Görüntü eksiksiz — toz donuk, hava duruyor, ışık ve şeritler tam.
    const tekKare = () => cizer.render(sahne, kamera);

    const boyutla = () => {
      const w = kap.clientWidth;
      const h = kap.clientHeight;
      if (!w || !h) return;
      const k = cerceve(w / h);
      kamera.fov = k.fov;
      kamera.aspect = w / h;
      kamera.rotation.set(k.egim, 0, 0);
      temelY = k.kamY;
      temelZ = k.kamZ;
      kamera.position.set(kamera.position.x, k.kamY, k.kamZ);
      kamera.updateProjectionMatrix();
      cizer.setSize(w, h);
      // Nokta boyu piksel cinsinden → DPR ve ekran yüksekliğiyle ölçekle,
      // yoksa retina'da toz yarı boyuta düşer.
      tozMat.uniforms.uBoy.value = (h * cizer.getPixelRatio()) / 2;
      havaKur(k.fov, w / h);
      if (statik) tekKare();
    };
    boyutla();
    // İlk kare HER ZAMAN çizilir, rAF'ı beklemeden. Sadece reduced-motion'da
    // değil: sayfa arka planda açılırsa (document.hidden) ya da IO henüz
    // kesişme bildirmediyse döngü hiç başlamıyor ve tuval BOŞ kalıyordu.
    tekKare();

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
      saftGeo.dispose();
      duvarMat.dispose();
      zeminGeo.dispose();
      zeminMat.dispose();
      bolmeGeo.dispose();
      bolmeMat.dispose();
      tozGeo.dispose();
      tozMat.dispose();
      havaGeo.dispose();
      havaMat.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

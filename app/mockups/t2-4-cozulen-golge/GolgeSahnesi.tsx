"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
// DİKKAT: bu modül "golge.ts" OLAMAZ. Windows/macOS dosya sistemi büyük-küçük
// harf duyarsız olduğu için "./golge" isteği Golge.tsx bileşenine çözülüyor ve
// L0/parcalar undefined geliyordu — sahne sessizce boş kalıyordu. tsc yakalamaz
// (TS doğru çözüyor), yalnız bundler düşüyor.
import { L0, cozulmeSerit, mulberry32, parcalar, sapma } from "./cozulme";

/*
 * ÇÖZÜLEN GÖLGE
 * ---------------------------------------------------------------------------
 * Yüksek bir salonun içindeyiz. Havada yüzlerce parça asılı; ışık ağır ağır
 * salınırken gölgeleri dip duvarda kaos halinde savruluyor. Bir açıda hepsi
 * hizalanıp tek bir kesintisiz ufka dönüşüyor — sonra ışık geçiyor.
 *
 * KOMPOZİSYON (üstten alta, 1440x900'de ölçüldü):
 *   %0-12   duvarın karanlık tepesi (~87) — üst bar burada, AÇIK tipografiyle
 *   %12-38  parça bulutu, aydınlanan duvarın önünde koyu siluetler (~81 / ~212)
 *   %38-42  UFUK ÇİZGİSİ — ışık havuzunun tam ortasında (çizgi ~106, duvar ~219)
 *   %42-59  duvarın alt yarısı, zemin birleşimine doğru kararıyor
 *   %59-100 karanlık zemin — UI burada, AÇIK tipografiyle
 * Ufuk metin bandının ÜSTÜNDEN geçer; hiçbir yerde metnin arkasında değil.
 *
 * OKUNABİLİRLİK — panel yok, ışık var:
 *   Işık yukarı-önden geliyor ve dip duvara neredeyse DİK çarpıyor (0.94) →
 *   duvar sahnenin parlak yüzeyi. Aynı ışık zemine 17°'lik SIYIRMA açısıyla
 *   değiyor (0.30) → zemin yapısal olarak duvarın ~3 katı koyu. Kameraya bakan
 *   bütün yüzeyler (parçaların altları, ön zemin) ışığa sırtını dönmüş durumda.
 *   Testi geçiyor: "panel olmasa metin okunur muydu?" → panel zaten yok;
 *   koyuluk ışığın geometrisinin sonucu, üstüne serilmiş bir katman değil.
 *
 * KAMERA — iki işi birden yapıyor:
 *   1. ALÇAK: bulut V ekseninde ince (~1.6) ama U×L0 düzleminde 134×26. Alttan
 *      bakınca bu geniş yüz görünüyor → derinlemesine bir alan okunuyor.
 *      Yandan bakılsaydı "spagetti"ye düşerdi; brief'in uyardığı risk buydu.
 *   2. SOLDA (x=-14): L0 ekseninden ayrık (29.4°). Eksen üstünden bakılsaydı
 *      bütün parçalar üst üste binip tek bir lekeye çökerdi ve dağınıklık hiç
 *      okunmazdı. BEDELİ: kamera x=0'a bakıyor, yani 15.6° yaw var; bant
 *      simetrik olsa bile ekranda simetrik DEĞİL. Bant sınırları (cozulme.ts)
 *      bu yüzden asimetrik — bkz. oradaki not.
 */

// ---- palet ---------------------------------------------------------------
const ISIK = "#eaf9fb"; // tek yönlü kaynak
const GOK_YANSIMA = "#cdeef4"; // parlak duvarın hacme geri verdiği
// Parçaların altları YALNIZ bu dolguyu görüyor (ışık tepelerinde). İlk render'da
// bu değer çok düşüktü ve siluetler neredeyse saf siyaha düşüyordu — palet dışı.
// En koyu değer #073F49 civarında kalmalı.
const YER_YANSIMA = "#2e7a80";
const SIS = "#bfe3ea";
const DUVAR = "#dff3f7";
// Zemin ışığı 17°'lik sıyırma açısıyla aldığı için albedo'nun yalnız ~%30'u
// geri dönüyor; ölçümde kadrajın dibi rgb(4,23,27)'ye kadar iniyordu — #04171B,
// yani paletin en koyu değeri olan #073F49'un ÇOK altında, pratikte siyah.
// Metin zaten oraya oturduğu için kontrast sorunu yok; sorun paletin kendisi.
const ZEMIN = "#63b3bd";
const PARCA = "#7fb3ba";

// ---- mekân ---------------------------------------------------------------
const DUVAR_Z = -30;
const DUVAR_YUKSEK = 46;
// Bant -88..+46'ya uzadığı için gölgenin sağ ucu duvarda x≈+89'a kadar gidiyor.
// SALON_X=44 iken hem duvar geometrisi orada bitiyordu hem de x=44'teki yan
// duvar kadrajın sağ %8'ini kesip çizginin ucunu ndc.x≈0.83'te yutuyordu:
// çizgi sağ kenara ASLA ulaşamazdı. Salon çizgiyi taşıyacak kadar geniş.
const SALON_X = 100;
const YAN_DUVAR_X = 96;
const UFUK_Y = 10.5; // gölge çizgisinin duvarda oturduğu yükseklik
const D0 = 3; // bant düzleminin duvara L0 boyunca uzaklığı
// D0 küçük: çizginin ışık salınırken duvarda ÖTELENME miktarı ≈ açı × D0.
// Büyük olsaydı bütün ufuk yukarı aşağı süpürürdü; kaos parçaların kendi
// dağılmasından gelmeli, çizginin kaymasından değil.

const KAMERA = new THREE.Vector3(-14, 3, 20);
const BAKIS_EGIM = 1.5; // derece — kadrajın alt ~%40'ı zemin kalsın diye alçak

const ISIK_MESAFE = 70;

/** Kadraj: dikey FOV en-boya göre açılır ama sınırlanır. */
function cerceve(aspect: number) {
  const yatayYari = Math.tan(THREE.MathUtils.degToRad(38));
  return THREE.MathUtils.clamp(
    THREE.MathUtils.radToDeg(2 * Math.atan(yatayYari / Math.max(aspect, 0.3))),
    46,
    72,
  );
}

/**
 * Yüzeylere prosedürel değer kırılması enjekte eder. Doku dosyası yok.
 *
 * `sekil`: isteğe bağlı GLSL — `vDunyaK` dünya konumundan diffuseColor'ı
 * yeniden şekillendirir. Yönlü ışık tanımı gereği tekdüze; büyük bir salonun
 * duvarı ise asla tekdüze değildir (köşe kararması, temas gölgesi, mesafeyle
 * düşen dolaylı ışık). Bu olmadan duvar "düz açık dikdörtgen" gibi okuyor —
 * yani tam olarak yasaklanan perde etkisi, sahne kılığında.
 */
function grenEkle(
  mat: THREE.MeshStandardMaterial,
  olcek: number,
  guc: number,
  sekil = "",
) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uOlcek = { value: olcek };
    s.uniforms.uGuc = { value: guc };
    s.vertexShader = s.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\n varying vec3 vDunyaK;",
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
         vDunyaK = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`,
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vDunyaK;
         uniform float uOlcek;
         uniform float uGuc;
         float h31( vec3 p ) {
           p = fract( p * 0.3183099 + 0.1 );
           p *= 17.0;
           return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
         }
         float gur( vec3 x ) {
           vec3 i = floor( x ); vec3 f = fract( x );
           f = f * f * ( 3.0 - 2.0 * f );
           return mix( mix( mix( h31( i ), h31( i + vec3(1,0,0) ), f.x ),
                            mix( h31( i + vec3(0,1,0) ), h31( i + vec3(1,1,0) ), f.x ), f.y ),
                       mix( mix( h31( i + vec3(0,0,1) ), h31( i + vec3(1,0,1) ), f.x ),
                            mix( h31( i + vec3(0,1,1) ), h31( i + vec3(1,1,1) ), f.x ), f.y ), f.z );
         }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         {
           // İki oktav: geniş sıva dalgalanması + ince tane.
           float n = gur( vDunyaK * uOlcek ) * 0.62 + gur( vDunyaK * uOlcek * 4.3 ) * 0.38;
           diffuseColor.rgb *= 1.0 + ( n - 0.5 ) * uGuc;
           ${sekil}
         }`,
      );
  };
}

/*
 * Dip duvar: ışık havuzu ufuk olayının çevresinde toplanıyor.
 *
 * ÖLÇÜLDÜ, TAHMİN DEĞİL: ilk sürümde duvar kadrajın üst %59'unda ortada 222,
 * sol kenarda 206 okuyordu — bütün kadraj boyunca %7 oynama. Yani DÜZ AÇIK BİR
 * DİKDÖRTGEN; brief'in yasakladığı perde etkisi, sahne kılığında. Sebep havuz
 * gradyanının yokluğu değildi (gradyan vardı ve radyansı %45 düşürüyordu);
 * duvarın ACES omzunda oturmasıydı: 0.55→1.0 radyans aralığının tamamı 206-222
 * kod değerine eziliyordu. Modelleme yapılıyor, sonra ton eğrisi siliyordu.
 *
 * Çözüm havuzu YATAY BİR BANDA çevirmek + tabanı düşürmek:
 *   · x/82 → havuz kadrajın bütün genişliğinde açık kalıyor. Çizgi ve bulut
 *     kenarlara kadar aydınlık zemin buluyor (silüetler arkadan aydınlık;
 *     koyu duvarda kaybolurlardı).
 *   · (y-UFUK_Y)/13 → yukarı ve aşağı hızlı düşüş. Kadrajın tepesi (duvar y≈28)
 *     artık ~87, ufuk bandı ~225. 100 kod değerlik DİKEY gradyan: düz panel öldü.
 *   · taban 0.34 → 0.05. Eski taban duvarın en koyu yerini bile 177'de tutuyordu.
 *
 * Metin bandı bu havuzun ALTINDA, zeminde — havuz metnin arkasında değil,
 * olayın kendisini taşıyor.
 */
const DUVAR_SEKIL = /* glsl */ `
  vec2 d = vec2( ( vDunyaK.x ) / 82.0, ( vDunyaK.y - ${UFUK_Y.toFixed(1)} ) / 13.0 );
  float havuz = 1.0 - smoothstep( 0.25, 1.35, length( d ) );
  float temas = smoothstep( 0.0, 7.0, vDunyaK.y );   // zeminle birleşimde kararma
  diffuseColor.rgb *= ( 0.05 + 0.95 * havuz ) * ( 0.40 + 0.60 * temas );
`;

/* Zemin: duvardan sekmiş ışık birleşime yakın yeri hafifçe kaldırıyor, kameraya
   doğru düşüyor. Düz koyu bir dikdörtgen yerine derinliği olan bir yüzey.
   Taban 0.52 → 0.66: ölçümde kadrajın dibi rgb(5,42,48) okuyordu, paletin en
   koyu değeri olan #073F49 = rgb(7,63,73)'ün ALTINDA. Saf siyah değil ama palet
   dışı; metin de tam oraya oturuyor. */
const ZEMIN_SEKIL = /* glsl */ `
  float yakin = 1.0 - smoothstep( 0.0, 46.0, abs( vDunyaK.z - ( ${DUVAR_Z.toFixed(1)} ) ) );
  diffuseColor.rgb *= 0.82 + 0.18 * yakin;
`;

type Props = {
  /** Her karede disiplin başına 0..1 çözülme değeri. setState YOK — doğrudan DOM. */
  bildir?: (deger: number[]) => void;
  disiplinAdet: number;
  sinif?: string;
};

export function GolgeSahnesi({ bildir, disiplinAdet, sinif }: Props) {
  const kapRef = useRef<HTMLDivElement>(null);
  const bildirRef = useRef(bildir);
  bildirRef.current = bildir;

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const statik = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kaba = window.matchMedia("(pointer: coarse)").matches;

    // ---- taban: L0 = extrude ekseni, U/V ona dik --------------------------
    const eksen = new THREE.Vector3(L0[0], L0[1], L0[2]).normalize();
    const U = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), eksen)
      .normalize(); // ≈ yatay
    const V = new THREE.Vector3().crossVectors(eksen, U).normalize(); // ≈ dikey

    // Bant merkezi: gölgesi tam olarak (0, UFUK_Y, DUVAR_Z)'ye düşsün.
    // Merkezin gölgesi = merkez + D0·L0 olduğu için merkezi geri çözüyoruz.
    const bantMerkez = new THREE.Vector3(0, UFUK_Y, DUVAR_Z).addScaledVector(
      eksen,
      -D0,
    );

    // ---- sahne ------------------------------------------------------------
    const sahne = new THREE.Scene();
    sahne.background = new THREE.Color(SIS);
    // Hava perspektifi: duvar/zemin birleşimindeki jilet gibi hattı yumuşatıyor.
    // 0.01 → 0.008: sis three'de ton eşlemesinden SONRA, çıkış uzayında
    // karışıyor; 0.01'de duvarın tepesindeki koyuyu 57'den 101'e kaldırıp yeni
    // dikey gradyanın yarısını yiyordu. Karanlığı sis değil ışık geometrisi
    // belirlemeli.
    sahne.fog = new THREE.FogExp2(new THREE.Color(SIS).getHex(), 0.008);

    const kamera = new THREE.PerspectiveCamera(50, 1, 0.5, 260);
    kamera.position.copy(KAMERA);
    const yatayMesafe = Math.hypot(0 - KAMERA.x, DUVAR_Z - KAMERA.z);
    kamera.lookAt(
      0,
      KAMERA.y + Math.tan(THREE.MathUtils.degToRad(BAKIS_EGIM)) * yatayMesafe,
      DUVAR_Z,
    );
    const temelQ = kamera.quaternion.clone(); // parallaks yalnız konumu oynatır

    const cizer = new THREE.WebGLRenderer({
      antialias: !kaba,
      powerPreference: "high-performance",
    });
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, kaba ? 1.5 : 2));
    cizer.setSize(kap.clientWidth, kap.clientHeight);
    cizer.shadowMap.enabled = true;
    cizer.shadowMap.type = THREE.PCFSoftShadowMap;
    cizer.toneMapping = THREE.ACESFilmicToneMapping;
    cizer.toneMappingExposure = 0.95;
    kap.appendChild(cizer.domElement);

    // ---- ışık: TEK yönlü kaynak + tek gölge haritası -----------------------
    const isik = new THREE.DirectionalLight(new THREE.Color(ISIK), 3.1);
    isik.target.position.copy(bantMerkez);
    sahne.add(isik.target);
    isik.castShadow = true;
    // Bant 3x uzadı → aynı 2048 U ekseninde teksel başına 31mm'den 93mm'ye
    // düşerdi ve gu≈0.24'lük yongaların gölgesi 2-3 teksele inip kaos anında
    // bloklaşırdı. Masaüstünde 4096: 46mm/teksel. ÇİZGİNİN KALINLIĞI bundan
    // etkilenmiyor — o V ekseninde ve shadow.camera.up=V sayesinde ±11 birim
    // 2048/4096 teksele yayılıyor (~5mm). Asıl kazanç orada, burada değil.
    isik.shadow.mapSize.set(kaba ? 1024 : 4096, kaba ? 1024 : 4096);
    // Gölge kamerasının "up"ını V'ye çiviliyoruz → haritanın y ekseni bandın
    // KALINLIK ekseniyle hizalanıyor. Bant V'de ~1.6, U'da 44 olduğu için
    // kutuyu dikeyde dar tutmak tekselleri tam çizginin kenarına harcıyor:
    // 22/2048 ≈ 1cm. Kare bir kutu aynı hassasiyetin üçte birini verirdi.
    isik.shadow.camera.up.copy(V);
    const sk = isik.shadow.camera;
    // U: bant artık [-88,+46]; kaos anında gölgeler uçtan a*θ ≈ 5.2 taşıyor.
    // Hangi yerel eksenin +u'ya baktığına bel bağlamamak için simetrik ve
    // cömert: her iki uç da payla içeride kalıyor.
    sk.left = -95;
    sk.right = 95;
    sk.top = 11; // V = bandın KALINLIK ekseni — dar tutmak tekseli çizgiye harcar
    sk.bottom = -11;
    sk.near = 20;
    sk.far = 130;
    sk.updateProjectionMatrix();
    isik.shadow.bias = -0.0004;
    isik.shadow.normalBias = 0.015;
    sahne.add(isik);

    // Dolgu: parlak duvarın hacme geri verdiği ışık. Gölge YOK, bedeli sıfır.
    // Olmazsa parçaların altları saf siyaha düşerdi — palet dışı.
    sahne.add(
      new THREE.HemisphereLight(
        new THREE.Color(GOK_YANSIMA),
        new THREE.Color(YER_YANSIMA),
        0.85,
      ),
    );

    // ---- mekân: dip duvar + zemin + yan duvar ------------------------------
    const duvarGeo = new THREE.PlaneGeometry(SALON_X * 2, DUVAR_YUKSEK);
    const duvarMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(DUVAR),
      roughness: 0.96,
      metalness: 0,
    });
    grenEkle(duvarMat, 0.09, 0.13, DUVAR_SEKIL);
    const duvar = new THREE.Mesh(duvarGeo, duvarMat);
    duvar.position.set(0, DUVAR_YUKSEK / 2, DUVAR_Z);
    duvar.receiveShadow = true;
    sahne.add(duvar);

    const zeminGeo = new THREE.PlaneGeometry(SALON_X * 2, 160);
    const zeminMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(ZEMIN),
      roughness: 0.9,
      metalness: 0,
    });
    grenEkle(zeminMat, 0.07, 0.16, ZEMIN_SEKIL);
    const zemin = new THREE.Mesh(zeminGeo, zeminMat);
    zemin.rotation.x = -Math.PI / 2;
    zemin.position.set(0, 0, DUVAR_Z + 80);
    sahne.add(zemin);

    // Sağ duvar: ışığın geldiği yandan kadrajı kapatıyor, salona hacim veriyor.
    const yanGeo = new THREE.PlaneGeometry(160, DUVAR_YUKSEK);
    const yanMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(DUVAR),
      roughness: 0.96,
      metalness: 0,
    });
    grenEkle(yanMat, 0.09, 0.1);
    const yan = new THREE.Mesh(yanGeo, yanMat);
    yan.rotation.y = -Math.PI / 2;
    yan.position.set(YAN_DUVAR_X, DUVAR_YUKSEK / 2, DUVAR_Z + 80);
    sahne.add(yan);

    // ---- parçalar: tek InstancedMesh --------------------------------------
    // pointer:coarse → yonga sayısı düşüyor (brief'in zorunlu kapısı; ilk
    // sürümde yalnız antialias kapanıyordu, parça sayısı aynı kalıyordu).
    const liste = parcalar(disiplinAdet, kaba);
    const kutuGeo = new THREE.BoxGeometry(1, 1, 1);
    const parcaMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PARCA),
      roughness: 0.82,
      metalness: 0,
    });
    grenEkle(parcaMat, 0.5, 0.14);

    const parcaMesh = new THREE.InstancedMesh(kutuGeo, parcaMat, liste.length);
    parcaMesh.castShadow = true;
    parcaMesh.receiveShadow = false; // parçalar birbirine gölge düşürmüyor:
    // haritanın bütün çözünürlüğü ufka gitsin. Zaten hepsi arkadan aydınlık.

    // TEK ve ORTAK yönelim: kutu yerel z'si L0'a, x'i U'ya, y'si V'ye bakıyor.
    // Örneklere DÖNÜŞ VERİLMİYOR — dönüş kutunun L0'a dik kesitini değiştirir,
    // kesit değişince bandın kapsaması bozulur ve çözülme kırılır.
    const yonelim = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(U, V, eksen),
    );

    const g = new THREE.Object3D();
    const renk = new THREE.Color();
    const nane = new THREE.Color(0x43d6a8);
    const rnd = mulberry32(9182736);
    for (let i = 0; i < liste.length; i++) {
      const p = liste[i];
      g.position
        .copy(bantMerkez)
        .addScaledVector(U, p.u)
        .addScaledVector(V, p.v)
        .addScaledVector(eksen, p.a);
      g.quaternion.copy(yonelim);
      g.scale.set(p.gu, p.gv, p.boy);
      g.updateMatrix();
      parcaMesh.setMatrixAt(i, g.matrix);

      // Küme başına çok hafif ton kayması: yedi ses ayırt edilebilsin, ama
      // parçalar arkadan aydınlık siluetler olduğu için fark neredeyse bilinçaltı.
      //
      // DİKKAT: instanceColor materyalin rengiyle ÇARPILIR (diffuse =
      // material.color * instanceColor). İlk sürümde ikisi de dolu birer orta
      // teal'di; çarpımları parçaları neredeyse saf siyaha indiriyordu. Burası
      // bir renk değil, 1.0 çevresinde bir TON KAYMASI olmalı.
      const t = p.kume / Math.max(disiplinAdet - 1, 1);
      renk
        .setRGB(1, 1, 1)
        .lerp(nane, t * 0.22)
        .multiplyScalar(0.88 + rnd() * 0.24);
      parcaMesh.setColorAt(i, renk);
    }
    parcaMesh.instanceMatrix.needsUpdate = true;
    if (parcaMesh.instanceColor) parcaMesh.instanceColor.needsUpdate = true;
    parcaMesh.computeBoundingSphere();
    sahne.add(parcaMesh);

    // ---- ışığı yerleştir ---------------------------------------------------
    const anlikL = new THREE.Vector3();
    const qu = new THREE.Quaternion();
    const qv = new THREE.Quaternion();
    const isigiKur = (su: number, sv: number) => {
      // L0'ı U ve V etrafında döndür → L0'dan sapma. su=sv=0 iken TAM hizalanma.
      qu.setFromAxisAngle(U, sv);
      qv.setFromAxisAngle(V, su);
      anlikL.copy(eksen).applyQuaternion(qu).applyQuaternion(qv).normalize();
      isik.position.copy(bantMerkez).addScaledVector(anlikL, -ISIK_MESAFE);
    };

    // ---- fare parallaksı ---------------------------------------------------
    const fare = { x: 0, y: 0 };
    const hedef = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedef.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedef.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba) {
      window.addEventListener("pointermove", fareOynat, { passive: true });
    }

    // ---- döngü -------------------------------------------------------------
    let id = 0;
    let gorunur = false;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const kare = (t: number) => {
      const s = sapma(t);
      isigiKur(s.u, s.v);

      fare.x += (hedef.x - fare.x) * 0.04;
      fare.y += (hedef.y - fare.y) * 0.04;
      kamera.position.set(
        KAMERA.x + fare.x * 1.1,
        KAMERA.y - fare.y * 0.5 + Math.sin(t * 0.21) * 0.06,
        KAMERA.z,
      );
      kamera.quaternion.copy(temelQ); // lookAt yok → ufuk kadrajda çivili kalır

      cizer.render(sahne, kamera);
      bildirRef.current?.(cozulmeSerit(s.e, disiplinAdet));
    };

    const ciz = () => {
      kare(saat.getElapsedTime());
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

    // reduced-motion BASE katman: rAF hiç başlamaz. Tek kare, ve o kare
    // ÇÖZÜLMÜŞ an (e=0 → ışık tam L0'da) — hareket göremeyecek ziyaretçi
    // sahnenin tezini tek bakışta görsün diye.
    const tekKare = () => {
      isigiKur(0, 0);
      kamera.position.copy(KAMERA);
      kamera.quaternion.copy(temelQ);
      cizer.render(sahne, kamera);
      bildirRef.current?.(cozulmeSerit(0, disiplinAdet));
    };
    if (statik) tekKare();

    const io = new IntersectionObserver(
      ([e]) => {
        gorunur = e.isIntersecting;
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
      kamera.fov = cerceve(w / h);
      kamera.aspect = w / h;
      kamera.updateProjectionMatrix();
      cizer.setSize(w, h);
      if (statik) tekKare();
    };
    boyutla();
    const ro = new ResizeObserver(boyutla);
    ro.observe(kap);

    return () => {
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", fareOynat);
      duvarGeo.dispose();
      duvarMat.dispose();
      zeminGeo.dispose();
      zeminMat.dispose();
      yanGeo.dispose();
      yanMat.dispose();
      kutuGeo.dispose();
      parcaMat.dispose();
      parcaMesh.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, [disiplinAdet]);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

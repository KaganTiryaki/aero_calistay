"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { hucreGeo, hucreleriKur, kabukGeo, odaGeo } from "./mukarnas";

/*
 * MUKARNAS TAVANI — AERO'nun WebGL sahnesi.
 *
 * Kamera bir tonozun altında, hafifçe yukarı bakıyor. Beyaz sıvadan mukarnas
 * hücreleri tavanı ve karşı duvarın üstünü kaplıyor; ışık hücrelerin arasında
 * sıra sıra ilerleyen tek bir cephe olarak geziniyor. Hiçbir hücre ışığı
 * tutmuyor — geçer, gider. Sirkülasyon, halka olmadan.
 *
 * HARMAN: tonoz üst ~2/3'ü doldurur, alt bant düz süssüz sıvadır ve ışık
 * dalgası tanımı gereği yalnız hücrelerde yaşar → okuma bandına inemez.
 * Perde/scrim gradyanı YOK; kontrastı hücrelerin öz-gölgesi taşır.
 *
 * Zorunlu kapılar: DPR cap · IntersectionObserver · visibilitychange ·
 * prefers-reduced-motion'da rAF hiç başlamaz (tek statik kare) ·
 * pointer:coarse'da hücre sayısı düşer + antialias kapanır · tam dispose.
 */

const FOV = 56;
const GOZ = new THREE.Vector3(0, 1.55, 5.55);
const BAK = new THREE.Vector3(0, 3.62, -2.4);

export function MukarnasSahnesi({
  guclu,
  sinif,
}: {
  guclu: boolean;
  sinif: string;
}) {
  const kapRef = useRef<HTMLDivElement>(null);
  // Güç (CTA hover'ı) rAF'a ref ile girer: her değişimde sahne kurulmasın.
  const gucRef = useRef(guclu);
  gucRef.current = guclu;

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)");
    const kabaIsaret = window.matchMedia("(pointer: coarse)");
    const statik = azHareket.matches;
    const kaba = kabaIsaret.matches;

    const sahne = new THREE.Scene();
    sahne.background = new THREE.Color("#e8f6f8");

    const kamera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
    kamera.position.copy(GOZ);

    // WebGL bağlamı her zaman verilmez (çok sekmeli tarayıcıda bağlam limiti,
    // sürücü reddi...). Ham bırakılırsa efekt fırlar ve BÜTÜN sayfa boşalır.
    // Başarısızsa sessizce CSS sıva zeminine düş: metin okunur kalsın.
    let cizer: THREE.WebGLRenderer;
    try {
      cizer = new THREE.WebGLRenderer({
        antialias: !kaba,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap
    cizer.setSize(kap.clientWidth || 1, kap.clientHeight || 1);
    cizer.toneMapping = THREE.ACESFilmicToneMapping;
    // 1.14 + güçlü ışıklar tonozu düz beyaza yıkıyordu: hücreler oyulmuş taş
    // değil, havada uçuşan plastik pullar gibi okunuyordu. Pozu kısıp kontrastı
    // geometrinin öz-gölgesine bırakıyoruz.
    cizer.toneMappingExposure = 1.0;
    kap.appendChild(cizer.domElement);

    /* ---- Işık: mekânın kendi ışık kurgusu -------------------------------- */
    // Hemisphere'in "ground" rengi teal: aşağı bakan her yüz (sarkıtların
    // içbükey karnı, korniş altı) bedavaya teal gölge alır. Paletin tam
    // içinde kalan, sıfır maliyetli gölge rengi — gölge map'i yok.
    // Şiddet 2.05 → 1.25: hemisphere her yüzü eşit aydınlatıp öz-gölgeyi
    // siliyordu. Ground rengi de koyulaştı → sarkıtların karnı gerçekten çöksün.
    const gok = new THREE.HemisphereLight(0xf2fdff, 0x18595f, 1.25);
    sahne.add(gok);

    // Asıl ışık kameranın ARKASINDAKİ girişten, alçaktan gelir ve tonoza
    // YUKARI vurur. Sarkıtların aşağı bakan yüzleri ancak böyle aydınlanır;
    // tepeden gelen ışık onları kapkara bırakıyordu.
    // Yalayan açı: 2.55 dümdüz yıkıyordu. 1.6 + daha alçak konum → ışık
    // hücrelerin karnına TEĞET geçsin, her sarkıt kendi gölgesini düşürsün.
    const yon = new THREE.DirectionalLight(0xf8ffff, 1.6);
    yon.position.set(1.2, -2.6, 9.5);
    yon.target.position.set(0, 5.2, -1.8);
    sahne.add(yon, yon.target);

    const dolgu = new THREE.DirectionalLight(0xc9ecf4, 0.28);
    dolgu.position.set(-6, 9, 3);
    sahne.add(dolgu);

    // Girişin kendisi: mesafeyle sönümlendiği için karşı duvarın orta bandı
    // (metnin oturduğu kot) doğal olarak sahnenin en parlak yeri olur.
    // Duvar bandı okunur kalsın diye güçlü tutuluyor; tonoza mesafeden ötürü
    // zaten zar zor ulaşır → okuma bandı parlak, tavan derin.
    const giris = new THREE.PointLight(0xeafdff, 78, 0, 2);
    giris.position.set(0, 1.7, 7.2);
    sahne.add(giris);

    /* ---- Malzemeler ------------------------------------------------------ */
    const uT = { value: 0 };
    const uT2 = { value: 0 };
    const uYon = { value: new THREE.Vector3(0.52, 0.34, 0.79).normalize() };
    const uYon2 = { value: new THREE.Vector3(-0.86, 0.22, -0.46).normalize() };
    const uGuc = { value: 1 };
    const uGolge = { value: new THREE.Color("#0f4c4e") };
    // Dalga rengi ALBEDO'ya karışıyor (aşağıya bak) → doygun seçilmeli. Açık
    // cyan (#57d8f4) beyaz sıvanın üstünde beyaza clip'leyip hue'sunu
    // kaybediyordu: konsepti taşıyan renk renksiz bir lekeye dönüyordu.
    const uRenkA = { value: new THREE.Color("#22b8dc") };
    const uRenkB = { value: new THREE.Color("#43d6a8") };

    const sivaMat = new THREE.MeshStandardMaterial({
      color: "#f7feff",
      roughness: 0.93,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    sivaMat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = uT;
      sh.uniforms.uT2 = uT2;
      sh.uniforms.uYon = uYon;
      sh.uniforms.uYon2 = uYon2;
      sh.uniforms.uGuc = uGuc;
      sh.uniforms.uGolge = uGolge;
      sh.uniforms.uRenkA = uRenkA;
      sh.uniforms.uRenkB = uRenkB;
      sh.vertexShader = sh.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           attribute vec3 aPoz;
           attribute float aAO;
           varying vec3 vPoz;
           varying float vAO;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vPoz = aPoz;
           vAO = aAO;`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uT;
           uniform float uT2;
           uniform float uGuc;
           uniform vec3 uYon;
           uniform vec3 uYon2;
           uniform vec3 uGolge;
           uniform vec3 uRenkA;
           uniform vec3 uRenkB;
           varying vec3 vPoz;
           varying float vAO;`,
        )
        // Kademe indeksinden gelen ucuz AO: gölge map'i yok, maliyeti sıfır.
        // Işık göçü: faz PER HÜCRE sabit (aPoz instance merkezi) → hücre
        // bütün olarak yanar/söner. "Tek tek, sıra sıra" okuması buradan gelir.
        // Cephe bir DÜZLEM (dot) — halka değil.
        //
        // KRİTİK: dalga önce ALBEDO'yu boyar, sonra çok az emissive ekler.
        // Sadece emissive eklemek ACES altında beyaz sıvayı beyaza clip'liyor
        // ve dalga renksiz parlak bir lekeye dönüyordu. Albedo'ya karışan renk
        // clip'lenemez — beyazdan cyan'a KOYULAŞARAK gider, hue hep durur.
        // g1/g2 burada main() içinde tanımlanır, emissive aşamasında yeniden
        // kullanılır (color_fragment zincirde emissivemap'ten önce gelir).
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
           diffuseColor.rgb *= mix(uGolge, vec3(1.0), vAO);
           float d1 = dot(vPoz, uYon) - uT;
           float w1 = d1 < 0.0 ? 2.7 : 0.85;          // sert varış, uzun kuyruk
           float g1 = exp(-(d1 * d1) / (w1 * w1));
           float d2 = dot(vPoz, uYon2) - uT2;
           float w2 = d2 < 0.0 ? 3.6 : 1.5;
           float g2 = exp(-(d2 * d2) / (w2 * w2));
           float a1 = clamp(g1 * 0.92 * uGuc, 0.0, 0.94);
           float a2 = clamp(g2 * 0.40 * uGuc, 0.0, 0.46);
           diffuseColor.rgb = mix(diffuseColor.rgb, uRenkA, a1);
           diffuseColor.rgb = mix(diffuseColor.rgb, uRenkB, a2);`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
           float bakis = 0.38 + 0.62 * clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
           // g*g: parlama yalnız cephenin çekirdeğinde. Geniş yayılan glow
           // tonozu sisli beyaza boğuyordu.
           vec3 gocen = uRenkA * (g1 * g1 * 0.62) + uRenkB * (g2 * g2 * 0.20);
           totalEmissiveRadiance += gocen * bakis * (0.26 + 0.74 * vAO) * uGuc;`,
        );
    };

    // Hücre aralarındaki yarıklardan görünen yüzey. Hücrelerle AYNI parlaklıkta
    // olduğu için hücreler zemine yapışıyor, silueti kayboluyordu: sarkıtlar
    // oyulmuş taş değil, serpilmiş beyaz pullar gibi okunuyordu. Kabuk koyu =
    // yarıklar karanlık = her hücrenin kendi sınırı var.
    const kabukMat = new THREE.MeshStandardMaterial({
      color: "#b4d4d8",
      roughness: 0.96,
      metalness: 0,
      vertexColors: true,
      side: THREE.DoubleSide,
    });
    const odaMat = new THREE.MeshStandardMaterial({
      color: "#f7feff",
      roughness: 0.97,
      metalness: 0,
      vertexColors: true,
      side: THREE.DoubleSide,
    });

    /* ---- Geometri -------------------------------------------------------- */
    const oda = new THREE.Mesh(odaGeo(), odaMat);
    sahne.add(oda);

    const kabuk = new THREE.Mesh(kabukGeo(0.17, kaba ? 96 : 176, 32), kabukMat);
    sahne.add(kabuk);

    const { listeA, listeB } = hucreleriKur(kaba);
    // uç genişliği 0.1 → 0.46: iğne uçlu hücre komşusundan kopuyor, tavan dart
    // sürüsüne dönüyordu. Dolgun uç = yüzey sürekli = mimari.
    const geoA = hucreGeo(kaba ? 8 : 11, kaba ? 6 : 9, 0.28, 0.46);
    const geoB = hucreGeo(kaba ? 6 : 9, kaba ? 5 : 7, 0.34, 0.4);

    const merkez = new THREE.Vector3();
    let yaricap = 0;

    const kurMesh = (
      geo: THREE.BufferGeometry,
      liste: ReturnType<typeof hucreleriKur>["listeA"],
    ) => {
      const n = liste.length;
      const aPoz = new Float32Array(n * 3);
      const aAO = new Float32Array(n);
      const mesh = new THREE.InstancedMesh(geo, sivaMat, n);
      liste.forEach((h, i) => {
        mesh.setMatrixAt(i, h.m);
        h.poz.toArray(aPoz, i * 3);
        aAO[i] = h.ao;
      });
      geo.setAttribute("aPoz", new THREE.InstancedBufferAttribute(aPoz, 3));
      geo.setAttribute("aAO", new THREE.InstancedBufferAttribute(aAO, 1));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      sahne.add(mesh);
      return mesh;
    };
    const meshA = kurMesh(geoA, listeA);
    const meshB = kurMesh(geoB, listeB);

    // Dalganın süpürme aralığı: hücre bulutunun küresi. Yön değişse de
    // aralık geçerli kalsın diye merkez + yarıçap ile hesaplanıyor.
    const hepsi = [...listeA, ...listeB];
    hepsi.forEach((h) => merkez.add(h.poz));
    merkez.divideScalar(hepsi.length);
    hepsi.forEach((h) => {
      yaricap = Math.max(yaricap, h.poz.distanceTo(merkez));
    });

    /* ---- Kompozisyon: her en/boy oranında tonoz üstte, sıva altta -------- */
    // En/boy oranına göre düzeltilmiş kamera tabanı. rAF döngüsü de BUNU
    // kullanır: ham GOZ/BAK'a dönerse portre düzeltmesi her karede silinir.
    const goz = GOZ.clone();
    const bak = BAK.clone();

    const boyutla = () => {
      const w = kap.clientWidth;
      const h = kap.clientHeight;
      if (!w || !h) return;
      const en = w / h;
      // Dar ekranda dikey FOV'u aç: yatay kadraj çökmesin, tonoz+bant korunsun.
      const f = en >= 1.6 ? FOV : Math.min(76, (FOV * 1.6) / Math.max(en, 0.42));
      kamera.fov = f;
      kamera.aspect = en;
      // Portrede kamerayı azıcık geri çek ve bakışı indir. Ölçüldü: korniş
      // yatayda %56.9, portrede %50.9'a oturuyor — UI bandı (%60 / %55) hep
      // altında kalıyor.
      const dar = THREE.MathUtils.clamp((1.6 - en) / 1.0, 0, 1);
      goz.set(GOZ.x, GOZ.y - dar * 0.1, GOZ.z + dar * 0.42);
      bak.set(BAK.x, BAK.y - dar * 0.5, BAK.z);
      kamera.position.copy(goz);
      kamera.lookAt(bak);
      kamera.updateProjectionMatrix();
      cizer.setSize(w, h);
      if (statik) cizer.render(sahne, kamera);
    };
    boyutla();

    /* ---- Fare parallax: yalnız ince işaretçide --------------------------- */
    const fare = { x: 0, y: 0 };
    const hedef = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedef.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedef.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba)
      window.addEventListener("pointermove", fareOynat, { passive: true });

    /* ---- Döngü ----------------------------------------------------------- */
    const HIZ = 3.6;
    const menzil = yaricap * 2 + 7;
    let id = 0;
    let gorunur = true;
    let calisiyor = false;
    const saat = new THREE.Clock();
    const yonHedef = new THREE.Vector3();

    const dalgaYaz = (t: number) => {
      // Yön çok yavaş sallanır: aynı süpürme iki kez birebir tekrar etmesin.
      yonHedef
        .set(0.52 + Math.sin(t * 0.07) * 0.26, 0.34, 0.79)
        .normalize();
      uYon.value.lerp(yonHedef, 0.02).normalize();
      const c1 = merkez.dot(uYon.value);
      uT.value = c1 - yaricap - 3.5 + (((t * HIZ) % menzil) + menzil) % menzil;
      const c2 = merkez.dot(uYon2.value);
      uT2.value =
        c2 - yaricap - 3.5 + ((((t + 3.1) * HIZ * 0.62) % menzil) + menzil) % menzil;
    };

    const ciz = () => {
      const dt = Math.min(saat.getDelta(), 0.05);
      const t = saat.elapsedTime;
      dalgaYaz(t);
      uGuc.value = THREE.MathUtils.lerp(
        uGuc.value,
        gucRef.current ? 1.75 : 1,
        0.07 * dt * 60,
      );

      fare.x = THREE.MathUtils.lerp(fare.x, hedef.x, 0.035 * dt * 60);
      fare.y = THREE.MathUtils.lerp(fare.y, hedef.y, 0.035 * dt * 60);
      // Kamera nefes alır + fareye çok az yaslanır. Kompozisyon merkezî kalır.
      //
      // ÖLÇÜLDÜ: eski katsayılar (0.34/0.18/0.5/0.42) fare sol-üste gidince
      // kornişi %64.5'e indiriyordu — yani UI bandının (%60) ALTINA. Nav ve
      // başlık tonozun üstüne biniyordu: tasarımın tek kuralı ("metin sıvada,
      // tonoz üstte") fareyle kırılıyordu. Statik kadrajda görünmüyor, ancak
      // gezinirken ortaya çıkıyor. Katsayılar en kötü hâli %61.3'te tutuyor,
      // --bant %63 → gerçek pay var.
      kamera.position.x = goz.x + fare.x * 0.16;
      kamera.position.y = goz.y - fare.y * 0.06 + Math.sin(t * 0.32) * 0.035;
      kamera.lookAt(bak.x - fare.x * 0.2, bak.y - fare.y * 0.12, bak.z);

      cizer.render(sahne, kamera);
      id = requestAnimationFrame(ciz);
    };

    const basla = () => {
      if (calisiyor || statik) return;
      calisiyor = true;
      saat.getDelta();
      id = requestAnimationFrame(ciz);
    };
    const dur = () => {
      calisiyor = false;
      cancelAnimationFrame(id);
    };

    // reduced-motion BASE katman: rAF hiç başlamaz, tek kare. Dalga donmuş bir
    // cephe olarak tonozda durur — sahne yine "tam", sadece sessiz.
    if (statik) {
      dalgaYaz(1.9);
      cizer.render(sahne, kamera);
    }

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

    // Bağlam kaybında rAF boşuna dönmesin (tarayıcı bağlam limitine dayandığında
    // en eski bağlamı geri alır — sahne sessizce durur, sayfa çökmez).
    const kayip = (e: Event) => {
      e.preventDefault();
      dur();
    };
    cizer.domElement.addEventListener("webglcontextlost", kayip);

    return () => {
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", fareOynat);
      cizer.domElement.removeEventListener("webglcontextlost", kayip);
      [oda.geometry, kabuk.geometry, geoA, geoB].forEach((g) => g.dispose());
      [sivaMat, kabukMat, odaMat].forEach((m) => m.dispose());
      meshA.dispose();
      meshB.dispose();
      cizer.dispose();
      // dispose() bağlamı bırakmaz; bırakılmazsa sekme sekme birikip
      // tarayıcının WebGL bağlam limitini yer.
      cizer.forceContextLoss();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

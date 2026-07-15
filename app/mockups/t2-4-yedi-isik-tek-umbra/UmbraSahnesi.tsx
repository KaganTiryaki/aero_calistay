"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  DUSME,
  ISIK_DUZENI,
  KAMERA,
  KUTLE_DONUS,
  KUTLE_MERKEZ,
  KUTLE_YARICAP,
  NEFES,
  ORTAK_GLSL,
  PALET,
  PARCALAR,
  SALON,
  SIS,
  VURGU,
} from "./sahne";

/*
 * YEDİ IŞIK, TEK UMBRA — three.js sahnesi.
 *
 * Mekân (kazanan register: MİMARİ İÇ MEKÂN — iki düzlem değil, hacim):
 *   zemin + iki yan duvar + arka duvar + her duvarda 8 paye. Payeler z boyunca
 *   tekrarlayan dikey vuruşlar: perspektifi ve ölçeği taşıyan şey onlar.
 *   Tavan yok — üst taraf sisin içinde eriyor, salonun yüksekliği belirsiz.
 *
 * Işık: gerçek 7 nokta ışık. Zemine ve duvarlara düşen gölge, kütlenin SDF'ine
 * karşı ışık başına IQ yumuşak gölge march'ıyla hesaplanıyor (bkz. sahne.ts).
 * Sınır küresi kapısı sayesinde bedeli yalnız yarı-gölgedeki pikseller ödüyor.
 */

const gecici = new THREE.Object3D();
const geciciMat3 = new THREE.Matrix3();

/** Deterministik gürültü — her yüklemede aynı kadraj, aynı taş. */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** CPU değer gürültüsü — kütle parçalarını yontmak için. */
function gurultu(x: number, y: number, z: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Kadraj. Dar ekranda dikey FOV açılır ama kamera aynı zamanda geri çekilir:
 * yelpazenin açısı ve umbranın kadrajdaki payı en-boydan bağımsız kalır.
 */
function cerceve(aspect: number) {
  const yatayYari = Math.tan(THREE.MathUtils.degToRad(45));
  const fov = THREE.MathUtils.clamp(
    THREE.MathUtils.radToDeg(2 * Math.atan(yatayYari / Math.max(aspect, 0.3))),
    52,
    74,
  );
  // Dikey FOV büyüdükçe kamera yaklaşabilir; küçüldükçe geri çekilmeli ki
  // kütle kadrajın üstünden taşmasın.
  const geri = THREE.MathUtils.clamp(62 / fov, 0.86, 1.28);
  return { fov, kameraZ: KAMERA.z * geri, kameraY: KAMERA.y * (0.9 + geri * 0.1) };
}

/** Arka plan: sisin ufuk rengiyle aynı — geometri bitse de dikiş görünmez. */
function arkaPlanDokusu() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, PALET.sisUzak);
  // Ara durak sisUzak'ı İZLEMEK ZORUNDA: sabit kalırsa sisin ufuk rengiyle
  // arka plan ayrışır ve geometrinin bittiği yerde dikiş görünür.
  g.addColorStop(0.55, "#6fc3d8");
  g.addColorStop(1, PALET.sisYakin);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Işık halesi: additive radyal gradyan. Sisin içinden okunsun diye. */
function haleDokusu() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.16, "rgba(255,255,255,0.55)");
  g.addColorStop(0.44, "rgba(255,255,255,0.13)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

type Props = {
  sinif?: string;
  /** Hover'daki disiplinin indeksi (-1 = yok). setState YOK: her karede okunuyor. */
  vurguRef: { current: number };
  /** Her karede ışık başına 0..1 şiddet. DOM'a doğrudan yazılıyor. */
  bildir?: (guc: number[]) => void;
};

export function UmbraSahnesi({ sinif, vurguRef, bildir }: Props) {
  const kapRef = useRef<HTMLDivElement>(null);
  const bildirRef = useRef(bildir);
  bildirRef.current = bildir;

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const statik = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kaba = window.matchMedia("(pointer: coarse)").matches;

    // Dokunmatikte march adımı düşüyor: 18 → 10. Yarı-gölge biraz kabalaşır
    // ama yelpazenin okuması aynı kalır (yumuşak gradyan zaten alçak frekans).
    const ADIM = kaba ? 10 : 18;

    const sahne = new THREE.Scene();
    const arkaPlan = arkaPlanDokusu();
    sahne.background = arkaPlan ?? new THREE.Color(PALET.sisYakin);

    const k0 = cerceve(Math.max(kap.clientWidth, 1) / Math.max(kap.clientHeight, 1));
    const kamera = new THREE.PerspectiveCamera(k0.fov, 1, 0.1, 200);
    kamera.position.set(0, k0.kameraY, k0.kameraZ);
    // lookAt yok: eğim sabit → ufuk çizgisi kadrajda çivili kalır, fare
    // parallaksı yalnız konumu oynatır. Umbra metnin altından kaymaz.
    kamera.rotation.set(THREE.MathUtils.degToRad(KAMERA.egimDer), 0, 0);

    const cizer = new THREE.WebGLRenderer({
      antialias: !kaba,
      powerPreference: "high-performance",
    });
    // DPR tavanı 1.5 (dokunmatikte 1): march başına maliyet piksel sayısıyla
    // doğrudan ölçekleniyor, burası ilk fren.
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, kaba ? 1 : 1.5));
    cizer.setSize(kap.clientWidth, kap.clientHeight);
    kap.appendChild(cizer.domElement);

    // ---- ışık uniformları --------------------------------------------------
    const isikPos = ISIK_DUZENI.map((d) => new THREE.Vector3(...d.pos));
    const isikRenk = ISIK_DUZENI.map((d) => new THREE.Color(d.tint));
    const isikGuc = ISIK_DUZENI.map((d) => d.guc);
    const isikYaricap = ISIK_DUZENI.map((d) => d.yaricap);

    // ---- kırık kütle: SDF ile MESH aynı tanımdan doğuyor -------------------
    // Parça merkezleri/dönüşleri her karede meshlerin dünya matrisinden
    // okunuyor → gölge ile cisim asla ayrışmaz.
    const parcaMerkez = PARCALAR.map(() => new THREE.Vector3());
    const parcaTers = PARCALAR.map(() => new THREE.Matrix3());
    const parcaBoy = PARCALAR.map((p) => new THREE.Vector3(...p.boy));
    const kutleMerkez = new THREE.Vector3(...KUTLE_MERKEZ);

    const ortakUniform = () => ({
      uIsikPos: { value: isikPos },
      uIsikRenk: { value: isikRenk },
      uIsikGuc: { value: isikGuc },
      uIsikYaricap: { value: isikYaricap },
      uParcaMerkez: { value: parcaMerkez },
      uParcaBoy: { value: parcaBoy },
      uParcaTers: { value: parcaTers },
      uKutleMerkez: { value: kutleMerkez },
      uKutleYaricap: { value: KUTLE_YARICAP },
      uOrtam: { value: new THREE.Color(PALET.ortam) },
      uDusme: { value: DUSME },
      uSisYakin: { value: new THREE.Color(PALET.sisYakin) },
      uSisUzak: { value: new THREE.Color(PALET.sisUzak) },
      uSisYogunluk: { value: SIS.yogunluk },
      uSisDusme: { value: SIS.dusme },
    });

    const tanimlar = { ADIM, ISIK: ISIK_DUZENI.length, PARCA: PARCALAR.length };

    const ortakVertex = /* glsl */ `
      varying vec3 vN;
      varying vec3 vDunya;
      void main() {
        vec4 dunya = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vDunya = dunya.xyz;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * dunya;
      }
    `;

    // ---- SALON materyali: zemin + duvarlar + payeler ----------------------
    // Tek materyal, tek shader. Yüzeyin cinsini NORMAL söylüyor:
    // |N.y| büyükse zemin (büyük levhalar), değilse duvar (yatay taş sıraları).
    const salonMat = new THREE.ShaderMaterial({
      defines: { ...tanimlar },
      uniforms: { ...ortakUniform(), uKayma: { value: 0.05 }, uTas: { value: new THREE.Color(PALET.tas) } },
      vertexShader: ortakVertex,
      fragmentShader: /* glsl */ `
        uniform vec3 uTas;
        varying vec3 vN;
        varying vec3 vDunya;
        ${ORTAK_GLSL}

        void main() {
          vec3 N = normalize(vN);
          vec3 P = vDunya;

          // --- taş: derz + yıpranma. Doku dosyası yok, hepsi burada üretiliyor.
          float zemin = step(0.5, abs(N.y));
          // Zemin: 4 birimlik büyük levhalar. Duvar/paye: 1.15 birimlik yatay sıra.
          vec2 dg = mix(vec2(P.y * 0.87, P.x + P.z), vec2(P.x, P.z) * 0.25, zemin);
          vec2 hucre = fract(dg);
          vec2 kenar = min(hucre, 1.0 - hucre);
          float derz = smoothstep(0.0, 0.022, min(kenar.x, kenar.y));

          // Derz kontrastı düşük tutuluyor: ilk render'da zemin ızgarası fazla
          // düzenli ve keskindi, mimari döşeme değil "tech grid" gibi okuyordu.
          float leke = gurultu3(P * 0.42) * 0.6 + gurultu3(P * 1.7) * 0.28 + gurultu3(P * 6.5) * 0.12;
          vec3 albedo = uTas * (0.84 + leke * 0.3) * mix(0.88, 1.0, derz);

          vec3 col = albedo * isikla(P, N);
          col = omuz(col);
          col = sisle(col, P);

          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });

    // ---- KÜTLE materyali --------------------------------------------------
    // Kendi kendini de gölgeliyor (uKayma büyük): çatlaklar okusun diye.
    const kutleMat = new THREE.ShaderMaterial({
      defines: { ...tanimlar },
      uniforms: {
        ...ortakUniform(),
        uKayma: { value: 0.16 },
        uTas: { value: new THREE.Color(PALET.kutle) },
        // Zeminden AYRI ortam: bkz. PALET.kutleOrtam. ortakUniform() her materyale
        // kendi Color'ını verdiği için burada güvenle ezilebiliyor.
        uOrtam: { value: new THREE.Color(PALET.kutleOrtam) },
      },
      vertexShader: ortakVertex,
      fragmentShader: /* glsl */ `
        uniform vec3 uTas;
        varying vec3 vN;
        varying vec3 vDunya;
        ${ORTAK_GLSL}

        void main() {
          vec3 N = normalize(vN);
          vec3 P = vDunya;
          vec3 V = normalize(cameraPosition - P);

          float leke = gurultu3(P * 1.1) * 0.55 + gurultu3(P * 4.3) * 0.3 + gurultu3(P * 13.0) * 0.15;
          vec3 albedo = uTas * (0.8 + leke * 0.36);

          vec3 col = albedo * isikla(P, N);

          // Yedi ışığın HEPSİ kütlenin arkasında: kameraya bakan yüzlerin ndl'si
          // zaten negatif. Yani biçimi taşıyan şey difüz değil, şu iki terim —
          // yoksa kütle düz gri bir kalıp gibi okuyor (ilk render'da öyle oldu).
          //
          // 1) Zemin sekmesi: hemen altındaki zemin yelpazenin en aydınlık yeri,
          //    ışığı geri veriyor. Kütlenin ALT yüzleri bu yüzden aydınlanıyor —
          //    ters aydınlatma, kırık yüzeyleri okutan asıl şey.
          float alt = clamp(-N.y, 0.0, 1.0);
          col += vec3(0.13, 0.45, 0.50) * alt * 0.6;

          // 2) Rim: arkadan gelen yedi ışığın kenarlarda yakaladığı ince hat.
          //    Cismi sisin önünde SİLÜET olarak kesip çıkaran şey bu.
          //    (0.42,0.86,0.98)*1.15 kenarları BEYAZA patlatıyordu: kütlenin üst
          //    kenarları renksiz bir çizgiye dönüyor, gri okumayı besliyordu.
          //    Daha cyan + biraz kısık → kenar hâlâ kesiyor ama palette kalıyor.
          float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.2);
          col += vec3(0.24, 0.80, 0.98) * rim * 0.98;

          col = omuz(col);
          col = sisle(col, P);

          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });

    const atilacak: { dispose(): void }[] = [salonMat, kutleMat];
    if (arkaPlan) atilacak.push(arkaPlan);

    // ---- mekân geometrisi: zemin, duvarlar, payeler -----------------------
    // Hepsi tek InstancedMesh'te toplanamaz (ölçüler farklı) → iki instanced
    // mesh: büyük düzlemler ve payeler. instanceMatrix vertex shader'da zorunlu
    // olduğu için düzlemler de instanced.
    const yuzey = new THREE.PlaneGeometry(1, 1);
    const yuzeyler = new THREE.InstancedMesh(yuzey, salonMat, 5);
    const kur = (
      i: number,
      p: [number, number, number],
      r: [number, number, number],
      s: [number, number],
    ) => {
      gecici.position.set(...p);
      gecici.rotation.set(...r);
      gecici.scale.set(s[0], s[1], 1);
      gecici.updateMatrix();
      yuzeyler.setMatrixAt(i, gecici.matrix);
    };
    const derinlik = SALON.onZ - SALON.arkaZ;
    const merkezZ = (SALON.onZ + SALON.arkaZ) / 2;
    // zemin
    kur(0, [0, 0, merkezZ], [-Math.PI / 2, 0, 0], [SALON.duvarX * 2 + 8, derinlik + 20]);
    // sol duvar (içe bakıyor)
    kur(1, [-SALON.duvarX, SALON.duvarY / 2, merkezZ], [0, Math.PI / 2, 0], [derinlik, SALON.duvarY]);
    // sağ duvar
    kur(2, [SALON.duvarX, SALON.duvarY / 2, merkezZ], [0, -Math.PI / 2, 0], [derinlik, SALON.duvarY]);
    // arka duvar — sisin içinde tamamen eriyor, dikişi kapatıyor
    kur(3, [0, SALON.duvarY / 2, SALON.arkaZ], [0, 0, 0], [SALON.duvarX * 2, SALON.duvarY]);
    // tavan (normali aşağı bakıyor) — salonu kapatıyor, lambalar ondan asılıyor
    kur(4, [0, SALON.duvarY, merkezZ], [Math.PI / 2, 0, 0], [SALON.duvarX * 2, derinlik + 20]);
    yuzeyler.instanceMatrix.needsUpdate = true;
    yuzeyler.frustumCulled = false;
    sahne.add(yuzeyler);
    atilacak.push(yuzey);

    // Payeler: z boyunca tekrarlayan dikey vuruşlar. Mekânın derinliğini ve
    // ölçeğini taşıyan asıl unsur — düz duvar OLAYSIZ kalırdı.
    const ayakGeo = new THREE.BoxGeometry(1.3, SALON.duvarY, 2.2);
    const ayaklar = new THREE.InstancedMesh(ayakGeo, salonMat, SALON.ayakSayi * 2);
    let n = 0;
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < SALON.ayakSayi; i++) {
        gecici.position.set(
          s * (SALON.duvarX - 0.65),
          SALON.duvarY / 2,
          SALON.ayakIlk - i * SALON.ayakAra,
        );
        gecici.rotation.set(0, 0, 0);
        gecici.scale.setScalar(1);
        gecici.updateMatrix();
        ayaklar.setMatrixAt(n++, gecici.matrix);
      }
    }
    ayaklar.instanceMatrix.needsUpdate = true;
    ayaklar.frustumCulled = false;
    sahne.add(ayaklar);
    atilacak.push(ayakGeo);

    // ---- kırık kütle: mesh ------------------------------------------------
    // Her parça = yontulmuş kutu. Köşeler konum tabanlı gürültüyle kaydırılıyor
    // (normal tabanlı DEĞİL: dikişteki kopya köşeler aynı konumda olduğu için
    // aynı kaymayı alır → kutu açılmaz, sadece yontulur).
    const rnd = mulberry32(20260715);
    const parcaGeolar = PARCALAR.map((p) => {
      const g = new THREE.BoxGeometry(p.boy[0] * 2, p.boy[1] * 2, p.boy[2] * 2, 5, 5, 5);
      const konum = g.attributes.position as THREE.BufferAttribute;
      const tohum = rnd() * 40;
      for (let i = 0; i < konum.count; i++) {
        const x = konum.getX(i);
        const y = konum.getY(i);
        const z = konum.getZ(i);
        // Yontma payı: 0.075 fazla utangaçtı, parçalar "küp" gibi okuyordu.
        // Konum tabanlı (normal tabanlı DEĞİL): dikişteki kopya köşeler aynı
        // konumda olduğu için aynı kaymayı alır → kutu açılmaz, kırılır.
        const a = 0.26;
        konum.setXYZ(
          i,
          x + (gurultu(x * 1.9 + tohum, y * 1.7, z * 2.1) - 0.5) * a,
          y + (gurultu(x * 2.3, y * 1.6 + tohum, z * 1.8) - 0.5) * a,
          z + (gurultu(x * 1.7, y * 2.2, z * 1.5 + tohum) - 0.5) * a,
        );
      }
      konum.needsUpdate = true;
      g.computeVertexNormals();
      return g;
    });

    const kutleGrup = new THREE.Group();
    kutleGrup.position.set(...KUTLE_MERKEZ);
    sahne.add(kutleGrup);

    const parcaMeshler = PARCALAR.map((p, i) => {
      const m = new THREE.InstancedMesh(parcaGeolar[i], kutleMat, 1);
      m.setMatrixAt(0, new THREE.Matrix4());
      m.instanceMatrix.needsUpdate = true;
      m.position.set(...p.pos);
      m.rotation.set(...p.rot);
      m.frustumCulled = false;
      kutleGrup.add(m);
      return m;
    });
    parcaGeolar.forEach((g) => atilacak.push(g));

    // Askılar: kütle de lambalar da TAVANDAN sarkıyor. Bunlar olmadan hepsi
    // havada duran nesneler gibi okuyordu; ince dikeyler hem "asılı" fiilini
    // hem de salonun yüksekliğini anlatıyor.
    const halatGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 6, 1, true);
    const askilar = new THREE.InstancedMesh(halatGeo, salonMat, 2 + ISIK_DUZENI.length);
    const asi = (i: number, x: number, z: number, altY: number) => {
      const boy = SALON.duvarY - altY;
      gecici.position.set(x, altY + boy / 2, z);
      gecici.rotation.set(0, 0, 0);
      gecici.scale.set(1, boy, 1);
      gecici.updateMatrix();
      askilar.setMatrixAt(i, gecici.matrix);
    };
    asi(0, -1.6, KUTLE_MERKEZ[2] - 0.4, KUTLE_MERKEZ[1] + 1.6);
    asi(1, 2.2, KUTLE_MERKEZ[2] + 0.5, KUTLE_MERKEZ[1] + 1.6);
    ISIK_DUZENI.forEach((d, i) => asi(2 + i, d.pos[0], d.pos[2], d.pos[1]));
    askilar.instanceMatrix.needsUpdate = true;
    askilar.frustumCulled = false;
    sahne.add(askilar);
    atilacak.push(halatGeo);

    // ---- ışık plakaları + haleler -----------------------------------------
    const haleDoku = haleDokusu();
    if (haleDoku) atilacak.push(haleDoku);

    const plakaMatlar: THREE.MeshBasicMaterial[] = [];
    const haleler: THREE.Sprite[] = [];
    ISIK_DUZENI.forEach((d, i) => {
      const g = new THREE.BoxGeometry(d.plaka[0], d.plaka[1], d.plaka[2]);
      const m = new THREE.MeshBasicMaterial({ color: isikRenk[i].clone(), toneMapped: false });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.copy(isikPos[i]);
      mesh.rotation.set((rnd() - 0.5) * 0.3, rnd() * Math.PI, (rnd() - 0.5) * 0.3);
      sahne.add(mesh);
      plakaMatlar.push(m);
      atilacak.push(g, m);

      if (haleDoku) {
        const sm = new THREE.SpriteMaterial({
          map: haleDoku,
          color: isikRenk[i].clone(),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          toneMapped: false,
        });
        const s = new THREE.Sprite(sm);
        s.position.copy(isikPos[i]);
        s.scale.setScalar(6.5 + d.yaricap * 4);
        sahne.add(s);
        haleler.push(s);
        atilacak.push(sm);
      }
    });

    // ---- her karede güncellenen durum -------------------------------------
    const anlikGuc = ISIK_DUZENI.map((d) => d.guc);
    const anlikYaricap = ISIK_DUZENI.map((d) => d.yaricap);
    const hedefGuc = anlikGuc.slice();
    const hedefYaricap = anlikYaricap.slice();
    const enBuyukGuc = Math.max(...ISIK_DUZENI.map((d) => d.guc)) * VURGU.gucCarpan;

    const parcaGuncelle = () => {
      for (let i = 0; i < parcaMeshler.length; i++) {
        const m = parcaMeshler[i];
        m.updateWorldMatrix(true, false);
        parcaMerkez[i].setFromMatrixPosition(m.matrixWorld);
        // Dünya→parça: dönüşün tersi = transpozu (ölçek yok, saf dönüş).
        geciciMat3.setFromMatrix4(m.matrixWorld);
        parcaTers[i].copy(geciciMat3).transpose();
      }
      kutleMerkez.setFromMatrixPosition(kutleGrup.matrixWorld);
    };
    kutleGrup.updateWorldMatrix(true, true);
    parcaGuncelle();

    const fare = { x: 0, y: 0 };
    const hedefFare = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedefFare.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedefFare.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba) window.addEventListener("pointermove", fareOynat, { passive: true });

    const isikGonder = () => {
      bildirRef.current?.(anlikGuc.map((g) => THREE.MathUtils.clamp(g / enBuyukGuc, 0, 1)));
    };

    let id = 0;
    let gorunur = false;
    let calisiyor = false;
    const saat = new THREE.Clock();
    let temelY = k0.kameraY;

    const ciz = () => {
      const t = saat.getElapsedTime();
      const v = vurguRef.current;

      // NEFES: her ışığın şiddeti kendi hızında salınıyor. Ortak kat yok →
      // yelpaze asla aynı hâle dönmüyor, umbra çekirdeği daralıp genişliyor.
      for (let i = 0; i < ISIK_DUZENI.length; i++) {
        const d = ISIK_DUZENI[i];
        const nefes = 1 + Math.sin(t * d.hiz * Math.PI * 2 + d.faz) * NEFES;
        const vurgulu = v === i;
        hedefGuc[i] = d.guc * nefes * (vurgulu ? VURGU.gucCarpan : v >= 0 ? 0.62 : 1);
        hedefYaricap[i] = d.yaricap * (vurgulu ? VURGU.yaricapCarpan : 1);
        anlikGuc[i] += (hedefGuc[i] - anlikGuc[i]) * 0.06;
        anlikYaricap[i] += (hedefYaricap[i] - anlikYaricap[i]) * 0.06;
        isikGuc[i] = anlikGuc[i];
        isikYaricap[i] = anlikYaricap[i];
        plakaMatlar[i].color.copy(isikRenk[i]).multiplyScalar(0.5 + (anlikGuc[i] / d.guc) * 0.75);
        if (haleler[i]) haleler[i].material.opacity = 0.22 + (anlikGuc[i] / d.guc) * 0.4;
      }

      kutleGrup.rotation.y = t * KUTLE_DONUS;
      kutleGrup.updateWorldMatrix(true, true);
      parcaGuncelle();

      fare.x += (hedefFare.x - fare.x) * 0.04;
      fare.y += (hedefFare.y - fare.y) * 0.04;
      kamera.position.x = fare.x * 0.9;
      kamera.position.y = temelY - fare.y * 0.4 + Math.sin(t * 0.23) * 0.05;

      cizer.render(sahne, kamera);
      isikGonder();
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

    // reduced-motion BASE katman: rAF hiç başlamıyor. Tek statik kare —
    // yelpaze donmuş, umbra yerinde, metin yine okunuyor.
    const tekKare = () => {
      cizer.render(sahne, kamera);
      isikGonder();
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
      kamera.fov = k.fov;
      kamera.aspect = w / h;
      kamera.position.z = k.kameraZ;
      temelY = k.kameraY;
      kamera.position.y = temelY;
      kamera.updateProjectionMatrix();
      cizer.setSize(w, h);
      if (statik) tekKare();
    };
    boyutla();
    const ro = new ResizeObserver(boyutla);
    ro.observe(kap);

    // İLK KARE HER KOŞULDA çizilir — döngü kapılarından bağımsız.
    // Aksi hâlde sayfa arka planda/örtülüyken yüklenirse (document.hidden ya da
    // IO henüz ateşlememişken) rAF hiç başlamıyor ve tuval BOŞ kalıyor: kullanıcı
    // sahne yerine .kok'un düz CSS zeminini görüyor. Gerçekten yaşandı — sekme
    // önplana gelene kadar sahne hiç boyanmadı. Kapılar HAREKETİ yönetmeli,
    // sahnenin var olup olmamasını değil.
    tekKare();

    return () => {
      dur();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("pointermove", fareOynat);
      atilacak.forEach((o) => o.dispose());
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, [vurguRef]);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

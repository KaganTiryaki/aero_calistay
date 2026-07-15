"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  AVLU_X,
  AVLU_Z,
  BAKIS,
  FENER,
  GALERI_Y,
  KAMERA,
  KORKULUK_KAL,
  KORKULUK_Y,
  PALET,
  SACAK_Y,
  TASMA,
  U_AYAK,
  UST_BOY,
  U_TEPE,
  Z_AYAK,
  Z_TEPE,
  ZEMIN_BOY,
  arkaPlanDokusu,
  etiketNoktalari,
  gozGeometrisi,
  gozListesi,
  hanDalgasi,
  kutuUV,
  oyukGeometrisi,
  tasDokulari,
} from "./han";
import { tasMalzemesi } from "./malzeme";

/*
 * HAN AVLUSU
 * ─────────────────────────────────────────────────────────────────────────
 * Bir hanın üst kat galerisinin KÖŞESİNDESİN. Korkuluğa yaslanmış, aşağı ve
 * dışa bakıyorsun. Altında 6.9 m karanlık taş var.
 *
 * Neden bu kamera: listedeki tek AŞAĞI bakan kadraj. Diğer her şey yukarı ya
 * da karşıya bakıyor.
 *
 * Okunabilirlik SAHNENİN IŞIĞIYLA çözülüyor, perdeyle değil:
 *   · Metin avlu BOŞLUĞUNUN üstünde durur. Arkasında hiçbir şey yok —
 *     yükseklik sisinin dibi ve koyu taş. Panel testi: paneli kaldırsak metin
 *     okunur muydu? Panel zaten yok.
 *   · Aydınlanan şeyler metnin ÇEVRESİNDE: üstte çeperin gözleri, altta yakın
 *     korkuluğun üst kenarı. Göz metnin etrafında dolanıyor, arkasında değil.
 *
 * Sıcaklık tamamen kesildi: fener sarı olamayacağı için "gece"yi renk
 * sıcaklığıyla değil DEĞERLE anlatıyoruz. Işık soğuk beyaz, taş koyu teal.
 *
 * Kompozisyon güvenliği: avlu dikdörtgeni asla kapanmıyor — yakın iki kenar
 * (üstünde durduğumuz korkuluk) kadrajın altından kesiliyor. Bu kırılgan bir
 * denge değil, kameranın korkuluğun ARKASINDA olmasının kaçınılmaz sonucu.
 */

type Props = {
  sinif?: string;
  /** Her karede 7 etiket için ekran konumu + ölçek + ışık. setState YOK. */
  bildir?: (d: { x: number; y: number; o: number; isik: number; gor: boolean }[]) => void;
};

const DURGUN_T = 4.2; // reduced-motion tek karesi: birkaç göz yanık dursun

export function HanSahnesi({ sinif, bildir }: Props) {
  const kapRef = useRef<HTMLDivElement>(null);
  const bildirRef = useRef(bildir);
  bildirRef.current = bildir;

  useEffect(() => {
    const kap = kapRef.current;
    if (!kap) return;

    const statik = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kaba = window.matchMedia("(pointer: coarse)").matches;

    /* ── kurulum ─────────────────────────────────────────────────────── */
    const sahne = new THREE.Scene();
    const arkaPlan = arkaPlanDokusu();
    sahne.background = arkaPlan ?? new THREE.Color(PALET.sis);

    const kamera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
    kamera.position.set(KAMERA.x, KAMERA.y, KAMERA.z);
    kamera.lookAt(BAKIS.x, BAKIS.y, BAKIS.z);
    const temelQ = kamera.quaternion.clone();

    const cizer = new THREE.WebGLRenderer({
      antialias: !kaba,
      powerPreference: "high-performance",
    });
    cizer.setPixelRatio(Math.min(window.devicePixelRatio, kaba ? 1.5 : 2));
    cizer.setSize(kap.clientWidth, kap.clientHeight);
    cizer.shadowMap.enabled = true;
    cizer.shadowMap.type = THREE.PCFSoftShadowMap;
    cizer.toneMapping = THREE.ACESFilmicToneMapping;
    cizer.toneMappingExposure = 1.15;
    kap.appendChild(cizer.domElement);

    /* ── ışık ────────────────────────────────────────────────────────────
     * 1) Hemisphere: avlu gökyüzüne açık — çeperi ve korkuluğun ÜST kenarını
     *    şekillendiren asıl ışık bu. Yer rengi #073F49: sahnenin tabanı burada,
     *    saf siyah imkânsız.
     * 2) Tek SpotLight: uzak köşedeki fenerin dökümü. decay=2 ile hızla ölüyor
     *    → zemine yayılmıyor, köşedeki gözlerin derinliğine giriyor.
     *    Küp gölge haritalı PointLight pahalı olurdu; tek spot = tek derinlik
     *    geçişi.
     * 3) Fenerin kendi camında dekoratif, gölgesiz, çok düşük PointLight. */
    // Şiddet 0.95'ten 0.80'e indi. Neden: 0.95, yakın karanlığı kaldırmak için
    // tek başına ambiyansa yüklendiği için sahneyi DÜZLEŞTİRİYORDU (ölçülen:
    // kadraj std sapması 24.2 — kontrast, ambiyansın altında eziliyordu).
    // Artık yakın alanı arkamızdaki odalar (yönlü) taşıyor, dolayısıyla
    // ambiyans yalnızca kendi işini yapıyor: taban değeri #073F49'un altına
    // düşürmemek. Işık-gölge yönlü kaynaklardan gelir, ambiyanstan değil.
    const gok = new THREE.HemisphereLight(
      new THREE.Color(PALET.gokIsik),
      new THREE.Color(PALET.yerIsik),
      0.8,
    );
    sahne.add(gok);

    const spot = new THREE.SpotLight(new THREE.Color(PALET.fener), 90, 26, 0.95, 0.9, 2);
    spot.position.set(FENER.x, FENER.y + 1.5, FENER.z);
    spot.target.position.set(FENER.x + 2.6, 0, FENER.z + 2.2);
    spot.castShadow = true;
    spot.shadow.mapSize.set(kaba ? 1024 : 2048, kaba ? 1024 : 2048);
    spot.shadow.camera.near = 0.5;
    spot.shadow.camera.far = 28;
    spot.shadow.bias = -0.0016;
    spot.shadow.normalBias = 0.04;
    sahne.add(spot, spot.target);

    const fenerIsik = new THREE.PointLight(new THREE.Color(PALET.fenerCam), 7, 9, 2);
    fenerIsik.position.set(FENER.x, FENER.y, FENER.z);
    sahne.add(fenerIsik);

    /* 4) ARKAMIZDAKİ ODALAR. Ölçülen kusur: yakın korkuluk düz siyah bir dilim
     *    olarak okuyordu (std sapma 4.9 = olaysız, saf siyah pikseller dahil).
     *    Sebep doku değil IŞIK YÖNÜ: hemisphere neredeyse yönsüzdür, normal
     *    haritası altında gölge üretmez; tek yönlü kaynak (fener) 25 m ötede,
     *    uzak köşede. Yani kadrajın EN YAKIN nesnesine hiçbir yönlü ışık
     *    değmiyordu.
     *    Çözüm fiziksel: bir arkadın İÇİNDE duruyoruz. Arkamızdaki üst kat
     *    odaları (yakın kanat, z=+12) yanıyor; gerçek bir handa korkuluğun bize
     *    bakan yüzünü tam olarak o ışık yalar. distance=9/decay=2 ile hızla
     *    ölüyor → avlu tabanına (11 m+ ötede, 6.9 m aşağıda) ULAŞMIYOR, yani
     *    metnin arkasındaki sakin karanlık bozulmuyor. Gölge yok = bedeli düşük.
     *    Hikâyeye de oturuyor: han dolu, fikir yanan odalar arasında dolaşıyor. */
    for (const x of [-4, 4, 12]) {
      const oda = new THREE.PointLight(new THREE.Color(PALET.fenerCam), 5.5, 9, 2);
      oda.position.set(x, GALERI_Y + 1.6, AVLU_Z - 0.35);
      sahne.add(oda);
    }

    /* ── doku + malzeme ──────────────────────────────────────────────── */
    const dok = tasDokulari();
    const tekrarla = (t: THREE.Texture, u: number, v: number) => {
      const c = t.clone();
      c.needsUpdate = true;
      c.repeat.set(u, v);
      return c;
    };

    const duvarN = tekrarla(dok.normal, 1.6, 1.6);
    const duvarP = tekrarla(dok.puruz, 1.6, 1.6);
    const zeminN = tekrarla(dok.normal, 7, 7);
    const zeminP = tekrarla(dok.puruz, 7, 7);
    // Kutular (korkuluk/güverte/saçak/baba) tekrarı GEOMETRİDE taşıyor —
    // kutuUV() her yüzü metre boyuna göre ölçekliyor. Malzeme (1,1) kalmalı,
    // yoksa ölçek iki kez uygulanır.
    const kutuN = tekrarla(dok.normal, 1, 1);
    const kutuP = tekrarla(dok.puruz, 1, 1);

    const duvarMat = tasMalzemesi({
      renk: PALET.tas,
      puruz: 0.95,
      normal: kutuN,
      puruzHarita: kutuP,
    });
    const gozMat = tasMalzemesi({
      renk: PALET.tas,
      puruz: 0.95,
      normal: duvarN,
      puruzHarita: duvarP,
      dalga: true,
      dalgaGuc: 0.1, // cephede sadece kemer sövesine vuran bir tık
      dalgaTaban: 0.3,
    });
    // Oyuk: ıslak değil, KURU ve mat. Dalga burada güçlü — ışık gözün
    // derinliğine giriyor, avlu tabanına değil.
    const oyukMat = tasMalzemesi({
      renk: "#10454f",
      puruz: 1.0,
      normal: duvarN,
      puruzHarita: duvarP,
      dalga: true,
      dalgaGuc: 0.62,
      dalgaTaban: 0.34,
      arka: true,
      normalGuc: 0.5,
    });
    // Islak avlu taşı: planar reflection YOK. Düşük pürüzlülük + normal map →
    // spot'un speküları zeminde uzayan bir iz bırakıyor. Bedeli sıfır.
    const zeminMat = tasMalzemesi({
      renk: PALET.zemin,
      puruz: 0.42,
      normal: zeminN,
      puruzHarita: zeminP,
      normalGuc: 0.45,
    });
    const malzemeler = [duvarMat, gozMat, oyukMat, zeminMat];

    /* ── avlu tabanı ─────────────────────────────────────────────────── */
    const zeminGeo = new THREE.PlaneGeometry(2 * AVLU_X + 2, 2 * AVLU_Z + 2);
    const zemin = new THREE.Mesh(zeminGeo, zeminMat);
    zemin.rotation.x = -Math.PI / 2;
    zemin.receiveShadow = true;
    sahne.add(zemin);

    /* ── gözler + oyuklar: 48'er instance ────────────────────────────── */
    const liste = gozListesi();
    const zGozGeo = gozGeometrisi(ZEMIN_BOY, Z_AYAK, Z_TEPE);
    const uGozGeo = gozGeometrisi(UST_BOY, U_AYAK, U_TEPE);
    const zOyukGeo = oyukGeometrisi(Z_TEPE);
    const uOyukGeo = oyukGeometrisi(U_TEPE);
    const geoler = [zGozGeo, uGozGeo, zOyukGeo, uOyukGeo];

    const gecici = new THREE.Object3D();
    const kur = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      kat: number,
      arka: boolean,
    ) => {
      const alt = liste.filter((g) => g.kat === kat);
      const im = new THREE.InstancedMesh(geo, mat, alt.length);
      const sira = new Float32Array(alt.length);
      alt.forEach((g, i) => {
        gecici.position.set(g.x, g.y, g.z);
        gecici.rotation.set(0, g.ry, 0);
        gecici.updateMatrix();
        im.setMatrixAt(i, gecici.matrix);
        sira[i] = g.s;
      });
      geo.setAttribute("aSira", new THREE.InstancedBufferAttribute(sira, 1));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = !arka;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      sahne.add(im);
      return im;
    };
    const meshler = [
      kur(zGozGeo, gozMat, 0, false),
      kur(uGozGeo, gozMat, 1, false),
      kur(zOyukGeo, oyukMat, 0, true),
      kur(uOyukGeo, oyukMat, 1, true),
    ];

    /* ── galeri döşemesi (taşma), korkuluk, saçak ────────────────────── */
    const kutu = (
      g: THREE.BufferGeometry,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
    ) => {
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      sahne.add(m);
      return m;
    };

    const ic = { x: AVLU_X - TASMA, z: AVLU_Z - TASMA }; // 12.4 / 10.4
    // Her kutu kendi metre boyuna göre UV'lenir → taş her yerde aynı boyda.
    // En yakın nesne (korkuluk, 24.8 m) artık gerçekten moloz taş.
    const kb = (en: number, boy: number, der: number) =>
      kutuUV(new THREE.BoxGeometry(en, boy, der), en, boy, der);

    const guverteYanGeo = kb(TASMA, 0.22, 2 * AVLU_Z);
    const guverteUcGeo = kb(2 * AVLU_X, 0.22, TASMA);
    const korkulukYanGeo = kb(KORKULUK_KAL, KORKULUK_Y, 2 * ic.z);
    const korkulukUcGeo = kb(2 * ic.x, KORKULUK_Y, KORKULUK_KAL);
    const babaGeo = kb(0.5, KORKULUK_Y + 0.16, 0.5);
    const sacakYanGeo = kb(2.4, 0.3, 2 * AVLU_Z + 2);
    const sacakUcGeo = kb(2 * AVLU_X + 2, 0.3, 2.4);
    const yardimci = [
      guverteYanGeo,
      guverteUcGeo,
      korkulukYanGeo,
      korkulukUcGeo,
      babaGeo,
      sacakYanGeo,
      sacakUcGeo,
    ];

    const gy = GALERI_Y - 0.11;
    kutu(guverteYanGeo, AVLU_X - TASMA / 2, gy, 0, duvarMat);
    kutu(guverteYanGeo, -AVLU_X + TASMA / 2, gy, 0, duvarMat);
    kutu(guverteUcGeo, 0, gy, -AVLU_Z + TASMA / 2, duvarMat);
    kutu(guverteUcGeo, 0, gy, AVLU_Z - TASMA / 2, duvarMat);

    const ky = GALERI_Y + KORKULUK_Y / 2;
    kutu(korkulukYanGeo, ic.x, ky, 0, duvarMat);
    kutu(korkulukYanGeo, -ic.x, ky, 0, duvarMat);
    kutu(korkulukUcGeo, 0, ky, -ic.z, duvarMat);
    kutu(korkulukUcGeo, 0, ky, ic.z, duvarMat);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        kutu(babaGeo, sx * ic.x, GALERI_Y + (KORKULUK_Y + 0.16) / 2, sz * ic.z, duvarMat);
      }
    }

    kutu(sacakYanGeo, AVLU_X - 1.0, SACAK_Y, 0, duvarMat);
    kutu(sacakYanGeo, -AVLU_X + 1.0, SACAK_Y, 0, duvarMat);
    kutu(sacakUcGeo, 0, SACAK_Y, -AVLU_Z + 1.0, duvarMat);
    kutu(sacakUcGeo, 0, SACAK_Y, AVLU_Z - 1.0, duvarMat);

    /* ── fener: uzak köşede, alçakta, taşmanın altında ─────────────────
     * Düz kutu + MeshBasic DENENDİ: gölgesiz, kenarsız beyaz bir kare çıktı —
     * mimarinin içinde bir nesne değil, ekrana yapıştırılmış bir post-it gibi
     * okudu. Sekizgen gövde silüet veriyor, küçük ölçek onu "uzak" tutuyor. */
    const fenerGeo = new THREE.CylinderGeometry(0.15, 0.13, 0.36, 8);
    const fenerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALET.fenerCam) });
    const fener = new THREE.Mesh(fenerGeo, fenerMat);
    fener.position.set(FENER.x, FENER.y, FENER.z);
    sahne.add(fener);
    // Askı kolu: feneri duvara bağlar. Fener havada asılı durmasın.
    const kolGeo = kb(0.07, 1.7, 0.07);
    const kol = new THREE.Mesh(kolGeo, duvarMat);
    kol.position.set(FENER.x, FENER.y + 1.03, FENER.z);
    sahne.add(kol);

    /* ── etiket izdüşümü ─────────────────────────────────────────────── */
    const etiketler = etiketNoktalari();
    const nokta = new THREE.Vector3();
    const etiketGonder = (t: number) => {
      const f = bildirRef.current;
      if (!f) return;
      const w = kap.clientWidth;
      const h = kap.clientHeight;
      f(
        etiketler.map((e) => {
          nokta.set(e.x, e.y, e.z);
          const uzak = nokta.distanceTo(kamera.position);
          nokta.project(kamera);
          const gor = nokta.z < 1 && Math.abs(nokta.x) < 0.99;
          return {
            x: (nokta.x * 0.5 + 0.5) * w,
            y: (-nokta.y * 0.5 + 0.5) * h,
            o: THREE.MathUtils.clamp(26 / uzak, 0.72, 1.12),
            isik: hanDalgasi(e.s, t),
            gor,
          };
        }),
      );
    };

    /* ── fare parallaksı: yalnız ince işaretçi ───────────────────────── */
    const hedef = { x: 0, y: 0 };
    const yumusak = { x: 0, y: 0 };
    const fareOynat = (e: PointerEvent) => {
      hedef.x = (e.clientX / window.innerWidth - 0.5) * 2;
      hedef.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!statik && !kaba) window.addEventListener("pointermove", fareOynat, { passive: true });

    /* ── döngü ───────────────────────────────────────────────────────── */
    // Kamera YAKIN kanadın galerisinde duruyor → kayma o galerinin ekseninde,
    // yani x boyunca. Köşeden uzaklaşmıyor, köşede geziniyor.
    const eksen = new THREE.Vector3(1, 0, 0);
    let id = 0;
    let gorunur = false;
    let calisiyor = false;
    const saat = new THREE.Clock();

    const ciz = () => {
      const t = saat.getElapsedTime();
      for (const m of malzemeler) m.hanU.uT.value = t;

      yumusak.x += (hedef.x - yumusak.x) * 0.04;
      yumusak.y += (hedef.y - yumusak.y) * 0.04;

      // Kamera galeri boyunca çok yavaş kayıyor (60 sn'lik salınım). Yakın
      // korkuluk 1.1 m ötede, uzak kanat 24 m: parallaks 20:1 — mekân tek
      // bakışta okunuyor, scroll beklemeden.
      const kay = Math.sin(t * 0.105) * 1.7;
      kamera.position.set(
        KAMERA.x + eksen.x * kay + yumusak.x * 0.5,
        KAMERA.y - yumusak.y * 0.22 + Math.sin(t * 0.24) * 0.04,
        KAMERA.z + eksen.z * kay + yumusak.x * 0.16,
      );
      // Dönme sabit: eğim çivilenmiş kalıyor → avlu boşluğu kadrajda oynamıyor,
      // metin asla korkuluğa ya da çepere taşmıyor.
      kamera.quaternion.copy(temelQ);

      cizer.render(sahne, kamera);
      etiketGonder(t);
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

    // reduced-motion BASE katman: rAF hiç başlamaz. Tek statik kare.
    const tekKare = () => {
      for (const m of malzemeler) m.hanU.uT.value = DURGUN_T;
      cizer.render(sahne, kamera);
      etiketGonder(DURGUN_T);
    };

    const boyutla = () => {
      const w = kap.clientWidth;
      const h = kap.clientHeight;
      if (!w || !h) return;
      const en = w / h;
      // Dar ekranda dikey FOV açılır ki uzak kanat ve 7 göz kadrajda kalsın.
      kamera.fov = THREE.MathUtils.clamp(50 * (1.75 / Math.max(en, 0.45)), 50, 82);
      kamera.aspect = en;
      kamera.updateProjectionMatrix();
      cizer.setSize(w, h);
      if (statik) tekKare();
    };
    boyutla();
    if (statik) tekKare();

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
      for (const m of meshler) m.dispose();
      for (const g of geoler) g.dispose();
      for (const g of yardimci) g.dispose();
      zeminGeo.dispose();
      fenerGeo.dispose();
      kolGeo.dispose();
      fenerMat.dispose();
      for (const m of malzemeler) m.dispose();
      for (const t of [duvarN, duvarP, kutuN, kutuP, zeminN, zeminP, dok.normal, dok.puruz])
        t.dispose();
      arkaPlan?.dispose();
      cizer.dispose();
      cizer.domElement.remove();
    };
  }, []);

  return <div ref={kapRef} className={sinif} aria-hidden="true" />;
}

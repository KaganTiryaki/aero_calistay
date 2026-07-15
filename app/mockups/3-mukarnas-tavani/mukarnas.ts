import * as THREE from "three";

/*
 * MUKARNAS — prosedürel geometri.
 *
 * Mukarnasın kuralı basit ve tam AERO: BÜYÜK tek bir formu (kubbe) küçük
 * geçiş hücrelerine bölerek çözersin. Burada da öyle: bir düşey profil
 * (kubbe), kademelere bölünür; her kademe eşit genişlikte hücrelere bölünür.
 * Hücre = mimari bir kabuk parçası — küre/telkafes/polihedra DEĞİL.
 */

/** Kare odanın yarı genişliği. */
export const A = 6.2;
/** Duvar yüksekliği = tonozun bindiği kot (korniş üstü). */
export const H = 3.7;
/** Tonozun kademe halkalarının toplam yükselişi. */
export const YUKSELIS = 4.7;
/** Mukarnas kademe sayısı. */
export const KAT = 8;
/** Korniş bandı. */
export const KORNIS_H = 0.36;
export const KORNIS_D = 0.2;

export type Kesit = { olcek: number; y: number; yuv: number };

/** Kenar ortası fi=0'da olan düzgün n-genin yarıçapı (iç yarıçap = 1). */
function ngen(fi: number, n: number) {
  const a = (2 * Math.PI) / n;
  const m = (((fi + a / 2) % a) + a) % a;
  return 1 / Math.cos(m - a / 2);
}

/**
 * Plan yarıçapı — gerçek tromplu geçiş: KARE → SEKİZGEN → ONALTIGEN.
 * Daireye morf etmiyoruz: daire, tonozu iç içe halkalara çevirip yasaklı
 * "yörünge" okumasına düşürüyordu. Faseta = mimari; her kademede kırılan
 * kenarlar ışığı farklı açılarla alır, halka çözülür.
 */
export function planR(fi: number, yuv: number) {
  if (yuv <= 0.5)
    return THREE.MathUtils.lerp(
      ngen(fi, 4),
      ngen(fi, 8),
      THREE.MathUtils.smoothstep(yuv, 0, 0.5),
    );
  return THREE.MathUtils.lerp(
    ngen(fi, 8),
    ngen(fi, 16),
    THREE.MathUtils.smoothstep(yuv, 0.5, 1),
  );
}

/**
 * Tonozun düşey profili. t: 0 (bindirme) → 1 (tepe halkası).
 * Saf küre kesiti alt kademeleri düz, üst kademeleri uçurum yapıyor; saf koni
 * ise cansız. İkisinin karışımı mukarnasın gerçek eğrisine yakın duruyor.
 */
export function profil(t: number): Kesit {
  const koni = 1 - t * 0.78;
  const kubbe = Math.sqrt(Math.max(0, 1 - Math.pow(t * 0.954, 2)));
  return {
    olcek: koni * 0.55 + kubbe * 0.45,
    y: H + YUKSELIS * t,
    yuv: THREE.MathUtils.smoothstep(t, 0.02, 0.86),
  };
}

/* ---------------------------------------------------------------- plan eğrisi */

export type Egri = { pts: THREE.Vector2[]; s: number[]; boy: number };

/** Bir kademenin plan eğrisi + kümülatif yay uzunluğu. (x, z) düzleminde. */
export function planEgri(k: Kesit, n = 720): Egri {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const fi = (i / n) * Math.PI * 2;
    const r = A * k.olcek * planR(fi, k.yuv);
    pts.push(new THREE.Vector2(r * Math.cos(fi), r * Math.sin(fi)));
  }
  const s: number[] = [0];
  for (let i = 1; i <= n; i++) s.push(s[i - 1] + pts[i % n].distanceTo(pts[i - 1]));
  return { pts, s, boy: s[n] };
}

/**
 * Yay uzunluğuna göre nokta + teğet. Hücreler eşit YAY aralığına dizilir —
 * eşit AÇI aralığına değil. Mukarnasın tanımlayıcı özelliği hücrelerin aynı
 * genişlikte olması; kare planda açıya göre dizmek köşeleri şişirirdi.
 */
export function egriUzerinde(e: Egri, hedef: number) {
  const n = e.pts.length;
  const h = ((hedef % e.boy) + e.boy) % e.boy;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (e.s[m] <= h) lo = m + 1;
    else hi = m;
  }
  const i = Math.max(0, lo - 1);
  const seg = e.s[i + 1] - e.s[i] || 1e-6;
  const f = (h - e.s[i]) / seg;
  const a = e.pts[i];
  const b = e.pts[(i + 1) % n];
  return {
    p: a.clone().lerp(b, f),
    t: b.clone().sub(a).normalize(),
  };
}

/* ------------------------------------------------------------------ hücre */

/**
 * Tek mukarnas hücresi — birim kabuk.
 * x ∈ [-0.5, 0.5] (teğet) · y ∈ [0, 1] (yukarı) · z ∈ [0, 1] (içeri, kubbe ekseni).
 *
 * Kesit: θ ∈ [0, π/2] boyunca y = sinθ, z = 1 - cosθ. Hücre alt ucunda DİK
 * başlar, üst kenarında YATAY biter — mukarnasın klasik içbükey yayı.
 *
 * KRİTİK: hücre aşağıda bir UÇ, yukarıda tam genişlik. Tersi (yukarı daralan)
 * denendi ve "rafa dizilmiş kaşık" gibi, yani grafik gibi okundu. Mukarnasa
 * adını veren şey sarkıt: uçları aşağı sarkan taraklı saçak. Genişlik
 * pow(sinθ, 0.7) ile açılınca siluet sivri kemere döner.
 *
 * Yanal: (1-u²) parabolü ortayı dışa (derine) oyar → yan kenarlarda keskin
 * sırt, ortada tarak. Kontrastı taşıyan öz-gölge tam burada doğuyor.
 *
 * GENİŞLİK ÜSSÜ (0.42): önce 0.7'ydi. Hücre aşağıda iğne gibi sivriliyor,
 * komşusuyla arasında koca bir V boşluğu kalıyordu; tavan "oyulmuş taş" değil,
 * havada uçuşan beyaz dart sürüsü gibi okunuyordu. Üs düşünce genişlik hemen
 * açılır: komşu hücrelerin yan kenarları neredeyse boydan boya değer, yüzey
 * SÜREKLİ olur, saçak yalnız en altta taraklanır — mukarnasın gerçek okuması.
 */
export function hucreGeo(nu: number, ns: number, bel: number, uc: number) {
  const poz: number[] = [];
  const idx: number[] = [];
  for (let si = 0; si <= ns; si++) {
    const th = (si / ns) * (Math.PI / 2);
    const st = Math.sin(th);
    const ct = Math.cos(th);
    const hw = 0.5 * (uc + (1 - uc) * Math.pow(st, 0.42));
    for (let ui = 0; ui <= nu; ui++) {
      const u = -1 + (2 * ui) / nu;
      poz.push(u * hw, st, 1 - ct - bel * (1 - u * u) * st);
    }
  }
  const W = nu + 1;
  for (let si = 0; si < ns; si++)
    for (let ui = 0; ui < nu; ui++) {
      const a = si * W + ui;
      idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(poz, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------ hücre yerleşimi */

export type Yerlesim = {
  m: THREE.Matrix4;
  poz: THREE.Vector3;
  ao: number;
};

/**
 * Kademe kademe hücre dizer. İki tip:
 *  A = ana sarkıt (kademenin tam yüzü)
 *  B = yarım kaydırmalı, daha yüksekte başlayan küçük sarkıt. A'ların uçları
 *      arasında kalan V boşluğuna oturur ve geride durur → saçak çift sıra
 *      olur. Gerçek mukarnasın iç içe geçen ikinci katmanı budur; tek tip
 *      hücre "grafik" görünür, iki tip "mimari".
 */
export function hucreleriKur(kaba: boolean) {
  const listeA: Yerlesim[] = [];
  const listeB: Yerlesim[] = [];
  const hedefW = kaba ? 0.95 : 0.62;
  const yAx = new THREE.Vector3(0, 1, 0);

  for (let k = 0; k < KAT; k++) {
    const alt = profil(k / KAT);
    const ust = profil((k + 1) / KAT);
    const eA = planEgri(alt);
    const eU = planEgri(ust);
    const n = Math.max(6, Math.round(eA.boy / hedefW));
    const w = eA.boy / n;
    const h = ust.y - alt.y;
    const katT = k / (KAT - 1);
    // Yukarı kademeler tonozun derinine gömülür → daha az ışık görür.
    const aoKat = 0.88 - 0.46 * katT;

    const koy = (oran: number, tip: "A" | "B") => {
      const { p, t } = egriUzerinde(eA, oran * eA.boy);
      const { p: pU } = egriUzerinde(eU, oran * eU.boy);

      const N = new THREE.Vector2(-t.y, t.x);
      if (N.dot(p) > 0) N.negate(); // içeri (kubbe eksenine) baksın

      const derin = Math.max(0.16, pU.clone().sub(p).dot(N));
      const zAx = new THREE.Vector3(N.x, 0, N.y);
      const xAx = new THREE.Vector3().crossVectors(yAx, zAx);

      const jit = (Math.random() - 0.5) * 0.07;
      const m = new THREE.Matrix4().makeBasis(xAx, yAx, zAx);

      if (tip === "A") {
        m.scale(new THREE.Vector3(w * 0.97, h, derin));
        m.setPosition(p.x, alt.y, p.y);
        listeA.push({
          m,
          poz: new THREE.Vector3(p.x, alt.y + h * 0.5, p.y),
          ao: THREE.MathUtils.clamp(aoKat + jit, 0.2, 1),
        });
      } else {
        // Dışa (derine) it + yukarı kaydır: A uçlarının arasındaki V'nin
        // dibine otursun, önlerine geçmesin.
        const ox = p.x - N.x * 0.1;
        const oz = p.y - N.y * 0.1;
        const oy = alt.y + h * 0.32;
        m.scale(new THREE.Vector3(w * 0.62, h * 0.7, derin * 0.66));
        m.setPosition(ox, oy, oz);
        listeB.push({
          m,
          poz: new THREE.Vector3(ox, oy + h * 0.35, oz),
          ao: THREE.MathUtils.clamp(aoKat * 0.66 + jit, 0.14, 1),
        });
      }
    };

    for (let j = 0; j < n; j++) {
      koy((j + 0.5) / n, "A");
      koy((j + 1) / n, "B");
    }
  }
  return { listeA, listeB };
}

/* ------------------------------------------------------------------- kabuk */

/**
 * Hücrelerin ARKASINDAKİ sürekli sıva kabuğu + tepe göbeği.
 * Hücre aralarındaki yarıklardan bu yüzey görünür; biraz geride durduğu için
 * doğal olarak ışık almaz — yarıkların karası buradan gelir, gölge map'i yok.
 */
export function kabukGeo(sap = 0.17, na = 176, nt = 32) {
  const kesitler: Kesit[] = [];
  const ANA = Math.round(nt * 0.78);
  for (let i = 0; i <= ANA; i++) kesitler.push(profil(i / ANA));

  const uc = profil(1);
  const KRON = nt - ANA;
  for (let i = 1; i <= KRON; i++) {
    const a = (i / KRON) * (Math.PI / 2);
    kesitler.push({
      olcek: uc.olcek * Math.cos(a),
      y: uc.y + uc.olcek * A * 0.78 * Math.sin(a),
      yuv: 1,
    });
  }

  const tepe = kesitler[kesitler.length - 1].y;
  const poz: number[] = [];
  const ren: number[] = [];
  const idx: number[] = [];
  const golge = new THREE.Color("#0f4c4e");
  const ak = new THREE.Color(1, 1, 1);
  const c = new THREE.Color();

  for (const ks of kesitler) {
    const oran = Math.min(1, ks.olcek / uc.olcek);
    const t = (ks.y - H) / (tepe - H);
    // 0.5→0.14 aralığı yarıkları yeterince koyu yapmıyordu; hücre siluetleri
    // zemine karışıyordu. 0.30→0.05: yarık gerçekten karanlık bir boşluk.
    const ao = THREE.MathUtils.clamp(0.3 - 0.25 * t, 0.05, 1);
    c.copy(golge).lerp(ak, ao);
    for (let i = 0; i <= na; i++) {
      const fi = (i / na) * Math.PI * 2;
      const r = A * ks.olcek * planR(fi, ks.yuv) + sap * oran;
      poz.push(r * Math.cos(fi), ks.y, r * Math.sin(fi));
      ren.push(c.r, c.g, c.b);
    }
  }
  const W = na + 1;
  for (let j = 0; j < kesitler.length - 1; j++)
    for (let i = 0; i < na; i++) {
      const a = j * W + i;
      idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1);
    }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(poz, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(ren, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* -------------------------------------------------------------------- oda */

/**
 * Dört duvar + korniş + zemin. Düz, süssüz sıva: okuma bandı burası.
 * AO vertex renginde pişiriliyor — köşe, zemin ve korniş altı koyulaşır, orta
 * bant (metnin oturduğu kot) doğal olarak sahnenin en parlak yeri olur.
 * Bu bir "perde" değil: temas gölgesi + girişten (kameranın arkası) gelen ışık.
 */
export function odaGeo() {
  const poz: number[] = [];
  const ren: number[] = [];
  const golge = new THREE.Color("#0f4c4e");
  const ak = new THREE.Color(1, 1, 1);
  const c = new THREE.Color();

  const yumusak = (d: number, r: number) =>
    0.4 + 0.6 * THREE.MathUtils.smoothstep(d, 0, r);

  const duvarAO = (s: number, y: number) =>
    yumusak(A - Math.abs(s), 1.9) *
    yumusak(y, 1.6) *
    yumusak(Math.max(0, H - KORNIS_H - y), 1.2);

  // Kesit: (içeri taşma, y). Korniş içeri doğru çıkıntı yapar; alt yüzü
  // aşağı bakar ve hiç ışık almaz → duvarla tonozu ayıran keskin koyu çizgi.
  const kesit: { i: number; y: number }[] = [];
  const DIK = 22;
  for (let j = 0; j <= DIK; j++) kesit.push({ i: 0, y: ((H - KORNIS_H) * j) / DIK });
  kesit.push({ i: KORNIS_D, y: H - KORNIS_H });
  kesit.push({ i: KORNIS_D, y: H - KORNIS_H * 0.34 });
  kesit.push({ i: 0, y: H });

  const NW = 34;
  const yonler: [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  const nokta = (nx: number, nz: number, s: number, i: number, y: number) => {
    // duvar düzlemi A*n, teğet perp(n), i kadar içeri
    const tx = -nz;
    const tz = nx;
    return [A * nx + tx * s - nx * i, y, A * nz + tz * s - nz * i] as const;
  };

  for (const [nx, nz] of yonler) {
    for (let j = 0; j < kesit.length - 1; j++) {
      for (let i = 0; i < NW; i++) {
        const s0 = -A + (2 * A * i) / NW;
        const s1 = -A + (2 * A * (i + 1)) / NW;
        const k0 = kesit[j];
        const k1 = kesit[j + 1];
        const dizi: [number, number, number, number][] = [
          [s0, k0.i, k0.y, duvarAO(s0, k0.y)],
          [s0, k1.i, k1.y, duvarAO(s0, k1.y)],
          [s1, k0.i, k0.y, duvarAO(s1, k0.y)],
          [s1, k0.i, k0.y, duvarAO(s1, k0.y)],
          [s0, k1.i, k1.y, duvarAO(s0, k1.y)],
          [s1, k1.i, k1.y, duvarAO(s1, k1.y)],
        ];
        for (const [s, ii, y, ao] of dizi) {
          const [px, py, pz] = nokta(nx, nz, s, ii, y);
          poz.push(px, py, pz);
          c.copy(golge).lerp(ak, ao);
          ren.push(c.r, c.g, c.b);
        }
      }
    }
  }

  // Zemin — duvar diplerinde koyu.
  const NZ = 26;
  for (let a = 0; a < NZ; a++)
    for (let b = 0; b < NZ; b++) {
      const x0 = -A + (2 * A * a) / NZ;
      const x1 = -A + (2 * A * (a + 1)) / NZ;
      const z0 = -A + (2 * A * b) / NZ;
      const z1 = -A + (2 * A * (b + 1)) / NZ;
      const ao = (x: number, z: number) =>
        yumusak(Math.min(A - Math.abs(x), A - Math.abs(z)), 2.4) * 0.82;
      const dizi: [number, number][] = [
        [x0, z0],
        [x0, z1],
        [x1, z0],
        [x1, z0],
        [x0, z1],
        [x1, z1],
      ];
      for (const [x, z] of dizi) {
        poz.push(x, 0, z);
        c.copy(golge).lerp(ak, ao(x, z));
        ren.push(c.r, c.g, c.b);
      }
    }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(poz, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(ren, 3));
  g.computeVertexNormals(); // indekssiz → düz (faceted) normal: mimari doğru
  return g;
}

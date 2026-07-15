import * as THREE from "three";

/*
 * Mermer dokusu — dosya YOK, canvas'ta prosedürel üretilir.
 *   R = yükseklik (taşın dişi / işlenmemiş tırtık)
 *   G = albedo alacası (kirli/temiz mermer)
 *   B = damar maskesi (mermerin kendi damarı)
 * Kafes (lattice) indeksleri modulo ile sarıldığı için doku tile'lanabilir;
 * shader iki farklı ölçek + döndürme ile örnekleyip tekrarı kırıyor.
 */

/** mulberry32 — sabit tohum; her açılışta aynı taş. */
function tohumlu(t: number) {
  return () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function kafes(g: number, rnd: () => number) {
  const a = new Float32Array(g * g);
  for (let i = 0; i < g * g; i++) a[i] = rnd();
  return a;
}

/** x,y ∈ [0,1) — kafes sarmalı olduğu için sonuç tile'lanabilir. */
function ornek(a: Float32Array, g: number, x: number, y: number) {
  const fx = x * g;
  const fy = y * g;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const i0 = ((x0 % g) + g) % g;
  const j0 = ((y0 % g) + g) % g;
  const i1 = (i0 + 1) % g;
  const j1 = (j0 + 1) % g;
  const v00 = a[j0 * g + i0];
  const v10 = a[j0 * g + i1];
  const v01 = a[j1 * g + i0];
  const v11 = a[j1 * g + i1];
  return (
    (v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy
  );
}

export function tasDokusu(boyut: number): THREE.CanvasTexture | null {
  const c = document.createElement("canvas");
  c.width = c.height = boyut;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  const rnd = tohumlu(0x1e51);
  const okt = [4, 8, 16, 32, 64, 128].map((g) => ({ g, a: kafes(g, rnd) }));
  const kaba = [3, 6, 12].map((g) => ({ g, a: kafes(g, rnd) }));

  const fbm = (
    ler: { g: number; a: Float32Array }[],
    x: number,
    y: number,
    n: number,
  ) => {
    let s = 0;
    let amp = 0.5;
    let top = 0;
    for (let i = 0; i < n && i < ler.length; i++) {
      s += ornek(ler[i].a, ler[i].g, x, y) * amp;
      top += amp;
      amp *= 0.52;
    }
    return s / top;
  };

  const img = ctx.createImageData(boyut, boyut);
  const d = img.data;
  for (let j = 0; j < boyut; j++) {
    const y = j / boyut;
    for (let i = 0; i < boyut; i++) {
      const x = i / boyut;

      // Diş: geniş fbm + ince kırıntı. Mermerin işlenmemiş yüzü.
      const geniş = fbm(okt, x, y, 4);
      const ince = ornek(okt[5].a, okt[5].g, x, y);
      let h = geniş * 0.72 + ince * 0.28;
      // Kontrastı yükselt — düz gri gürültü taş gibi durmuyor, tırtık lazım.
      h = Math.min(1, Math.max(0, (h - 0.5) * 1.45 + 0.5));

      // Alaca: büyük ölçekli açık/koyu mermer bölgeleri.
      const alaca = fbm(kaba, x, y, 3);

      // Damar: turbulans ile bükülmüş sinüs. Katsayılar tam sayı → tile'lanır.
      const burk = fbm(okt, x + 0.17, y + 0.41, 3);
      const s = Math.sin((x * 5 + y * 2) * Math.PI * 2 + burk * Math.PI * 5.2);
      const damar = Math.pow(1 - Math.abs(s), 9);

      const o = (j * boyut + i) * 4;
      d[o] = h * 255;
      d[o + 1] = alaca * 255;
      d[o + 2] = Math.min(1, damar) * 255;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace; // veri dokusu — sRGB dönüşümü YOK
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Toz zerreleri için yumuşak glow — yine dosya yok. */
export function glowDokusu(): THREE.CanvasTexture | null {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

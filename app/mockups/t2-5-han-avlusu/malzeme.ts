/*
 * HAN AVLUSU — taş malzemesi.
 *
 * MeshStandardMaterial'a iki şey enjekte ediliyor (onBeforeCompile):
 *
 *  1) YÜKSEKLİK SİSİ. Avluyu dolduran, yukarı doğru seyrelen sis. Metnin
 *     arkasındaki bölgeyi FİZİKSEL olarak sakinleştiren şey bu — beyaz
 *     dikdörtgen perde değil. Sis mesafeyle VE alçaklıkla artıyor: yakın
 *     korkuluk çıtır çıtır net, altı metre aşağıdaki avlu tabanı yıkanmış.
 *
 *  2) GÖZ DALGASI. Kanat boyunca ilerleyen ışık; emissive olduğu için bedava
 *     (ışık kaynağı değil, gölge haritası yok). 48 göz tek InstancedMesh'te
 *     ve her birinin dalga parametresi bir instanced attribute (aSira).
 */

import * as THREE from "three";
import { DALGA_GLSL, PALET } from "./han";

export type SisAyar = {
  /** Bu yüksekliğin ALTINDA sis tam yoğun; üstünde uSisDusus hızıyla seyreliyor. */
  ust: number;
  dusus: number;
  taban: number;
};

export const SIS: SisAyar = { ust: 5.4, dusus: 0.3, taban: 0.03 };

export type TasSecim = {
  renk: string;
  puruz: number;
  normal: THREE.Texture;
  puruzHarita: THREE.Texture;
  /** instanced + aSira attribute'u var mı (göz/oyuk) */
  dalga?: boolean;
  dalgaGuc?: number;
  /** Dalga geçmezken bile gözde kalan ışık tabanı (0..1). */
  dalgaTaban?: number;
  arka?: boolean;
  normalGuc?: number;
};

export type HanUniform = {
  uT: { value: number };
  uSisRenk: { value: THREE.Color };
  uSisUst: { value: number };
  uSisDusus: { value: number };
  uSisTaban: { value: number };
  uDalgaRenk: { value: THREE.Color };
  uDalgaGuc: { value: number };
  uDalgaTaban: { value: number };
};

export type TasMalzeme = THREE.MeshStandardMaterial & { hanU: HanUniform };

export function tasMalzemesi(o: TasSecim): TasMalzeme {
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(o.renk),
    roughness: o.puruz,
    metalness: 0,
    normalMap: o.normal,
    normalScale: new THREE.Vector2(o.normalGuc ?? 0.85, o.normalGuc ?? 0.85),
    roughnessMap: o.puruzHarita,
    side: o.arka ? THREE.BackSide : THREE.FrontSide,
    dithering: true, // soluk teal gradyanda bant kırılmasını öldürür
  }) as TasMalzeme;

  const u: HanUniform = {
    uT: { value: 0 },
    uSisRenk: { value: new THREE.Color(PALET.sis) },
    uSisUst: { value: SIS.ust },
    uSisDusus: { value: SIS.dusus },
    uSisTaban: { value: SIS.taban },
    uDalgaRenk: { value: new THREE.Color(PALET.dalga) },
    uDalgaGuc: { value: o.dalgaGuc ?? 0 },
    uDalgaTaban: { value: o.dalgaTaban ?? 0 },
  };
  m.hanU = u;

  const dalgali = !!o.dalga;

  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);

    shader.vertexShader = shader.vertexShader
      .replace(
        "void main() {",
        /* glsl */ `
          varying vec3 vDunyaP;
          ${dalgali ? "attribute float aSira;\nvarying float vSira;" : ""}
          void main() {
        `,
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `
          #include <begin_vertex>
          ${dalgali ? "vSira = aSira;" : ""}
          // Dünya konumunu KENDİMİZ hesaplıyoruz: three'nin worldpos_vertex
          // chunk'ı ışık/gölge define'larına bağlı, ona güvenmek kırılgan.
          #ifdef USE_INSTANCING
            vDunyaP = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
          #else
            vDunyaP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
          #endif
        `,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        /* glsl */ `
          uniform float uT;
          uniform vec3 uSisRenk;
          uniform float uSisUst;
          uniform float uSisDusus;
          uniform float uSisTaban;
          uniform vec3 uDalgaRenk;
          uniform float uDalgaGuc;
          uniform float uDalgaTaban;
          varying vec3 vDunyaP;
          ${dalgali ? "varying float vSira;" : ""}
          ${DALGA_GLSL}
          void main() {
        `,
      )
      // opaque_fragment gl_FragColor'ı kuruyor; tonemapping/colorspace SONRA
      // geliyor. Sisi buraya koyuyoruz → LINEAR uzayda karışıyor (fiziksel
      // olarak doğru yer) ve tonemapping sisli sonucu görüyor.
      .replace(
        "#include <opaque_fragment>",
        /* glsl */ `
          #include <opaque_fragment>
          ${
            dalgali
              ? `
          // Dalga gözün DERİNLİĞİNİ yıkıyor: oyuk malzemesinde güç yüksek,
          // cephe duvarında sadece kemer sövesine vuran bir tık.
          //
          // TABAN neden var: dalga tek başınayken kadrajın sağ yarısı ÖLÜYORDU.
          // Fener uzak SOL köşede, dolayısıyla uzak kanadın sağ yarısına hiçbir
          // ışık ulaşmıyor; dalga da anlık olarak yalnızca 2-3 gözde. Kalan
          // gözler zifiri oluyor ve üstlerindeki disiplin adları mimariden
          // KOPUYOR — boşlukta asılı kalıyorlardı.
          // Çözüm ışık eklemek değil (zemini de aydınlatırdı, plan bozulurdu):
          // her gözde sabit, düşük bir taban. Han DOLU: odalarda birileri var,
          // fikir yanan odalar arasında dolaşıyor. Bedeli sıfır.
          float dlg = uDalgaTaban + (1.0 - uDalgaTaban) * hanDalgasi(vSira, uT);
          gl_FragColor.rgb += uDalgaRenk * dlg * uDalgaGuc;
          `
              : ""
          }
          float mesafe = length(vDunyaP - cameraPosition);
          float dikey = exp(-max(vDunyaP.y - uSisUst, 0.0) * uSisDusus);
          float sf = 1.0 - exp(-mesafe * uSisTaban * dikey);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uSisRenk, clamp(sf, 0.0, 1.0));
        `,
      );
  };

  // Yamalı ve yamasız programlar aynı cache anahtarını paylaşırsa three
  // yanlış shader'ı geri verir.
  m.customProgramCacheKey = () => `han-${dalgali ? "d" : "x"}-${o.arka ? "a" : "o"}`;

  return m;
}

# PLAN-B — CİLA PASS · Mevcut Yapı, Daha İyi İcra

> **Durum:** Onaylı tasarım planı (14 Temmuz 2026). Kod henüz yazılmadı.
> **Kapsam:** Yapı ve bileşenler aynı kalır; 23 madde, görsel-getiri/efor
> sırasıyla (S/M/L = efor). Gerçek kod okunarak çıkarıldı — satır numaraları
> plan tarihindeki koda göre.
> **Not:** PLAN-A'dan bağımsızdır. PLAN-A uygulanırsa buradaki 1, 2, 4, 12 ve
> 23. maddeler zaten kapsanır.

## Katman 1 — En yüksek getiri, küçük efor

1. **PhotoSlot'un marka dışı lacivert gradyanını düzelt — S** · `components/ui/PhotoSlot.tsx:52` — hardcode `linear-gradient(150deg,#0d1b3e,#10275c)` palete yabancı (ikinci accent yasak). `linear-gradient(150deg,#0b1620,#0d2029)` + opsiyonel soluk `.blueprint` grid'e çevir; altyazı scrim'ini `from-black/60` → `from-[#05090c]/70` yap. Ekibimiz 10 slotluk tam bir viewport — tek hex takasıyla koca bölüm markaya döner.
2. **SectionAtmosphere yoğunluk koreografisi — S** · TONES haritasında tüm tonlar 0.10–0.16 pool / 0.18–0.32 aurora bandında ("tek-not renk" teşhisi). Aralığı aç: `deep` (Ekiplerimiz) pool ~0.22 / aurora 0.38+0.30 (en parlak an), `calm` (SSS) pool ~0.07 / aurora 0.10+0.12 (gerçek karanlık vadi); `warm` kendiliğinden yükseliş okunur.
3. **Footer'a final CTA — S** · `components/layout/Footer.tsx` — sayfanın tek işi form; sonuna kadar inen ziyaretçi CTA göremiyor. Büyük display satırının yanına `<Cta label={nav.cta.label} size="sm" />` (metin `content.ts`'ten).
4. **Mikro-etiket kontrast hataları — S** · Gerçek WCAG ihlalleri: `Hero.tsx:126` "↓ KEŞFET" `#33514e` ≈2.1:1 → en az `#5e8480`; `Countdown.tsx:56,66` `#4e6e6b` ≈3:1 → ≥`#79ada8`, min 10px; `--color-label #5e7b78` ≈3.9:1 → ~`#6f8f8b`. Bunlar loş telefon ekranında okunması gereken etiketler (deadline, KVKK).
5. **Ekiplerimiz kart hover'ını zenginleştir — S/M** · `components/sections/Teams.tsx:29` — hover şu an her yerdeki aynı teal border + lift. Contact'taki PersonCard için zaten yazılmış cursor-takipli radyal glow'u (`Contact.tsx:47–54`) komite kartlarına taşı + hover'da `--shadow-glow`'un ~%30'u kadar yumuşak bloom. Var olan desenle çekirdek bölümün monotonluğu çözülür.
6. **Reveal varyantları — S** · `components/motion/Reveal.tsx` — her reveal aynı y:28+blur. `variant?: "up"|"fade"|"left"|"scale"` prop'u (easing aynı): `left` Vizyon Statement'larına, `scale`(0.96→1) PhotoSlot'lara, `fade` SSS satırlarına. Ayrıca liste bağlamlarında (17 SSS, 9 kart) `filter: blur()`u kaldır — orta segment telefonda şu an çalışan en pahalı şey; stagger içinde yokluğu görünmez.
7. **Bölüm dikey ritmini çeşitlendir — S** · Tüm bölümler `py-28 md:py-40`. Nefes deseni: Vizyon `py-24 md:py-32`, **Ekiplerimiz `py-32 md:py-48`** (hedef bölüm en çok havayı alır), TeamGallery `py-20 md:py-28`, Süreç `py-28 md:py-36`, SSS `py-24 md:py-36`, İletişim aynı. Saf class düzenlemesi.
8. **Vurgu kelimelerinde Fraunces italik — S** · Marka italikli display serif yüklüyor, hiç kullanmıyor. Gradyan "Sirkülasyon" kelimesine, hero başlığının ilk kelimesine, "Sen de aramıza katıl."a `italic`. Sıfır byte, anında editoryal karakter. (Önce `lib/fonts.ts`'te Fraunces `style:["normal","italic"]` doğrula.)

## Katman 2 — Orta efor, büyük görünür kazanç

9. **3×3 grid'de öne çıkan komite kartı — M** · `Teams.tsx:26` — kart 0 `lg:col-span-2`, `p-9`, `text-3xl` başlık, blurb kısaltmasız. Tek düzensizlik "duvar kâğıdı" algısını kırar; içerik/bileşen dokunulmaz.
10. **Teams CTA bandını full-bleed yap — M** · `Teams.tsx:75–85` — CTA bandı 9 panelin arasında kaybolan bir panel daha. Konteynerden çıkar: tam genişlik bant, üst/altta gradyan hairline (`.seam` stili hazır), iç içerik `max-w-6xl`. Sayfanın tek contained-vs-full-bleed kontrastı doğar ve dönüşüm anına spot vurur.
11. **SSS akordeon yükseltmesi — M** · `Faq.tsx` — (a) kapalı satır hover'ı: soru `translate-x-1` + numara `text-brand-turq/60`; (b) soru tipografisi `text-xl md:text-2xl`; (c) `Plus` ikonu duruşta `text-label`, sadece açık/hover'da teal (17 teal ikon accent'i sulandırıyor); (d) açık cevaba mevcut spine ile hizalı hairline-sol içerlek. Cevaplara `text-pretty`.
12. **Nav'da aktif bölüm göstergesi — M** · `StickyNav.tsx:86` — 7 bölümlük tek sayfada yön kaybı. Section id'leri üzerinde tek IntersectionObserver; eşleşen link `text-ink` + küçük teal alt çizgi (`scale-x`, marka easing).
13. **Hero disiplin şeridi mobilde — M** · `Hero.tsx:117–124` — 7 mono isim `tracking-[0.28em]` ile 360px ekranda 2–3 satıra kırılıp `bottom-3`'teki "↓ KEŞFET"i eziyor; birincil ilk izlenim bu. `md:` altında kenar-fade maskeli yatay kaydırılabilir tek satır (veya 3–4 isim + "＋3"). Ayrıca `h-svh min-h-[640px]` kısa telefonlarda iç scroll yaratıyor — 360×640'ta denetle.
14. **Countdown basamak stabilitesi — S** · `Countdown.tsx:63` — Fraunces `tabular-nums` desteklemezse saniye kolonu her tikte titrer (LCP başlığının dibinde). Görsel doğrula; titriyorsa basamakları `font-mono`ya (Plex Mono doğal tabular, veri için markaya uygun) `text-2xl/3xl` al.
15. **Şekil dili aksanları — S/M** · Her şey 1.25rem/pill. Tam iki sapma: (a) öne çıkan Teams kartı + CTA bandına tek süpürülmüş köşe `rounded-[1.25rem] rounded-tr-[3rem]` (akıntı motifi); (b) PhotoSlot'un köşe braket motifini Contact PersonCard'lara taşı (zaten ev stili). İki aksan = kasıt; fazlası gürültü.
16. **SectionHeader esnekliği — S** · `size?: "lg"|"md"` ve `rule?: boolean` prop'ları. TeamGallery ve Contact `md` kullanır (numara ~`text-[3.5rem] md:text-[6.5rem]`, h2 `text-3xl md:text-5xl`) — ikincil bölümler Ekiplerimiz sesiyle bağırmayı bırakır. Sabit boyları `clamp()`e çevir (4.5rem→9rem breakpoint sıçraması tablette sırıtıyor).
17. **Contact sağ kolonunu dengele — S** · `Contact.tsx:129–135` — iki kısa PersonCard uzun panelin yanında altta ölü boşluk bırakıyor. Kartlara `flex-1` (içerik `justify-center`) veya üçüncü sakin bilgi kartı ("48 saat içinde dönüş" — metin önce `content.ts`'e).

## Katman 3 — İnce ayar

18. **Ghost-numara enflasyonunu buda — S** · Dev soluk numara şu an 5 ayrı yerde. 9 Teams kartından kaldır (`Ekip · 02` kicker'ı zaten numaralıyor); SectionHeader + Process'te kalsın (nefes alacak yerleri var).
19. **Cta focus-visible + hover derinliği — S** · `Cta.tsx` — tek değerli butonda `focus-visible` yok, hover'da ok itmesinden başka değişim yok. `focus-visible:outline-2 outline-offset-2 outline-brand-turq` + hover'da gölge derinleşmesi.
20. **Telefonda reveal viewport marjini — S** · `Reveal.tsx:36` — `margin:"-80px"` 640px ekranda içeriği geç gösterir, hızlı scroll'da sayfa boş/tembel hisseder. `margin:"0px 0px -60px 0px"` veya `amount:0.15`.
21. **Nav link mikro-etkileşimi — S** · `StickyNav.tsx:92` — sadece renk solması var. Ev alt çizgisi: `after:` 1px gradyan bar, `scale-x-0→100` origin-left (12. maddeyle eşleşir: aktif = kalıcı çizgi).
22. **Mobil menü arka planındaki israf blur'u — S** · `StickyNav.tsx:152–154` — `.overlay-backdrop` blur(9px) uyguluyor ama %97 opak `rgba(4,8,11,0.97)` ile eziliyor: görünmez ama tam da menüyü açan düşük-uç telefonlarda compositing bedeli ödetiyor. Burada `backdropFilter:"none"`.
23. **Başıboş hex'leri tokenize et — S** · Hero/Countdown/Cta'daki 8+ tek seferlik hex `@theme` paletini bypass ediyor (PhotoSlot lacivert kazası böyle oldu). 2–3 isimli token'a katla (`--color-label-dim`, `--color-ink-on-brand`) — 4. maddeyle birlikte yap.

## Önerilen partiler

1–4 + 7 (bir öğleden sonra; algılanan renk/tempo dönüşür) → 5, 6, 8, 16, 18 (hareket + tipografi geçişi) → 9–12 (çekirdek bölüm ve etkileşim geçişi) → 13–15, 17, 19–23 (detay süpürmesi). Hiçbir yerde yeni bağımlılık yok; JS bütçesine tek dokunuş 12. maddedeki IntersectionObserver.

## Kabul kriterleri

- `npm run build` sonrası first-load JS artışı ≈0; Lighthouse mobil LCP/CLS bütçede (LCP < 2.5s, CLS < 0.1).
- Kontrast düzeltmeleri sonrası tüm 10–11px etiketler AA'yı geçer (madde 4, 23).
- 360×640'ta hero şeridi tek satır, taşma yok (madde 13).
- Tek accent korunur (madde 1 sonrası palet dışı renk kalmaz), mojibake yok.

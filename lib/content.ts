/**
 * Single source of truth for all site copy & config.
 * Türkçe kopya + ayarlar burada. Bileşenlere dokunmadan güncelle.
 */

export const site = {
  // Başlık formatı: "[event] [year] — [school]". Kurum: AERO.
  school: "AERO", // resmi ad farklıysa güncelle (ör. "AERO Robotics")
  event: "Sirkülasyon Çalıştayı",
  year: "'26",
  navMark: "Sirkülasyon '26",
  // TODO: Google Form linki. Boşsa CTA "yakında" moduna düşer.
  applyUrl: "",
  // TODO: son başvuru tarihi (ISO). Geçerli & gelecekteyse hero'da geri sayım görünür; boşsa gizlenir.
  applyDeadline: "2026-09-15T23:59:59",
  socials: {
    instagram: "https://www.instagram.com/aero_cal/",
    instagramHandle: "@aero_cal",
    tiktok: "https://www.tiktok.com/@aerocalistay?lang=tr-TR",
    tiktokHandle: "@aerocalistay",
    email: "", // TODO: resmi e-posta (varsa) — boşsa e-posta satırı gizli kalır
  },
} as const;

export const nav = {
  links: [
    { label: "Vizyon", href: "#vizyon" },
    { label: "Ekiplerimiz", href: "#ekipler" },
    { label: "Süreç", href: "#surec" },
    { label: "SSS", href: "#sss" },
    { label: "İletişim", href: "#iletisim" },
  ],
  cta: { label: "Ekibe Katıl", href: "#basvuru" },
} as const;

export const hero = {
  status: "Ekip başvurularımız açıldı",
  cta: "Ekibe Katıl",
  ctaNote: "Google Formlar üzerinden · birkaç dakika",
} as const;

// name = çarkta görünen etiket · note = seçilince "notepad"te çıkan açıklama.
// TODO: notları çalıştayın işleyişine göre düzenle.
export const disciplines = [
  {
    name: "Sanat",
    note: "Estetiğin ve ifadenin toplumda nasıl dolaştığını, üretildiğini ve zamanla dönüştüğünü ele alır.",
  },
  {
    name: "Tarih",
    note: "Olayların ve fikirlerin zaman içindeki döngüsünü, tekrarını ve bıraktığı mirası izler.",
  },
  {
    name: "Felsefe",
    note: "Kavramların ve soruların düşünce tarihi boyunca nasıl dolaşıma girdiğini sorgular.",
  },
  {
    name: "Psikoloji",
    note: "Bireyin iç dünyasında duyguların, düşüncelerin ve davranışların döngüsünü keşfeder.",
  },
  {
    name: "Sosyoloji",
    note: "Bilginin, gücün ve normların toplumda nasıl dolaştığını ve yeniden üretildiğini inceler.",
  },
  {
    name: "Hukuk",
    note: "Adaletin, kuralların ve hakların toplumsal dolaşımını ve zamanla dönüşümünü tartışır.",
  },
  {
    name: "İlahiyat",
    note: "İnancın, anlamın ve değerlerin kültürler arasındaki dolaşımını ve etkisini ele alır.",
  },
] as const;

export const vision = {
  label: "Vizyonumuz",
  body: "Gençleri fikir üretmeye teşvik eden, onları kalıpların dışına çıkmaya iten ve farklı bakış açılarını bir araya getirerek zengin bir düşünce ve tartışma ortamı sağlayan bir çalıştay düzenlemek. Yenilikçi ve ilham verici bir etkinlikle, katılımcıların yalnızca bugünlerine değil geleceklerine de yön veren bir deneyim sunmayı hedefliyoruz.",
} as const;

export const mission = {
  label: "Misyonumuz",
  body: "Temamız olan sirkülasyonu farklı disiplinlerin ışığında ele alarak katılımcılara derinlikli bir düşünme ve tartışma ortamı sunmak. Sanat, Tarih, Felsefe, Psikoloji, Sosyoloji, Hukuk ve İlahiyat gibi alanların perspektifleriyle; gençlerin bireyin kendisiyle, toplumla ve dünya düzeniyle kurduğu ilişkiyi sorgulamalarını teşvik ediyor; muhakeme, müzakere ve eleştirel düşünme becerilerinin gelişimine katkı hedefliyoruz.",
} as const;

export const teams = {
  eyebrow: "Kadromuz",
  title: "Ekiplerimiz",
  intro:
    "Çalıştayı hayata geçiren ekipler ve başkanları. Başvurduğunda, ilgilendiğin ekibe başkanının yönetiminde yardımcı üye olarak katılırsın.",
  groupPhotoCaption: "Çalıştay Ekibi · 2026",
  modalHint: "Ne yaptığını gör",
  // TODO: başkan isimleri + blurb/görevleri düzenle, eksik ekipleri ekle (grid otomatik büyür).
  // Her ekibin kendi fotoğraf slotu var; görsel gelince public/ekipler/ altına koyarız.
  // blurb: ekibin bir cümlelik özeti · tasks: yardımcı üyenin üstlendiği işler (karta tıklayınca modalda görünür).
  committees: [
    {
      name: "Organizasyon",
      lead: "[Başkan]",
      blurb: "Çalıştayın genel planlamasını, zaman çizelgesini ve ekipler arası koordinasyonu yürüten çekirdek ekip.",
      tasks: ["Etkinlik akışını ve programı planlama", "Ekipler arası koordinasyon", "Gün içi operasyonun yönetimi"],
    },
    {
      name: "Basın",
      lead: "[Başkan]",
      blurb: "Çalıştayın sesini duyuran ekip: sosyal medya, duyurular ve dış iletişim.",
      tasks: ["Instagram içerik takvimi", "Duyuru ve metin yazımı", "Katılımcı iletişimi"],
    },
    {
      name: "Tasarım",
      lead: "[Başkan]",
      blurb: "Çalıştayın görsel dilini kuran ekip: afiş, sunum, sosyal medya görselleri ve kimlik.",
      tasks: ["Afiş & sosyal medya görselleri", "Sunum ve şablon tasarımı", "Görsel kimliğin korunması"],
    },
    {
      name: "Lojistik",
      lead: "[Başkan]",
      blurb: "Sahnenin arkasını çeviren ekip: mekân, malzeme, ikram ve gün içi akış.",
      tasks: ["Mekân ve yerleşim planı", "Malzeme ve ikram tedariği", "Gün içi saha desteği"],
    },
    {
      name: "IT",
      lead: "[Başkan]",
      blurb: "Teknik altyapıyı ayakta tutan ekip: web sitesi, kayıt sistemleri ve dijital araçlar.",
      tasks: ["Web sitesi ve dijital araçlar", "Kayıt & form sistemleri", "Etkinlik günü teknik destek"],
    },
    {
      name: "Press",
      lead: "[Başkan]",
      blurb: "Anı yakalayan ekip: fotoğraf, video ve etkinlik boyunca içerik üretimi.",
      tasks: ["Fotoğraf & video çekimi", "Etkinlik içi içerik yakalama", "Sonrası için arşiv ve kurgu"],
    },
  ],
  cta: "Ekibe Katıl",
} as const;

export const process = {
  eyebrow: "Nasıl işliyor?",
  title: "Başvuru Süreci",
  intro:
    "Başvurudan ekibe katılıma kadar yol basit. Her adımda seni bilgilendiririz — takıldığın yerde Instagram'dan yazman yeterli.",
  steps: [
    {
      step: "01",
      title: "Başvuru",
      body: "“Ekibe Katıl” formunu doldur — yalnızca birkaç dakika. İlgilendiğin ekibi seçer, kendinden kısaca bahsedersin.",
    },
    {
      step: "02",
      title: "Değerlendirme",
      body: "Başvurun ilgili ekip başkanı ve koordinasyon ekibi tarafından incelenir.",
    },
    {
      step: "03",
      title: "Tanışma",
      body: "Kısa bir tanışma sohbetiyle birbirimizi tanır, sorularını yanıtlarız. Deneyim değil, merak arıyoruz.",
    },
    {
      step: "04",
      title: "Ekibe Katılım",
      body: "Sonuçlar paylaşılır ve ekibindeki yerini alırsın. Sirkülasyon '26 yolculuğu başlar.",
    },
  ],
} as const;

export const faqs = [
  {
    q: "Kimler başvurabilir?",
    a: "Öğrenmeye ve üretmeye hevesli, meraklı herkes başvurabilir. [Yaş/okul kriteri buraya eklenecek.]",
  },
  {
    q: "Ön deneyimim yok, yine de başvurabilir miyim?",
    a: "Kesinlikle. Aradığımız şey deneyim değil, merak ve öğrenme isteği. Gerisini birlikte öğreniriz.",
  },
  {
    q: "Hangi ekiplere başvurabilirim?",
    a: "Başkanların yürüttüğü ekiplere yardımcı üye olarak katılabilirsin: Organizasyon, Basın, Tasarım, Lojistik, IT ve daha fazlası. İlgi alanına göre başvuru formunda seçim yaparsın.",
  },
  {
    q: "Başvuru ücretli mi?",
    a: "[Hayır, başvuru tamamen ücretsizdir.]",
  },
  {
    q: "Nasıl başvururum?",
    a: "Sayfadaki “Ekibe Katıl” butonundan Google Form'a ulaşır, birkaç dakikada başvurunu tamamlarsın.",
  },
  {
    q: "Mülakat var mı, süreç nasıl işliyor?",
    a: "[Form → kısa tanışma/mülakat → sonuç] şeklinde ilerler. Süreç boyunca seni bilgilendiririz.",
  },
  {
    q: "Sonuçlar nasıl açıklanıyor?",
    a: "[Başvuru sonuçları e-posta ve Instagram üzerinden paylaşılır.]",
  },
  {
    q: "Ne kadar zaman ayırmam gerekiyor?",
    a: "[Haftalık taahhüt bilgisi buraya eklenecek.] Esnek bir düzende ilerliyoruz.",
  },
] as const;

export const contact = {
  label: "Bize Ulaşın",
  intro:
    "Aklına takılan her şey için buradayız. En hızlı yol Instagram; dilersen e-posta da yazabilirsin.",
  // TODO: gerçek isim & e-posta bilgileri
  coordinators: [
    { role: "Genel Koordinatör", name: "[Ad Soyad]", email: "[e-posta]" },
    { role: "Genel Koordinatör", name: "[Ad Soyad]", email: "[e-posta]" },
  ],
  advisor: { role: "Danışman Öğretmen", name: "[Ad Soyad]" },
  kvkk: "Başvuru formu aracılığıyla paylaştığın bilgiler yalnızca ekip alım süreci için kullanılır.",
} as const;

export const footer = {
  rights: `© 2026 ${site.school}. Tüm hakları saklıdır.`,
} as const;

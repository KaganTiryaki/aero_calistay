/**
 * Single source of truth for all site copy & config.
 * Türkçe kopya + ayarlar burada. Bileşenlere dokunmadan güncelle.
 */

export const site = {
  school: "AERO", // resmi ad farklıysa güncelle
  event: "Sirkülasyon Çalıştayı",
  year: "'26",
  navMark: "Sirkülasyon '26",
  // Google Form (public /d/e/.../viewform linki). UYARI: form şu an ziyaretçiden
  // Google girişi istiyor. Herkese açık olması için Forms → Yayınla/Ayarlar'dan
  // yanıtlayıcıları "Bağlantısı olan herkes" yap ve giriş/e-posta zorunluluğunu kapat.
  applyUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfQXUUCWI9a_TGkq2loiYO1eUCVJBMLHySOLFwa7w9MUqPIYA/viewform",
  applyDeadline: "2026-08-02T23:59:59", // ~3 hafta (2 Ağustos 2026); değişirse güncelle
  socials: {
    instagram: "https://www.instagram.com/aero_cal/",
    instagramHandle: "@aero_cal",
    tiktok: "https://www.tiktok.com/@aerocalistay?lang=tr-TR",
    tiktokHandle: "@aerocalistay",
    email: "aerosirkulasyoncalistayi@gmail.com",
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
  status: "Ekip başvuruları açık",
  cta: "Ekibe Katıl",
  ctaNote: "Google Form üzerinden · birkaç dakika",
} as const;

// name = çarkta görünen etiket · note = seçilince açılan kısa açıklama.
export const disciplines = [
  {
    name: "Sanat",
    note: "İnsanın kendini ifade etme biçimleri: görsel sanatlar, edebiyat, müzik ve estetik.",
  },
  {
    name: "Tarih",
    note: "Geçmiş olaylar, toplumlar ve fikirlerin bugünü nasıl şekillendirdiği.",
  },
  {
    name: "Felsefe",
    note: "Varlık, bilgi, ahlak ve anlam üzerine temel sorular ve düşünme yöntemleri.",
  },
  {
    name: "Psikoloji",
    note: "Zihin ve davranış: insanın nasıl düşündüğü, hissettiği ve karar verdiği.",
  },
  {
    name: "Sosyoloji",
    note: "Toplum, gruplar ve kurumlar; insanların bir arada yaşama biçimleri.",
  },
  {
    name: "Hukuk",
    note: "Kurallar, haklar ve adalet; toplumsal düzenin nasıl kurulduğu.",
  },
  {
    name: "Teoloji",
    note: "İnanç, din ve anlam arayışının insan ve toplum hayatındaki yeri.",
  },
] as const;

export const vision = {
  label: "Vizyonumuz",
  body: "Gençleri fikir üretmeye teşvik eden, onları kalıpların dışına çıkmaya iten ve farklı bakış açılarını bir araya getirerek zengin bir düşünce ve tartışma ortamı sağlayan bir çalıştay düzenlemektir. Yenilikçi ve ilham verici bir etkinlik düzenleyerek katılımcıların sadece bugünlerine değil, geleceklerine de yön veren bir deneyim sunmayı hedefliyoruz. Amacımız; bu çalıştaydan geçen her öğrencinin kendine yeni şeyler katması; sorgulayan, bilinçli, cesur ve üretken bir birey olarak kendi yolunu çizebilmesi ve fark yaratabilmesidir.",
} as const;

export const mission = {
  label: "Misyonumuz",
  body: "Temamız olan sirkülasyonu farklı disiplinlerin ışığında ele alarak katılımcılara derinlikli bir düşünme ve tartışma ortamı sunmaktır. Sanat, Tarih, Felsefe, Psikoloji, Sosyoloji, Hukuk, Teoloji gibi alanların sağladığı perspektiflerle gençlerin; bireyin kendisiyle, toplumla ve dünya düzeniyle kurduğu ilişkiyi sorgulamalarını teşvik etmeyi amaçlıyoruz. Bu doğrultuda katılımcıların disiplinler arası düşünme becerilerini geliştirmelerine, farklı bakış açılarıyla karşılaşmalarına ve sirkülasyonu çok boyutlu biçimde değerlendirmelerine olanak sağlarken; muhakeme, müzakere ve eleştirel düşünme becerilerinin gelişimine katkı sağlamayı hedefliyoruz.",
} as const;

export const teams = {
  eyebrow: "Kadromuz",
  title: "Ekiplerimiz",
  intro:
    "Çalıştayı hazırlayan ekipler ve başkanları. Başvurduğunda, ilgilendiğin ekibe başkanıyla birlikte yardımcı üye olarak katılırsın.",
  groupPhotoCaption: "Çalıştay Ekibi · 2026",
  modalHint: "Ne yaptığını gör",
  // lead: birden fazla isim " · " ile ayrılır (kartta "Başkanlar" olarak görünür).
  committees: [
    {
      name: "Organizasyon",
      lead: "Öykü Kolçak · Mehmet İbrahim Güler",
      blurb: "Çalıştayın genel planını, zaman çizelgesini ve ekipler arası koordinasyonu yürüten çekirdek ekip.",
      tasks: ["Program & zaman planı", "Ekipler arası koordinasyon", "Gün içi operasyon"],
    },
    {
      name: "Halkla İlişkiler",
      lead: "Nilsu Tunalı · Merve Öktem",
      blurb: "Kurumlar ve katılımcılarla iletişimi, iş birliklerini ve dış ilişkileri yürüten ekip.",
      tasks: ["Kurum & katılımcı iletişimi", "İş birlikleri", "Davet ve takip"],
    },
    {
      name: "Akademi",
      lead: "Asya Koşak · Cantürk Özcan",
      blurb: "Çalıştayın akademik içeriğini hazırlayan ekip: disiplinler, oturumlar ve masa düzeni.",
      tasks: ["Oturum & içerik hazırlığı", "Disiplin masaları", "Konuşmacı koordinasyonu"],
    },
    {
      name: "Finans",
      lead: "Duru Kurt",
      blurb: "Çalıştayın bütçesini yöneten ekip: gelir-gider, sponsorluk ve harcama takibi.",
      tasks: ["Bütçe planı", "Sponsorluk", "Harcama takibi"],
    },
    {
      name: "Medya",
      lead: "Eren Azaplar · Ebrar Aygün",
      blurb: "Sosyal medya, içerik ve fotoğraf/video üreten ekip.",
      tasks: ["Sosyal medya içerikleri", "Fotoğraf & video", "İçerik takvimi"],
    },
    {
      name: "Saha",
      lead: "Deniz Sevan Elmalı · Egehan Fatih Baydili",
      blurb: "Etkinlik günü mekân, yerleşim, malzeme ve saha işleyişinden sorumlu ekip.",
      tasks: ["Mekân & yerleşim", "Malzeme & ikram", "Gün içi saha desteği"],
    },
    {
      name: "Teknik",
      lead: "Kağan Tiryaki",
      blurb: "Web sitesi, kayıt sistemleri ve etkinlik günü teknik desteği sağlayan ekip.",
      tasks: ["Web sitesi & dijital araçlar", "Kayıt & form sistemleri", "Teknik destek"],
    },
    {
      name: "Basın",
      lead: "Mila Günçiçek · Ayşe Melike Günindi",
      blurb: "Basın ilişkileri, duyuru metinleri ve etkinlik arşivinden sorumlu ekip.",
      tasks: ["Basın ilişkileri", "Duyuru & metin", "Etkinlik arşivi"],
    },
    {
      name: "Admin",
      lead: "R. Zilan Ekinci",
      blurb: "Çalıştayın genel yönetim ve idari işleyişini yürüten ekip.",
      tasks: ["İdari süreçler", "Belgeler & takip", "Genel koordinasyon"],
    },
  ],
  cta: "Ekibe Katıl",
} as const;

// "Ekibimiz" — ekibin yüzleri. Fotoğraflar henüz yok; her komite için boş
// (branded) foto slotu gösteriyoruz, görseller geldikçe doldurulacak.
export const teamGallery = {
  eyebrow: "Yüzler",
  title: "Ekibimiz",
  intro:
    "Çalıştayı hazırlayan ekibin yüzleri. Fotoğraflar çekildikçe bu bölümü güncelleyeceğiz — her komite için bir kare ayırdık.",
  groupCaption: "Çalıştay Ekibi · 2026",
  note: "Fotoğraflar yakında eklenecek.",
} as const;

export const process = {
  eyebrow: "Nasıl işliyor?",
  title: "Ekip Başvuru Süreci",
  intro:
    "Başvurudan ekibe katılıma kadar süreç kısa. Her adımda seni bilgilendiriyoruz; takıldığın yerde Instagram'dan yazman yeterli.",
  steps: [
    {
      step: "01",
      title: "Ekip Başvurusu",
      body: "“Ekibe Katıl” formunu doldur — birkaç dakika. İlgilendiğin ekibi seçer, kendinden kısaca bahsedersin.",
    },
    {
      step: "02",
      title: "Değerlendirme",
      body: "Başvurun, ilgili ekip başkanı ve koordinasyon ekibi tarafından incelenir.",
    },
    {
      step: "03",
      title: "Tanışma",
      body: "Kısa bir tanışma sohbeti yapar, sorularını yanıtlarız. Deneyim değil, merak arıyoruz.",
    },
    {
      step: "04",
      title: "Ekibe Katılım",
      body: "Sonuçları paylaşır, ekibindeki yerini veririz. Ardından ekibinle çalışmaya başlarsın.",
    },
  ],
} as const;

export const faqs = [
  {
    q: "Çalıştay nedir?",
    a: "Çalıştay; katılımcıların belirli bir tema ya da problem üzerine birlikte düşünmek, tartışmak ve çözüm üretmek için bir araya geldiği etkileşimli bir organizasyondur. Katılımcılar, ilgi alanlarına göre yer aldıkları komitelerde deneyimli moderatörler eşliğinde fikir alışverişinde bulunur; farklı bakış açılarını değerlendirir ve tartışmalara aktif olarak katılır. Amaç; eleştirel düşünme, ekip çalışması ve disiplinler arası bakış açısını geliştirmektir.",
  },
  {
    q: "Aero Sirkülasyon Çalıştayı'nın teması nedir?",
    a: "Sirkülasyon, en temel anlamıyla sürekli hareketi, dönüşümü ve etkileşimi ifade eder. Felsefi açıdan düşüncelerin, değerlerin ve bakış açılarının bireyler arasında dolaşarak gelişmesini; bilimsel açıdan ise doğadaki enerji, madde ve bilgi döngülerini simgeler. Çalıştay bu iki bakışı bir araya getirerek katılımcıları yedi farklı disiplinden gelen fikirlerle buluşturur; bilgi ve deneyim sürekli bir etkileşim hâlinde dolaşır.",
  },
  {
    q: "Çalıştaya kimler katılabilir?",
    a: "Aktif lise öğrencisi olan herkes katılabilir. Daha önce bir çalıştaya ya da benzeri bir organizasyona katılmış olman gerekmez; ilk kez deneyim yaşayacaklar da, daha önce yer almış olanlar da başvurabilir.",
  },
  {
    q: "Çalıştayda değerlendirme nasıl yapılıyor?",
    a: "Katılımcılar; oturumlara aktif katılımları, konuya hâkimiyetleri, fikirlerini ifade biçimleri ve genel performansları doğrultusunda deneyimli moderatörler tarafından değerlendirilir. Değerlendirme sonucunda öne çıkan katılımcılar çeşitli ödüllere layık görülür.",
  },
  {
    q: "Çalıştay ödülleri nelerdir?",
    a: "Üç tür ödül veriliyor. En İyi Delege Ödülü, komitesinde üstün performans göstererek tartışmalara en etkili katkıyı sağlayan katılımcıya; Üstün Delege Ödülü, aktif katılımı, konuya hâkimiyeti ve katkılarıyla öne çıkan katılımcılara; Mansiyon Ödülü ise çalıştay boyunca sergilediği performans ve potansiyeliyle dikkat çeken katılımcılara verilir.",
  },
  {
    q: "Bu başvuru ne için?",
    a: "Bu başvuru, çalıştayı hazırlayan ekiplerde görev almak içindir. Seçtiğin ekibe, başkanıyla birlikte yardımcı üye olarak katılırsın.",
  },
  {
    q: "Ekibe kimler başvurabilir?",
    a: "Öğrenmeye ve üretmeye istekli, meraklı herkes ekibe başvurabilir. Ön deneyim gerekmez.",
  },
  {
    q: "Ön deneyimim yok, yine de başvurabilir miyim?",
    a: "Evet. Aradığımız deneyim değil, merak ve öğrenme isteği. Gerisini birlikte öğreniriz.",
  },
  {
    q: "Ekipte yer almak bana ne kazandırır?",
    a: "Gerçek bir organizasyonun içinde deneyim: ekip çalışması, iletişim, planlama ve sorumluluk almanın yanı sıra ilgi alanına göre (tasarım, medya, teknik, finans…) pratik beceriler.",
  },
  {
    q: "Hangi ekiplere başvurabilirim?",
    a: "Organizasyon, Halkla İlişkiler, Akademi, Finans, Medya, Saha, Teknik ve Basın. Her ekibin ne yaptığını “Ekiplerimiz” bölümünde görebilir, ilgi alanını başvuru formunda seçebilirsin.",
  },
  {
    q: "Arkadaşımla ya da birden fazla ekibe başvurabilir miyim?",
    a: "Formda en çok ilgilendiğin ekibi seçersin. Arkadaşınla ayrı ayrı başvurmanızda bir sakınca yok.",
  },
  {
    q: "Başvuru ücretli mi?",
    a: "Hayır, ekibe başvuru ücretsiz.",
  },
  {
    q: "Nasıl başvururum?",
    a: "“Ekibe Katıl” butonundan Google Form'a gider, birkaç dakikada başvurunu tamamlarsın.",
  },
  {
    q: "Değerlendirme ve mülakat süreci nasıl işliyor?",
    a: "Başvuru formundan sonra kısa bir tanışma yapıyor, ardından sonucu paylaşıyoruz. Deneyim değil merak arıyoruz; süreç boyunca seni bilgilendiriyoruz.",
  },
  {
    q: "Sonuçlar nasıl açıklanıyor?",
    a: "Sonuçları e-posta ve Instagram üzerinden paylaşıyoruz.",
  },
  {
    q: "Ne kadar zaman ayırmam gerekiyor?",
    a: "Ekiplerin yoğunluğuna göre değişir; genelde haftada birkaç saatlik esnek bir tempoda ilerliyoruz. Etkinlik yaklaştıkça yoğunluk biraz artabilir.",
  },
  {
    q: "Çalıştay ne zaman ve nerede yapılacak?",
    a: "Tarih ve yer netleşince bu sayfadan ve sosyal medyadan duyuracağız.",
  },
  {
    q: "Başka sorum var, nereye yazabilirim?",
    a: "En hızlısı Instagram (@aero_cal); e-posta için aerosirkulasyoncalistayi@gmail.com adresine de yazabilirsin.",
  },
] as const;

export const contact = {
  label: "Bize Ulaşın",
  intro:
    "Soruların için bize yazabilirsin. En hızlı yol Instagram; e-posta da olur.",
  coordinators: [
    { role: "Genel Koordinatör", name: "Asya Yeşil", email: "asya.yesil10@gmail.com" },
    { role: "Genel Koordinatör", name: "Öykü Ceren Güler", email: "oykucerenguler@gmail.com" },
  ],
  kvkk: "Başvuru formu üzerinden paylaştığın bilgiler yalnızca ekip alım sürecinde kullanılır.",
} as const;

export const footer = {
  rights: `© 2026 ${site.school}. Tüm hakları saklıdır.`,
} as const;

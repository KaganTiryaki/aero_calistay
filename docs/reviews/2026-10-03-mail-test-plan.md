# E-posta inceleme ve test planı

Kapsam: `7c2fa6e` ile canlıya alınmış anlık kabul e-postası akışı. Katılımcı ödeme/QR worktree'si bu yayının parçası değildir.

## Canlı kanıt

3 Ekim 2026 00:40 Türkiye saati son gönderim kaydı: bir deneme, `queued`, `provider_message_id=null`, `Brevo hesabı veya gönderim ayarı: unauthorized`. Brevo olayı yok. Bu kayıt gönderim sağlayıcısının isteği reddettiğini kanıtlar; gelen kutusu veya spam klasörü henüz sorunun kaynağı değildir. Anahtar geçersizliği ve sunucu IP engeli bu kısa hata koduyla birbirinden ayrılamaz.

## Uygulama sırası

1. Mevcut testleri temel al; canlı kayıtları salt okunur incele.
2. İşleyiciyi gerçek TypeScript modülleriyle çalıştıran izole test düzeneği kur. Dış HTTP ve Supabase sınırlarını kontrollü yanıtlarla değiştir; gerçek e-posta gönderme.
3. Brevo anahtarı/sunucu IP erişimi başarısızken sağlık kontrolünün hazır demesini kırmızı testle göster. Hesap ve aktif gönderici kontrolü ekle.
4. Hatalı işleyici girdisi, veritabanına sonuç yazılamaması, kota/hız/anahtar reddi, belirsiz sonuç ve yeniden deneme davranışlarını test et; kanıtlanan hataları düzelt.
5. Gerçek PostgreSQL fonksiyonlarını PGlite üzerinde çalıştır: grup izolasyonu, aynı gruba tekrar erişim, iki işleyici, süre dolmuş kilit, günlük kota, iptal ve geç webhook.
6. Panel ile işleyici arasındaki yanıtta bozuk JSON/sayılar ve hata sonuçlarını test et. Kullanıcıya gerçek engeli göster; sağlayıcı kabulünü teslimat olarak sunma.
7. Yeniden uzlaştırmanın sayfalama, yanlış alıcı/etiket/mesaj, geç olay ve sağlayıcı hatalarını test et.
8. Tüm testler, lint, uygulama TypeScript kontrolü, Edge Function kontrolü, production build ve diff kontrolü. Sonuçları raporla ve canlı doğrulamanın sınırlarını belirt.

## Kabul ölçütleri

- `unauthorized` sağlık kontrolünü başarısız yapar; yeni başvuru gönderim aşamasına geçirilmez.
- Yanlış/boş/null grup isteği başka kişilerin e-postalarını tetiklemez.
- Sonuç kalıcı kayda yazılamadığında başarı bildirilmez ve tekrar gönderim önerilmez.
- Sağlayıcı kabulü, teslim edildi ve başarısızlık ayrı kalır.
- İptal, kota, kilit ve tekrar durumları mükerrer e-postaya yol açmaz.
- Canlı hesap engeli açık bir tanı ile raporlanır. Gerçek alıcıya kontrollü test için ayrıca açık gönderim talimatı gerekir.

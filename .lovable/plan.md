# Test Kullanıcısı + Hızlı Giriş

## Amaç
Sistemi denemek için doğrulanmış bir test hesabı oluşturmak ve Auth ekranına tek tıkla giriş butonu eklemek.

## Yapılacaklar

### 1. Auth ayarı: Auto-confirm email aç
- Bundan sonra `/auth` sayfasından kayıt olan herkes email doğrulaması beklemeden direkt giriş yapabilecek.
- Test/demo ortamı için pratik. (Production'da kapatılabilir.)

### 2. Test kullanıcısını oluştur
- **E-posta:** `ozgur@toola.net`
- **Şifre:** `ozgur123`
- **Ad:** Özgür
- **Bölge:** Marmara
- Email doğrulanmış olarak doğrudan oluşturulacak.
- `profiles` tablosuna kayıt elle eklenecek (DB'de aktif trigger yok — `handle_new_user` fonksiyonu var ama `auth.users` tablosuna bağlı değil).

### 3. Auth.tsx — Demo butonu ekle
- "Giriş" sekmesinin üstüne **"🚀 Demo olarak gir"** butonu eklenecek.
- Tek tıkla `ozgur@toola.net` / `ozgur123` ile otomatik giriş yapacak.
- Sahada/sunumda göstermek için ideal.

## Sonuç
Onayladıktan sonra:
- `/auth` sayfasında **"Demo olarak gir"** butonuna basarak direkt içeri gireceksin.
- Veya manuel: `ozgur@toola.net` / `ozgur123`

## Not
Bu test hesabı production'da silinebilir. İstersen ileride `handle_new_user` trigger'ını da `auth.users` tablosuna bağlayabiliriz ki yeni kayıtlarda profile otomatik oluşsun (şu an Auth.tsx'teki signUp metadata ile çalışıyor ama trigger garanti olur).

# Personel26 — Puantaj ve Nöbet Yönetim Sistemi

Sağlık kuruluşları için personel, nöbet (vardiya), puantaj, izin ve raporlama
süreçlerini tek panelden yöneten web uygulaması.
**Next.js 16 (App Router) + PostgreSQL (Drizzle ORM)**.

## Özellikler

- **Puantaj** — Hafta sekmeli aylık cetvel; işçi/memur/hemşire sınıflarına göre
  otomatik net saat (İş Kanunu M.68 mola düşümü: 8s→7,5 · 12s→11), kod (G/G2/N/N2/B/İ/R/ÜY)
  veya serbest saat girişi, hafta sonu ×1,5 / bayram ×2 / gece mesaisi özetleri,
  haftalık elle düzeltme, Excel/CSV/PDF çıktısı, imza alanları
- **Nöbet Çizelgesi** — Gün × "Hizmet (Saat)" sütunlu ızgara; sütun ekle/düzenle/sırala,
  her ay kendi düzenini korur, atamalar puantaja anında işlenir, çakışma + 11 saat
  dinlenme uyarıları, izinli personel koruması, dengeli otomatik taslak
- **Vardiya Şablonları** — Sütun düzenini kaydet, tek tıkla "İşle": düzeni kur + ayı
  adil dağıtımla doldur
- **İzin Yönetimi** — 9 izin türü, 3 aşamalı onay akışı (Hemşire → Müdür → Başhekim),
  onaylanan izin puantaja otomatik yansır
- **Personel Yönetimi** — Ekleme/düzenleme, çoklu departman ataması (★ ana departman),
  İşçi/Memur/Hemşire sınıfları, profil fotoğrafı (otomatik 256px kırpma), izin bakiyeleri,
  arama/filtre, Excel çıktısı
- **Analiz & Uyarılar** — Son 6 ay Gini tabanlı adalet skoru + grafikler; 11 saat
  dinlenme, ardışık nöbet, haftalık 45/40 saat ve gece limiti kontrolleri
- **Değişim Talepleri** — Nöbet takası/devri, onayda otomatik uygulanır
- **Yedekleme** — Günlük otomatik + manuel yedek, tek tıkla geri yükleme
  (öncesinde güvenlik yedeği), JSON indirme, son 30 yedek
- **`/personel`** — Şifresiz, salt-okunur personel sorgu ekranı (TC + soyad doğrulamalı,
  hız sınırlı)

## Geliştirme Ortamı

Gereksinimler: Node.js 20+, PostgreSQL 14+

```bash
git clone https://github.com/KULLANICI/personel26.git
cd personel26
npm install
cp .env.example .env        # DATABASE_URL'i kendi PostgreSQL'inize göre düzenleyin
npx drizzle-kit push        # tabloları oluşturur
npm run dev                 # http://localhost:3000
```

Üretim: `npm run build && npm start`
İlk açılışta örnek veriler (3 servis, 15 personel, 6 aylık nöbet geçmişi) otomatik yüklenir.

## Windows Paketi (Portable + Kurulum)

Son kullanıcı bilgisayarları için tek tıkla çalışan paket:

```powershell
powershell -ExecutionPolicy Bypass -File windows\paket-olustur.ps1
```

Ayrıntılar ve `Personel26-Kurulum.exe` üretimi için:
**[windows/README-WINDOWS.md](windows/README-WINDOWS.md)**

## GitHub Pages'te Web Sitesi Olarak Yayın

Tam sistem GitHub Pages'te **sunucusuz** çalışır: veritabanı tarayıcının içinde çalışan
gerçek PostgreSQL'dir ([PGlite](https://pglite.dev), WebAssembly). Tüm API kodu aynı
kalır; `/api/*` istekleri tarayıcı içinde işlenir. Puantaj, nöbet, şablon, izin, personel
(fotoğraflı), Excel/yazdırma, yedekleme ve `/personel` sorgu ekranı çalışır.

### Yayına alma (tek seferlik, 3 adım)

1. Projeyi GitHub'a gönderin: `git push`
2. GitHub → deponuz → **Settings → Pages → Build and deployment → Source: "GitHub Actions"**
3. **Actions** sekmesinde "GitHub Pages" işi yeşil tik alınca (~2-3 dk) site hazırdır:
   `https://KULLANICI.github.io/DEPO-ADI/`

Sonraki her `git push` siteyi otomatik günceller.
(Özel/private depolarda Pages, ücretli GitHub planı gerektirir; açık depolarda ücretsizdir.)

### Bu sürümün bilmeniz gereken özelliği

- **Veriler her kullanıcının kendi tarayıcısında saklanır** (IndexedDB). Başka bilgisayar
  veya tarayıcı kendi ayrı verisiyle açılır; ilk açılışta örnek veriler kurulur.
- Tarayıcı verilerini (site verileri/çerezler) temizlemek kayıtları siler.
  **Yedekleme → Şimdi Yedek Al → İndir** ile JSON yedek almayı alışkanlık edinin.
- Ekip olarak **ortak veriyle** çalışmak için Windows paketini (tek sunucu, ağdan erişim)
  veya Vercel + Neon kurulumunu kullanın.

### Yerelde deneme

```bash
node scripts/prepare-static.mjs
STATIC_EXPORT=1 PAGES_BASE_PATH=/Personel26 npx next build     # → out/
# out/ klasörünü /Personel26/ altında yayınlayıp test edin:
node scripts/test-github-pages.mjs http://127.0.0.1:8088/Personel26/
```

### Ortak veriyle internetten kullanım (isteğe bağlı)

[Vercel](https://vercel.com) (uygulama) + [Neon](https://neon.tech) (PostgreSQL), ikisi de
ücretsiz başlangıç planlı: Vercel'de GitHub deposunu içe aktarın, `DATABASE_URL` ortam
değişkenine Neon bağlantı adresini girin, bir kez `npx drizzle-kit push` çalıştırın.
**Kurum içi kullanım için önerilen yol Windows paketidir** (aşağıda).

## Proje Yapısı

```
src/
├── app/                # Next.js sayfaları + API route'ları (REST)
│   ├── api/            # timesheet, roster, leaves, personnel, export, backup…
│   └── personel/       # şifresiz personel sorgu ekranı
├── components/         # Puantaj, Nöbet, Şablon, İzin, Personel… sayfaları
├── lib/
│   ├── puantaj-engine.ts   # saat/mola/kod hesap motoru
│   ├── roster-conflicts.ts # çakışma + dinlenme kuralları
│   └── server/             # seed, senkron, dışa aktarma, sütun yönetimi
└── db/schema.ts        # Drizzle ORM şeması (13 tablo)
windows/                # taşınabilir paket + Inno Setup kurulum scriptleri
scripts/                # tarayıcı testleri, arayüz önizleme üretici
```

## Testler

```bash
node scripts/browser-test.mjs            # gerçek Chrome: yükleme + tüm sayfa geçişleri
node scripts/browser-test-clockskew.mjs  # saat farkı senaryosunda hidrasyon güvenliği
```

## Lisans

Kurum içi kullanım için geliştirilmiştir.

# Personel26 — Windows Kurulum Paketi

Bu belge, sistemi **Windows bilgisayarda kurulum veya USB/taşınabilir klasör** olarak çalıştırmak içindir.

Ayrıntılı adımlar, SSS ve klasör yapısı:
**[windows/README-WINDOWS.md](windows/README-WINDOWS.md)**

## Kısa özet

| Paket | Dosya | Kullanım |
| --- | --- | --- |
| Taşınabilir (önerilen) | `windows/paket-olustur.ps1` → `Personel26-Portable\` | Klasörü kopyala, ikonlu `Personel26.exe` dosyasına çift tıkla. Kurulum gerekmez. |
| Kurulum (.exe) | `windows/kurulum-olustur.ps1` (Inno Setup) → `Personel26-Kurulum.exe` | Klasik İleri–İleri–Bitir kurulumu, masaüstü kısayolu |
| Güncelleme | Panel → **Ayarlar → Hakkında & Güncelleme** | Yeni sürüm/hata düzeltmelerini denetler, otomatik kurar. |

## Taşınabilir paketi üretmek (geliştirici PC)

Windows’ta Node.js kurulu olmalı. Proje klasöründe:

```powershell
powershell -ExecutionPolicy Bypass -File windows\paket-olustur.ps1
```

Çıktı:

- `Personel26-Portable\` — USB’ye kopyalanabilir klasör
- `Personel26-Portable.zip` — arşiv

Hedef PC’de **`Personel26.exe`** dosyasına çift tıklayın. Kısa bir “Personel26 başlatılıyor” penceresinden sonra panel Edge’in uygulama penceresinde açılır; Edge yoksa varsayılan tarayıcı kullanılır. Terminal veya `.bat` dosyası görünmez. Durdurmak için aynı klasördeki `Personel26.exe --stop` (kurulumda Başlat menüsündeki **Personel26 — Durdur**) kullanılır; kapanış yedeği otomatik alınır. `Personel26-Baslat.bat` yalnızca otomasyon/geriye dönük uyumluluk için pakette kalır.

Verileriniz `data\` klasöründedir; SQL yedekleri kurulum klasöründeki `backups\` dizininde toplanır (son 7 gün saklanır). Durdurma sırasında son bir yedek otomatik alınır. Paneldeki **Yedekleme** sayfasında klasör yolu gösterilir; listedeki bir SQL dosyasını **Geri yükle** ile tek tıkla döndürebilirsiniz (önce güvenlik yedeği alınır). Tüm kurulumu taşımak için `data\` ve `backups\` klasörlerini birlikte kopyalayın.

## Kurulum dosyasını (.exe) üretmek

Inno Setup 6 kurulu olmalı. Taşınabilir paket henüz yoksa betik onu da üretir:

```powershell
powershell -ExecutionPolicy Bypass -File windows\kurulum-olustur.ps1
```

Çıktı: `windows\Personel26-Kurulum.exe`. Sürüm numarası `package.json` dosyasından
okunur; ayrıca bir yerde güncellemeniz gerekmez.

## Güncellemeler

Windows kurulumunda güncellemeler uygulamanın içinden yapılır: **Ayarlar → Hakkında &
Güncelleme → Güncellemeleri denetle**. Yeni sürüm varsa (ara sürümler atlanarak) tek
tıkla kurulur; önce SQL güvenlik yedeği alınır, sorun çıkarsa önceki sürüme dönülür.
Ayrıntılar ve yeni sürüm yayınlama adımları: **[GUNCELLEME.md](GUNCELLEME.md)**.

## GitHub’dan web sitesi olarak yayınlama

- **GitHub Pages** → arayüzün tanıtım sayfası (hazır iş akışı: `.github/workflows/pages.yml`)
- **Vercel + Neon** → canlı, veritabanlı tam sistem (ücretsiz katman)

Adım adım anlatım: **[WEB-YAYINLAMA.md](WEB-YAYINLAMA.md)**

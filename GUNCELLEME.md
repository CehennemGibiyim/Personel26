# Personel26 — Güncelleme Sistemi

Bu belge, uygulamanın kendi kendini nasıl güncellediğini ve yeni bir sürümün nasıl
yayınlanacağını anlatır.

## Kullanıcı için

Windows kurulumunda: **Ayarlar → Hakkında & Güncelleme**.

0. **Sürüm notları** kartı kurulu sürümün notlarını, **Windows kurulum paketi**
   ve **Web sürümü** bağlantılarını gösterir. Yardım penceresinde de aynı kart
   (kısa biçimde) yer alır.
1. **Güncellemeleri denetle** — GitHub'daki en son sürüm bildirimi okunur.
2. Yeni sürüm veya hata düzeltmesi varsa notlar listelenir. Ara sürümler
   atlanarak **doğrudan en son sürüme** geçilir; atlanan sürümlerin notları da
   gösterilir.
3. **Güncellemeyi başlat** — paket HTTPS üzerinden indirilir, SHA-256 özeti
   doğrulanır, veritabanının SQL güvenlik yedeği alınır, dosyalar değiştirilir,
   uygulama yeniden başlatılır ve sağlık kontrolü yapılır.
4. Bir sorun çıkarsa önceki sürüm ve veriler geri yüklenir; hata günlüğü
   `data/updates/update.log` dosyasındadır.

Güncelleme yalnızca **Windows taşınabilir/kurulum** paketinde çalışır. Geliştirme
ortamında ve GitHub Pages (tarayıcı) sürümünde otomatik kurulum yoktur; panel bu
durumda sürümler sayfasına yönlendirir.

Verileriniz `data/` klasöründedir ve güncelleme sırasında **asla silinmez**.
SQL yedekleri kurulum klasöründeki `backups/` dizininde toplanır; program
kapatılırken son bir yedek otomatik alınır ve bugün dahil son 7 gün saklanır.
Yine de kurumsal kullanımda `backups/` klasörünü harici bir diske kopyalamanız
önerilir. Panelde **Ayarlar → Yedekleme & Veritabanı** bölümü klasör yolunu
gösterir, elle yedek almanızı ve klasörü açmanızı sağlar.

## Sürüm numarası

Tek kaynak `package.json` içindeki `version` alanıdır:

- Arayüz ve API (`NEXT_PUBLIC_P26_VERSION`) derleme sırasında bu değeri okur.
- Taşınabilir paket (`windows/paket-olustur.ps1`) ve kurulum dosyası
  (`windows/kurulum-olustur.ps1` → Inno Setup `/DAppVersion`) aynı değeri kullanır.
- Yan paneldeki sürüm etiketi ve Hakkında ekranı da bu değeri gösterir.

Bu nedenle sürümü yalnızca `package.json` içinde değiştirin; başka yerde
güncellemeye çalışmayın.

## Bildirim dosyası (update.json)

Panel şu adresi okur:

```
https://github.com/CehennemGibiyim/Personel26/releases/latest/download/update.json
```

Örnek yapı:

```json
{
  "schema": 1,
  "app": "Personel26",
  "version": "1.4.0",
  "releasedAt": "2027-01-15",
  "kind": "feature",
  "title": "Sürüm başlığı",
  "notes": ["En son sürümün notu"],
  "schemaVersion": "2026.01",
  "releases": [
    { "version": "1.4.0", "kind": "feature", "title": "...", "notes": ["..."] },
    { "version": "1.3.0", "kind": "fix", "title": "...", "notes": ["..."] }
  ],
  "package": {
    "url": "https://github.com/CehennemGibiyim/Personel26/releases/download/v1.4.0/Personel26-Portable.zip",
    "sha256": "64 karakterlik küçük harfli özet",
    "size": 123456789,
    "fileName": "Personel26-Portable.zip"
  }
}
```

- `releases` listesi **en yeniden eskiye** sıralıdır ve geçmiş sürümleri de
  içerir. Panel, kurulu sürümden yeni olanları süzerek "atlanan sürümler"
  bölümünü oluşturur.
- `minSupportedVersion` (isteğe bağlı): bu sürümün altındaki kurulumlar doğrudan
  güncellenemez; panel tam kurulum paketi önerir.
- `package.url` ve bildirim adresi HTTPS olmalıdır. Panel, doğrulama olmadan
  paket kurmaz.

Adresi değiştirmek için sunucuda `P26_UPDATE_FEED` ortam değişkenini ayarlayın
(ör. kurum içi ayna). Varsayılan adres derlemeye gömülüdür.

## Yeni sürüm yayınlama

1. `package.json` içindeki `version` değerini artırın (örn. `1.2.0` → `1.2.1`).
2. `updates/surum-notlari.json` dosyasına aynı sürüm için bir kayıt ekleyin.
   Kayıt yoksa iş akışı son etiketten bu yana yapılan değişiklikleri not olarak
   kullanır; **kurulum paketi her durumda üretilir**. Yine de açıklayıcı not
   eklemeniz önerilir.
3. Değişiklikleri `main` dalına gönderin ve etiket oluşturun:

   ```bash
   git tag v1.2.1
   git push origin v1.2.1
   ```

4. `.github/workflows/windows-release.yml` çalışır; tip kontrolü ve derlemeden
   sonra taşınabilir paketi, kurulum dosyasını ve `update.json` dosyasını GitHub
   sürümüne yükler.

Elle tetikleme: **Actions → Windows sürüm yayını → Run workflow** ve sürüm
numarasını girin (package.json ile aynı olmalı). Etiket yoksa oluşturulur.

### Yerel olarak paket üretme (Windows)

```powershell
npm install
npx next typegen
npx tsc --noEmit
npm run build
# Taşınabilir paket + kurulum dosyası (Inno Setup 6 gerekir)
powershell -ExecutionPolicy Bypass -File windows\kurulum-olustur.ps1 -SkipBuild
```

Çıktılar:

- `Personel26-Portable\` ve `Personel26-Portable.zip`
- `windows\Personel26-Kurulum.exe`

`update.json` üretmek için:

```powershell
powershell -ExecutionPolicy Bypass -File windows\guncelleme-manifest.ps1 `
  -Version 1.2.1 -Tag v1.2.1 -ZipPath .\Personel26-Portable.zip -OutputPath .\update.json
```

## Güncelleme akışı (teknik)

| Adım | Yer | Açıklama |
| --- | --- | --- |
| Denetim | `POST /api/update/check` | `update.json` okunur, sürüm karşılaştırılır, sonuç `data/update-check.json` içine yazılır. |
| Başlatma | `POST /api/update/apply` | Yalnızca yeni sürüm + `confirm: "GÜNCELLE"` ile; bildirim yeniden doğrulanır. |
| İndirme | `Personel26-Guncelle.ps1` | HTTPS indirme, SHA-256 doğrulaması, arşiv açma. |
| Kurulum | `Personel26-Yonet.ps1 -Action Update` | Uygulamayı kapatır, SQL yedeği alır, `app` klasörünü ve kök betikleri değiştirir, sağlık kontrolü yapar. |
| Geri dönüş | aynı betik | Sağlık kontrolü başarısızsa eski `app` klasörü ve betikler geri konur, uygulama yeniden başlatılır. |
| İzleme | `GET /api/update/status` | Panel `data/update-status.json` dosyasını okuyup ilerlemeyi gösterir. |

Güncelleme sırasında Node.js ve PostgreSQL çalışma zamanları değiştirilmez.
PostgreSQL ana sürüm yükseltmesi (örn. 16 → 17) ayrı bir bakım çalışmasıdır ve
`pg_upgrade` veya yedekten taşıma ile planlanmalıdır.

## Sınırlar ve dikkat edilecekler

- İnternet yoksa denetim "sunucuya ulaşılamadı" hatası verir; uygulama çalışmaya
  devam eder.
- Kurulum dosyası kod imzalama sertifikasıyla imzalanmadığı için SmartScreen
  uyarısı gösterebilir. Kurumsal dağıtımda imzalama önerilir.
- Güncelleme yalnızca aynı Windows kullanıcısının yazabildiği klasörde çalışır
  (varsayılan kurulum `%LOCALAPPDATA%\Programs\Personel26`).
- Aynı anda iki güncelleme başlatılamaz; panel süren işlemi algılar.
- Güncelleme sürecinin testleri `.github/workflows/windows-test.yml` içindedir;
  gerçek Windows makinede sessiz kurulum, güncelleme ve geri dönüş senaryoları
  ayrıca denenmelidir.

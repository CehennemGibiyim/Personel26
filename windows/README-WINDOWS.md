# Personel26 — Windows Kurulum Rehberi

Bu klasör, sistemi Windows'ta **taşınabilir (portable)** ve **kurulumlu (installer)**
olarak paketlemek için gereken her şeyi içerir.

---

## Seçenek 1: Taşınabilir Paket (önerilen, en kolay)

Tek klasör — kopyala, çift tıkla, çalışır. Kurulum, yönetici izni, internet gerekmez.

### Paketi üretme (bir kez, geliştirici makinesinde)

1. Windows'ta [Node.js LTS](https://nodejs.org) kurun (yalnızca paketlemek için).
2. **PostgreSQL kurmanız veya `DATABASE_URL` ayarlamanız gerekmez.** Derleme için script geçici bir yerel adres kullanır; son kullanıcı paketinde PostgreSQL de taşınabilir olarak eklenir.
3. Projeyi indirin ve PowerShell'i proje klasöründe açın:
   ```powershell
   powershell -ExecutionPolicy Bypass -File windows\paket-olustur.ps1
   ```
3. Script otomatik olarak:
   - Uygulamayı derler (standalone çıktı)
   - Taşınabilir Node.js (~30 MB) ve PostgreSQL (~300 MB) indirir
   - `Personel26-Portable\` klasörünü ve `Personel26-Portable.zip` arşivini üretir

### Kullanıcı bilgisayarında çalıştırma

1. `Personel26-Portable` klasörünü (veya ZIP'i açıp) istediğiniz yere kopyalayın —
   USB bellek, D: sürücüsü, masaüstü... fark etmez.
2. **`Personel26-Baslat.bat`** dosyasına çift tıklayın.
   - İlk açılışta veritabanı otomatik kurulur (~15 sn) ve örnek veriler yüklenir.
   - Tarayıcı otomatik açılır: `http://127.0.0.1:3210`
3. Kapatmak için **`Personel26-Durdur.bat`** çalıştırın.

> Tüm verileriniz `data\` klasöründe saklanır. **Yedek almak = bu klasörü kopyalamak.**
> Uygulama içindeki Yedekleme sayfası da ayrıca çalışır.

### Klasör yapısı
```
Personel26-Portable\
├── Personel26-Baslat.bat   ← çift tıkla, sistem açılır
├── Personel26-Durdur.bat   ← güvenli kapatma
├── app\                    ← uygulama (standalone Next.js)
├── node\node.exe           ← taşınabilir Node çalıştırıcı
├── pgsql\                  ← taşınabilir PostgreSQL
├── data\                   ← VERİLERİNİZ (ilk açılışta oluşur)
└── schema.sql              ← veritabanı şeması
```

---

## Seçenek 2: Kurulum Paketi (Personel26-Kurulum.exe)

Klasik "İleri → İleri → Bitir" kurulumu; masaüstü/başlat menüsü kısayolları
ve kaldırma desteğiyle.

1. Önce Seçenek 1'deki taşınabilir paketi üretin.
2. [Inno Setup 6](https://jrsoftware.org/isdl.php)'yı kurun (ücretsiz).
3. `windows\installer.iss` dosyasını Inno Setup Compiler ile açın → **Compile**.
4. Çıktı: `windows\Personel26-Kurulum.exe` — dağıtabilirsiniz.

Kurulum `C:\Program Files\Personel26` altına yapılır; kaldırma sırasında
veritabanının silinip silinmeyeceği kullanıcıya sorulur.

---

## Sık Sorulanlar

**Port çakışması olursa?** `Personel26-Baslat.bat` içindeki `APPPORT=3210` ve
`PGPORT=5433` değerlerini değiştirin. Bilinçli olarak standart olmayan portlar
seçildi; mevcut PostgreSQL/IIS kurulumlarıyla çakışmaz.

**Windows Defender/SmartScreen uyarısı?** İmzasız bat/exe dosyalarında normaldir;
"Ek bilgi → Yine de çalıştır" deyin. Kurumsal dağıtımda kod imzalama sertifikası
eklenebilir.

**Birden fazla bilgisayardan erişim?** `Personel26-Baslat.bat` içinde
`HOSTNAME=127.0.0.1` satırını `HOSTNAME=0.0.0.0` yapın; diğer PC'ler
`http://SUNUCU-IP:3210` ile bağlanır (Windows Güvenlik Duvarı'nda 3210'a izin verin).

**Güncelleme nasıl yapılır?** Yeni paketteki `app\` klasörünü eskisinin üzerine
kopyalayın. `data\` klasörüne DOKUNMAYIN — verileriniz oradadır.
Yeni sürümde tablo değişikliği varsa `schema.sql` guncellemesi not edilir.

**Windows açılışında otomatik başlasın?** `Personel26-Baslat.bat` kısayolunu
`shell:startup` klasörüne koyun (Win+R → `shell:startup`).

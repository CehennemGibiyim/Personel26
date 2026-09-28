# Personel26 — GitHub'dan Web Sitesi Olarak Yayınlama

İki yol vardır. İkisi birlikte de kullanılabilir.

| | A) GitHub Pages | B) Vercel + Neon (önerilen, canlı sistem) |
|---|---|---|
| Adres | `kullanici.github.io/personel26` | `personel26.vercel.app` (veya kendi alan adınız) |
| Ne gösterir | Arayüzün **görsel tanıtımı** (statik) | **Tam çalışan sistem**: giriş, kayıt, puantaj, nöbet, yazdırma, Excel |
| Veritabanı | Yok | Neon PostgreSQL (ücretsiz katman) |
| Maliyet | Ücretsiz | Ücretsiz katman yeterli |
| Kurulum süresi | ~2 dk | ~10 dk |

> **Neden GitHub Pages tek başına yetmez?** Pages yalnızca statik HTML barındırır.
> Personel26 ise sunucu (API) + PostgreSQL veritabanı gerektiren tam yığın bir uygulamadır.
> Bu yüzden Pages'te yalnızca tanıtım sayfası çalışır; canlı sistem için Vercel kullanılır.
> Vercel, GitHub deponuza bağlanır ve her `git push`'ta siteyi otomatik günceller.

---

## A) GitHub Pages — Tanıtım Sayfası

Depoda hazır iş akışı var: `.github/workflows/pages.yml`

1. Projeyi GitHub'a gönderin (`git push`).
2. GitHub'da repo → **Settings → Pages**
3. **Source** kısmında **GitHub Actions** seçin.
4. **Actions** sekmesinde "GitHub Pages (tanıtım sayfası)" iş akışının yeşil tik aldığını görün.
5. Siteniz: `https://KULLANICI-ADINIZ.github.io/REPO-ADI/`

Her `git push` sonrası sayfa otomatik güncellenir.

---

## B) Vercel + Neon — Canlı, Tam Çalışan Sistem

### 1. Ücretsiz veritabanı (Neon)
1. https://neon.tech → GitHub ile giriş → **New Project** (bölge: Frankfurt önerilir)
2. **Connection string**'i kopyalayın. Örnek:
   `postgresql://kullanici:sifre@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`

### 2. Tabloları oluşturun (bir kez, kendi bilgisayarınızda)
```bash
# proje klasöründe
echo DATABASE_URL="YUKARIDAKI_BAGLANTI" > .env
npm install
npx drizzle-kit push
```

### 3. Vercel'e bağlayın
1. https://vercel.com → GitHub ile giriş → **Add New → Project**
2. Personel26 deposunu seçin → **Import**
3. **Environment Variables** bölümüne ekleyin:
   - `DATABASE_URL` = Neon bağlantı adresiniz
4. **Deploy**

Birkaç dakika içinde `https://personel26-xxx.vercel.app` adresinde sistem açılır.
İlk açılışta örnek veriler otomatik yüklenir (istemezseniz Personel Yönetimi'nden silebilirsiniz).

> **Önemli:** `DATABASE_URL` artık derleme aşamasında zorunlu değildir; bu sayede GitHub Actions/Vercel derlemesi bağlantı adresi yokken çökmez. Ancak **canlı sitede** `DATABASE_URL` ayarını mutlaka Vercel → Settings → Environment Variables bölümüne ekleyin. Ayar yoksa sayfa/API açık bir veritabanı yapılandırma hatası verir; veritabanı gerektiren özellikler çalışmaz.

### 4. Güncelleme
Kodda değişiklik yapıp `git push` dediğinizde Vercel siteyi otomatik yeniden derler.

---

## Güvenlik Uyarısı (canlı yayın için önemli)

Sistem şu an **giriş ekranı olmadan** çalışır: adresi bilen herkes yönetim paneline erişebilir.
İnternete açık yayın yapacaksanız:

- Vercel → Project → **Settings → Deployment Protection** ile şifre koruması açın, **veya**
- Yalnızca kurum içi ağda / Windows paketiyle kullanın, **veya**
- Bir sonraki geliştirme adımı olarak kullanıcı girişi (yönetici şifresi) ekletin.

Personel verileri (TC Kimlik No dahil) kişisel veridir; KVKK gereği erişimi sınırlandırın.

---

## Windows'ta yerel kullanım
İnternete açmadan tek bilgisayarda/kurum ağında kullanmak için:
**[WINDOWS-KURULUM.md](WINDOWS-KURULUM.md)**

/**
 * GitHub Pages sürümü uçtan uca testi (sunucu YOK — yalnızca statik dosyalar).
 * Kullanım: out/ klasörünü /Personel26/ altında yayınlayın, sonra:
 *   node scripts/test-github-pages.mjs http://127.0.0.1:8088/Personel26/
 */
import puppeteer from "puppeteer";
const URL0 = process.argv[2] || "http://127.0.0.1:8088/Personel26/";
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 950 });
const errs = [];
page.on("pageerror", e => errs.push(String(e).slice(0, 300)));
page.on("console", m => { if (m.type() === "error" && !/favicon|404|400 \(Bad/.test(m.text())) errs.push(m.text().slice(0, 300)); });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const txt = () => page.evaluate(() => document.body.innerText);
const clickNav = (label) => page.evaluate((l) => [...document.querySelectorAll("nav button")].find(b => b.innerText.includes(l))?.click(), label);

console.log("1) İlk açılış (veritabanı kurulumu + örnek veriler)...");
const t0 = Date.now();
await page.goto(URL0, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.innerText.includes("Personel Ekle"), { timeout: 120000 });
console.log(`   Açıldı: ${((Date.now() - t0) / 1000).toFixed(1)} sn`);
const t = await txt();
console.log("   Personel görünüyor:", t.includes("AYŞE ÇELİK"), "| Servisler:", ["Acil Servis", "Yoğun Bakım"].every(s => t.includes(s)));

console.log("2) Sayfa geçişleri...");
const checks = [["Nöbet Çizelgesi", "Taslak Oluştur"], ["Vardiya Şablonları", "Şablon"], ["İzin Yönetimi", "Yeni İzin Talebi"], ["Personel Yönetimi", "Yeni Personel"], ["Adalet Analizi", "Adalet Skoru"], ["Yedekleme", "Şimdi Yedek Al"]];
let navOk = 0;
for (const [label, expect] of checks) {
  await clickNav(label); await wait(2500);
  const ok = (await txt()).toLocaleLowerCase("tr").includes(expect.toLocaleLowerCase("tr")); if (ok) navOk++;
  console.log(`   ${ok ? "✓" : "✗"} ${label}`);
}

console.log("3) Veri kaydetme: yeni personel ekle...");
await clickNav("Personel Yönetimi"); await wait(1500);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("Yeni Personel"))?.click());
await wait(700);
await page.type('input[placeholder="AD SOYAD"]', "PAGES KALICILIK");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim().endsWith("Ekle") && !b.textContent.includes("Sütun"))?.click());
await wait(2500);
const added = (await txt()).includes("PAGES KALICILIK");
console.log("   Eklendi:", added);

console.log("4) Excel indirme (tarayıcı içi üretim)...");
const xlsx = await page.evaluate(async () => {
  const r = await fetch("/api/export/personel?dept=ALL");
  const b = await r.arrayBuffer(); const u = new Uint8Array(b);
  return { status: r.status, size: b.byteLength, zip: u[0] === 0x50 && u[1] === 0x4b };
});
console.log("   Excel:", xlsx);

console.log("5) Sayfayı yenile → veri kalıcı mı (IndexedDB)?");
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.body.innerText.includes("Personel Ekle"), { timeout: 60000 });
await clickNav("Personel Yönetimi"); await wait(2500);
const persisted = (await txt()).includes("PAGES KALICILIK");
console.log("   Yenileme sonrası hâlâ var:", persisted);

console.log("6) Personel bilgi ekranı (/personel/)...");
await page.goto(URL0 + "personel/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.body.innerText.includes("Personel Bilgi Ekranı"), { timeout: 60000 });
const inputs = await page.$$("input");
await inputs[0].type("10000000146"); await inputs[1].type("celik");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("Sorgula"))?.click());
await wait(3000);
const lookup = (await txt()).includes("Nöbet Takvimim");
console.log("   Giriş + takvim:", lookup);

console.log("\nHatalar:", errs.length ? errs : "YOK");
const ok = navOk === checks.length && added && xlsx.zip && persisted && lookup && errs.length === 0;
console.log(ok ? "✅ GITHUB PAGES SÜRÜMÜ TAM ÇALIŞIYOR (sunucusuz)" : "❌ SORUN VAR");
await browser.close();
process.exit(ok ? 0 : 1);

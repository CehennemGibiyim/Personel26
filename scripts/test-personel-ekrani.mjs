import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errs = [];
page.on("pageerror", e => errs.push(String(e).slice(0, 200)));
page.on("console", m => { if (m.type() === "error" && !m.text().includes("400")) errs.push(m.text().slice(0, 200)); });

await page.goto("http://127.0.0.1:3000/personel", { waitUntil: "networkidle0", timeout: 40000 });
const form = await page.evaluate(() => document.body.innerText.includes("Personel Bilgi Ekranı"));
console.log("1) Giriş formu açıldı:", form);

const inputs = await page.$$("input");
await inputs[0].type("10000000236");
await inputs[1].type("sahin");          // Türkçe karaktersiz küçük harf
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("Sorgula"))?.click());
await new Promise(r => setTimeout(r, 2500));

const res = await page.evaluate(() => ({
  name: document.body.innerText.includes("MEHMET ŞAHİN"),
  calendar: document.body.innerText.includes("Nöbet Takvimim"),
  leaves: document.body.innerText.includes("İzinlerim"),
  err: document.body.innerText.match(/Bilgiler eşleşmedi|Çok fazla/)?.[0] ?? null,
}));
console.log("2) 'sahin' ile giriş:", res);

let monthsOk = 0;
for (let i = 0; i < 7; i++) {
  const before = await page.evaluate(() => document.body.innerText.match(/(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık) 20\d\d/)?.[0]);
  await page.evaluate(() => document.querySelector('button[title="Önceki ay"]')?.click());
  await new Promise(r => setTimeout(r, 1200));
  const after = await page.evaluate(() => document.body.innerText.match(/(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık) 20\d\d/)?.[0]);
  const locked = await page.evaluate(() => document.body.innerText.includes("Çok fazla"));
  if (before !== after && !locked) monthsOk++;
}
console.log(`3) Ay gezinme: ${monthsOk}/7 başarılı (eskiden 4. değişimde kilitleniyordu)`);

await page.evaluate(() => document.querySelector('button[title="Çıkış"]')?.click());
await new Promise(r => setTimeout(r, 600));
const back = await page.evaluate(() => document.body.innerText.includes("Personel Bilgi Ekranı"));
console.log("4) Çıkış → giriş formuna dönüş:", back);

console.log("Hatalar:", errs.length ? errs : "YOK");
const ok = form && res.name && res.calendar && !res.err && monthsOk === 7 && back && errs.length === 0;
console.log(ok ? "✅ PERSONEL BİLGİ EKRANI SORUNSUZ ÇALIŞIYOR" : "❌ SORUN VAR");
await browser.close();
process.exit(ok ? 0 : 1);

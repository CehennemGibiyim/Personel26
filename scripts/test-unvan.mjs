import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 950 });
const errs = [];
page.on("pageerror", e => errs.push(String(e).slice(0, 200)));
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 45000 });

await page.evaluate(() => [...document.querySelectorAll("nav button")].find(b => b.innerText.includes("Personel Yönetimi"))?.click());
await new Promise(r => setTimeout(r, 2000));
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("Yeni Personel"))?.click());
await new Promise(r => setTimeout(r, 800));

const listInfo = await page.evaluate(() => {
  const sel = [...document.querySelectorAll("select")].find(s => s.innerHTML.includes("Temizlik Personeli"));
  return {
    found: !!sel,
    groups: sel ? [...sel.querySelectorAll("optgroup")].map(g => g.label.split(" · ")[0]) : [],
    titleCount: sel ? sel.querySelectorAll("optgroup option").length : 0,
  };
});
console.log("Ünvan listesi:", listInfo.found, "|", listInfo.titleCount, "ünvan |", listInfo.groups.join(" / "));

// Ad yaz + Temizlik Personeli seç
await page.type('input[placeholder="AD SOYAD"]', "TEST TEMIZLIK");
await page.evaluate(() => {
  const sel = [...document.querySelectorAll("select")].find(s => s.innerHTML.includes("Temizlik Personeli"));
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
  setter.call(sel, "Temizlik Personeli");
  sel.dispatchEvent(new Event("change", { bubbles: true }));
});
await new Promise(r => setTimeout(r, 500));
const after = await page.evaluate(() => ({
  titleInput: document.querySelector('input[placeholder="…veya ünvanı kendiniz yazın"]')?.value,
  hint: document.body.innerText.includes("önerilen sınıf: İşçi"),
  isciSelected: [...document.querySelectorAll("button")].some(b => b.textContent.includes("İşçi") && b.className.includes("amber")),
}));
console.log("Seçim sonrası:", after);

// Serbest yazım testi
await page.evaluate(() => {
  const inp = document.querySelector('input[placeholder="…veya ünvanı kendiniz yazın"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(inp, "Temizlik Personeli");
  inp.dispatchEvent(new Event("input", { bubbles: true }));
});

// Kaydet
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim().endsWith("Ekle") && !b.textContent.includes("Sütun"))?.click());
await new Promise(r => setTimeout(r, 2500));
const saved = await page.evaluate(async () => {
  const d = await (await fetch("/api/personnel")).json();
  const p = d.personnel.find(x => x.name === "TEST TEMIZLIK");
  return p ? { id: p.id, title: p.title, type: p.personnelType } : null;
});
console.log("Kaydedilen:", saved);
if (saved) await page.evaluate(async (id) => { await fetch("/api/personnel", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, hard: true }) }); }, saved.id);

console.log("Hatalar:", errs.length ? errs : "YOK");
const ok = listInfo.titleCount >= 90 && after.titleInput === "Temizlik Personeli" && after.hint && saved?.title === "Temizlik Personeli" && saved?.type === "ISCI" && errs.length === 0;
console.log(ok ? "✅ ÜNVAN SEÇİCİ ÇALIŞIYOR" : "❌ SORUN VAR");
await browser.close();
process.exit(ok ? 0 : 1);

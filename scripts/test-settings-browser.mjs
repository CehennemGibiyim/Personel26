import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3000';
const dir = path.resolve('.artifacts/browser');
const downloads = path.join(dir, 'downloads');
await mkdir(downloads, { recursive: true });
const original = await (await fetch(base + '/api/settings')).json();
const boot = await (await fetch(base + '/api/bootstrap')).json();
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
let page = await browser.newPage();
const cdp = await page.createCDPSession();
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
const pageErrors = [];
let passed = 0;
function check(name, condition) { assert.ok(condition, name); passed++; console.log('PASS', name); }
async function clickText(selector, text) {
  const clicked = await page.evaluate((selector, text) => { const button = [...document.querySelectorAll(selector)].find(el => el.textContent.includes(text)); if (!button) return false; button.click(); return true; }, selector, text);
  assert.ok(clicked, `Düğme bulunmalı: ${text}`);
}
page.on('pageerror', error => pageErrors.push(error.message));
page.on('dialog', dialog => dialog.accept());
try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(base, { waitUntil: 'networkidle0' });
  check('Ayarlar ekranı ve sol menü açıldı', await page.$('.settings-root') !== null && await page.$$eval('aside nav button', buttons => buttons.length === 13));
  check('Masaüstünde yatay taşma yok', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const stickySidebar = await page.evaluate(() => {
    const el = document.querySelector('.screen-root > aside');
    const box = el.getBoundingClientRect();
    return { position: getComputedStyle(el).position, top: box.top, bottom: box.bottom, viewport: innerHeight };
  });
  check('Masaüstünde sol menü sabit', stickySidebar.position === 'sticky' && Math.abs(stickySidebar.top) <= 1 && stickySidebar.bottom <= stickySidebar.viewport + 1);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await new Promise(resolve => setTimeout(resolve, 250));
  const stickyAfterScroll = await page.evaluate(() => {
    const box = document.querySelector('.screen-root > aside').getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, viewport: innerHeight };
  });
  check('Uzun sayfada sol menü sabit kalıyor', Math.abs(stickyAfterScroll.top) <= 1 && stickyAfterScroll.bottom <= stickyAfterScroll.viewport + 1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(dir, 'settings-desktop.png'), fullPage: true });
  await page.click('#tab-appearance');
  check('Ana tema ve 20 alternatif hazır', await page.$$eval('.theme-card', cards => cards.length === 21));
  await clickText('.theme-card', 'Okyanus');
  check('Tema gerçek önizlemeye uygulandı', await page.evaluate(() => document.documentElement.dataset.p26Theme === 'ocean'));
  await clickText('.theme-card', 'Personel26');
  check('Ana temaya dönüş', await page.evaluate(() => document.documentElement.dataset.p26Theme === 'original'));
  await clickText('.theme-filter button', 'Açık');
  check('Açık temalar filtrelenir', await page.$$eval('.theme-card', cards => cards.length === 6));
  await clickText('.theme-filter button', 'Tüm temalar');
  await page.screenshot({ path: path.join(dir, 'themes.png'), fullPage: true });
  await page.click('#tab-general');
  await page.locator('.institution-card .settings-form-grid label:first-child input').fill('TARAYICI TEST KURUMU');
  await page.click('.save-settings');
  await page.waitForFunction(() => document.querySelector('.settings-toast')?.textContent.includes('başarıyla'));
  check('Arayüzden ayar kalıcı kaydedildi', (await (await fetch(base + '/api/settings')).json()).settings.institution === 'TARAYICI TEST KURUMU');
  await page.click('#tab-import');
  await page.screenshot({ path: path.join(dir, 'import-upload.png'), fullPage: true });
  const quote = value => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [['Ad Soyad', 'TC Kimlik No', 'Personel sınıfı', 'Personel grubu', 'Servisler'], ['ARAYÜZ TEST PERSONEL', '33333333330', 'Hemşire', 'Hemşire/Sağlık', boot.departments[0].name], ['HATALI TEST SATIRI', '123', 'Bilinmeyen', 'Sağlık', 'Olmayan servis']].map(row => row.map(quote).join(';')).join('\n');
  const file = path.join(dir, 'personel-test.csv'); await writeFile(file, '\ufeff' + csv, 'utf8');
  const upload = await page.$('.import-wizard input[type=file]'); await upload.uploadFile(file);
  await page.waitForSelector('.mapping-table');
  check('CSV dosyası okundu ve sütunlar eşleştirildi', await page.$eval('select[aria-label="Ad Soyad sütunu"]', select => select.value === '0'));
  check('Servis sütunu otomatik eşleştirildi', await page.$eval('select[aria-label="Servis / Departman sütunu"]', select => select.value === '4'));
  await clickText('.import-actions button', 'Kontrol et ve önizle');
  await page.waitForSelector('.import-summary');
  check('Hatalar kayıt öncesi gösteriliyor', await page.$eval('.import-summary .red strong', el => el.textContent === '1'));
  check('Hatalı aktarım düğmesi kilitli', await page.$eval('.import-actions .primary', button => button.disabled));
  await clickText('.import-preview-toolbar button', 'raporu indir');
  let report;
  for (let i = 0; i < 30; i++) { report = (await readdir(downloads)).find(name => name.endsWith('.csv')); if (report) break; await new Promise(resolve => setTimeout(resolve, 150)); }
  check('Açıklamalı CSV raporu indirildi', Boolean(report) && (await readFile(path.join(downloads, report), 'utf8')).includes('TC kimlik'));
  await page.click('.import-confirm input[type=checkbox]');
  check('Geçerli satırlar açık seçimle aktarılabilir', await page.$eval('.import-actions .primary', button => !button.disabled && button.textContent.includes('1 personeli')));
  await page.screenshot({ path: path.join(dir, 'import-preview.png'), fullPage: true });
  await page.click('#tab-backup');
  await page.waitForSelector('.backup-list');
  const backups = await (await fetch(base + '/api/backup')).json();
  const snapshot = await (await fetch(base + `/api/backup/${backups.backups[0].id}`)).json();
  const backupFile = path.join(dir, 'test-backup.json'); await writeFile(backupFile, JSON.stringify(snapshot));
  const backupUpload = await page.$('.database-actions input[type=file]'); await backupUpload.uploadFile(backupFile);
  await page.waitForSelector('.restore-preview');
  check('Yedek dosyası yüklenip önizlendi', await page.$eval('.restore-preview', el => el.textContent.includes('personel')));
  check('Geri yükleme açık yazılı onay ister', await page.$eval('.settings-modal-actions .primary', button => button.disabled));
  await page.click('.settings-modal-close');
  await clickText('.schema-actions button', 'Şemayı güncelle');
  await page.waitForSelector('.settings-modal');
  check('Şema güncellemesi onay pencereli', await page.$eval('.settings-modal h3', el => el.textContent.includes('onaylayın')));
  await page.click('.settings-modal-close');
  await page.click('#tab-system');
  check('Windows testi dürüst biçimde bekliyor gösterilir', await page.$eval('.windows-card', el => el.textContent.includes('çalıştırılmadı')));
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForSelector('.search-modal');
  await page.locator('.search-modal-input input').fill('Görünüm');
  await page.click('.search-results button');
  await page.waitForSelector('.themes-grid');
  check('Klavye ile panel araması çalışıyor', await page.$eval('#tab-appearance', el => el.getAttribute('aria-selected') === 'true'));
  // Arayüz testleri uzun sürüyor; gezinti turuna temiz bir sekmede devam et.
  await page.close();
  page = await browser.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  const navCdp = await page.createCDPSession();
  await navCdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(base, { waitUntil: 'networkidle0' });
  const names = ['Puantaj', 'Nöbet Çizelgesi', 'Maaş Bordro', 'Vardiya Şablonları', 'İzin Yönetimi', 'Değişim Talepleri', 'Personel Yönetimi', 'Adalet Analizi', 'Mevzuat Uyarıları', 'Duyurular', 'Yedekleme', 'Yardım & Kılavuz', 'Ayarlar'];
  for (const name of names) {
    await clickText('aside nav button', name);
    await new Promise(resolve => setTimeout(resolve, 600));
    check(`Sol menü: ${name}`, await page.$eval('aside nav button[aria-current="page"]', (el, value) => el.textContent.includes(value), name));
    if (name === 'Personel Yönetimi') { await page.waitForSelector('table tbody tr'); check('TC maskeleme personel listesine uygulandı', await page.$eval('table tbody', el => el.textContent.includes('•••••••'))); }
    if (name === 'Nöbet Çizelgesi') {
      await clickText('button', 'Arayüzü İndir');
      let panelFile;
      for (let i = 0; i < 30; i++) { panelFile = (await readdir(downloads)).find(file => file === 'index.html'); if (panelFile) break; await new Promise(resolve => setTimeout(resolve, 150)); }
      const panelHtml = panelFile ? await readFile(path.join(downloads, panelFile), 'utf8') : '';
      check('Arayüz index.html olarak indirildi', panelHtml.length > 1000 && /<!doctype html/i.test(panelHtml) && panelHtml.includes('Personel26'));
    }
  }
  await page.goto(base + '/personel', { waitUntil: 'networkidle0' });
  check('Personel sorgu ekranı uygulama içinde açıldı', await page.$('input[inputmode="numeric"]') !== null);
  await page.locator('input[inputmode="numeric"]').fill('10000000146');
  await clickText('button', 'Bilgilerimi Getir');
  await page.waitForFunction(() => document.body.textContent.includes('AYŞE ÇELİK'));
  check('Personel sorgu sonucu görüntülendi', await page.evaluate(() => document.body.textContent.includes('Nöbet')));
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.setViewport({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('.screen-root > aside').getBoundingClientRect().right <= 1);
  check('Mobil yatay taşma yok', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check('Mobil menü başlangıçta kapalı', await page.$eval('.screen-root > aside', el => el.getBoundingClientRect().right <= 1));
  await page.click('button[aria-label="Menüyü aç"]');
  await page.waitForFunction(() => document.querySelector('.screen-root > aside').getBoundingClientRect().left >= -1);
  check('Mobil menü açılıyor', await page.$eval('.screen-root > aside', el => el.getBoundingClientRect().left >= -1));
  await clickText('aside nav button', 'Ayarlar');
  await page.waitForFunction(() => document.querySelector('.screen-root > aside').getBoundingClientRect().right <= 1);
  await page.screenshot({ path: path.join(dir, 'settings-mobile.png'), fullPage: true });
  if (pageErrors.length) console.log('Tarayıcı sayfa hataları:\n - ' + pageErrors.join('\n - '));
  check('Tarayıcı çalışma hatası yok', pageErrors.length === 0);
} finally {
  await fetch(base + '/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(original.settings) });
  await browser.close();
}
console.log(`\n${passed} arayüz testi geçti.`);

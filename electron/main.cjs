'use strict';

/**
 * Personel26 masaüstü kabuğu.
 *
 * StockManager ile aynı çalışma mantığı: uygulama kendi Electron penceresinde
 * açılır, ayrı bir tarayıcı veya adres çubuğu gösterilmez. Personel26'nın
 * veritabanı ve Next.js sunucusu kurulum klasöründeki node/pgsql ile gizli
 * olarak başlatılır; pencere hazır olunca 127.0.0.1 adresine bağlanır.
 *
 * Kısayollar:
 *   Alt+Enter / F11  tam ekran aç/kapat
 *   Esc              tam ekrandan çık
 */

const { app, BrowserWindow, Menu, shell, dialog, session } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const APP_ID = 'com.cehennemgibiyim.personel26';
const DEFAULT_PORT = 3210;
const START_TIMEOUT_MS = 300_000;
const STOP_TIMEOUT_MS = 120_000;
const BACKUP_TIMEOUT_MS = 180_000;

const root = process.env.P26_ROOT
  ? path.resolve(process.env.P26_ROOT)
  : app.isPackaged
    ? path.dirname(process.execPath)
    : path.join(__dirname, '..');

const manager = path.join(root, 'Personel26-Yonet.ps1');
const iconFile = path.join(root, 'personel26.ico');
const backupsDir = path.join(root, 'backups');
const argv = process.argv.slice(1);
const quiet = hasFlag('--quiet');
const smoke = hasFlag('--desktop-test') || hasFlag('--webview-test');
const startOnly = hasFlag('--start-only');
const forceBrowser = hasFlag('--browser');
const commandMode = hasFlag('--stop') || hasFlag('--backup') || startOnly || smoke || forceBrowser;

let mainWindow = null;
let splashWindow = null;
let activePort = DEFAULT_PORT;
let starting = null;
let stopping = null;
let shutdownStarted = false;
let shutdownFinished = false;

app.setAppUserModelId(APP_ID);
if (smoke) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
}

function hasFlag(flag) {
  return argv.some((value) => String(value).toLowerCase() === flag);
}

function log(message) {
  try {
    const dataDir = path.join(root, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.appendFileSync(path.join(dataDir, 'electron.log'), `${new Date().toISOString()} ${message}\n`, 'utf8');
  } catch {
    /* günlük yazılamazsa uygulama engellenmesin */
  }
}

function readPort() {
  try {
    const raw = fs.readFileSync(path.join(root, 'data', 'connection.json'), 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw);
    const port = Number(parsed.appPort);
    if (Number.isInteger(port) && port > 0 && port < 65536) return port;
  } catch {
    /* İlk açılışta bağlantı dosyası henüz yok. */
  }
  return DEFAULT_PORT;
}

function healthy(port) {
  return new Promise((resolve) => {
    const request = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1500 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        resolve(response.statusCode === 200 && /"ok"\s*:\s*true/i.test(body));
      });
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

async function waitForHealth(port, seconds = 90) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (await healthy(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

/**
 * Yedeği Windows PowerShell betiği yerine çalışan sunucudan (pg_dump) ister.
 * Antivirüsler `powershell.exe -ExecutionPolicy Bypass` zincirini engellediği
 * için uygulamadan başlatılan yedekler bu yolu kullanır.
 */
function requestNativeBackup(action, timeoutMs = BACKUP_TIMEOUT_MS) {
  return healthy(readPort()).then((ready) => new Promise((resolve) => {
    if (!ready) {
      resolve(false);
      return;
    }
    const port = readPort();
    const payload = JSON.stringify({ action });
    const request = http.request({
      host: '127.0.0.1',
      port,
      path: '/api/backup/folder',
      method: 'POST',
      timeout: timeoutMs,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        resolve(response.statusCode === 200 && /"ok"\s*:\s*true/.test(body));
      });
    });
    request.on('timeout', () => request.destroy(new Error('Yedek isteği zaman aşımına uğradı.')));
    request.on('error', (error) => {
      log(`Sunucudan yedek alınamadı: ${error && error.message ? error.message : error}`);
      resolve(false);
    });
    request.end(payload);
  }));
}

function runManager(action, extra = [], timeoutMs = START_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(manager)) {
      reject(new Error('Personel26-Yonet.ps1 bulunamadı. Kurulumu yeniden çalıştırın.'));
      return;
    }
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const fallback = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const powershell = fs.existsSync(fallback) ? fallback : 'powershell.exe';
    const args = [
      '-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', manager,
      '-Action', action,
      '-NoBrowser',
      ...extra,
    ];
    const child = spawn(powershell, args, {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let settled = false;
    const append = (chunk) => {
      output += String(chunk);
      if (output.length > 60_000) output = output.slice(-60_000);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* yoksay */ }
      finish({ code: 1, output, timedOut: true });
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(error);
    });
    // 'close' yerine 'exit': PostgreSQL gibi arka plan süreçleri PowerShell'in
    // stdout borusunu miras alabildiği için boru kapanmayabilir; süreç çıkışı
    // yeterlidir ve yedek/sunucu komutları bu yüzden zaman aşımına düşmemeli.
    child.on('exit', (code) => {
      clearTimeout(timer);
      setTimeout(() => finish({ code: code == null ? 1 : code, output, timedOut: false }), 50);
    });
  });
}

function outputTail(output) {
  const lines = String(output || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.slice(-8).join('\n');
}

async function startServer() {
  activePort = readPort();
  if (await healthy(activePort)) {
    log(`Sunucu zaten hazır: ${activePort}`);
    return;
  }
  log(`Sunucu başlatılıyor: ${activePort}`);
  if (starting) return starting;
  starting = (async () => {
    const result = await runManager('Start', [], START_TIMEOUT_MS);
    if (result.timedOut) throw new Error('Sunucu ve veritabanı zamanında hazırlanamadı.');
    if (result.code !== 0) throw new Error(outputTail(result.output) || 'Sunucu başlatılamadı.');
    activePort = readPort();
    if (!(await waitForHealth(activePort))) {
      throw new Error('Sunucu açıldı ancak panel yanıt vermiyor. data/app-error.log dosyasını inceleyin.');
    }
    log(`Sunucu hazır: ${activePort}`);
  })();
  try {
    await starting;
  } finally {
    starting = null;
  }
}

function stopServer({ skipBackup = false } = {}) {
  if (stopping) return stopping;
  stopping = runManager('Stop', skipBackup ? ['-SkipBackup'] : [], STOP_TIMEOUT_MS).then((result) => {
    if (result.timedOut) throw new Error('Personel26 zamanında kapatılamadı.');
    return result;
  }).finally(() => { stopping = null; });
  return stopping;
}

function closeSplash() {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  try { splashWindow.close(); } catch { /* yoksay */ }
  splashWindow = null;
}

function showSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) return;
  splashWindow = new BrowserWindow({
    width: 460,
    height: 250,
    frame: false,
    resizable: false,
    show: true,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#070b14',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Personel26</title>
  <style>
    html,body{margin:0;height:100%;background:#070b14;color:#e7eefc;font:14px/1.5 Inter,system-ui,sans-serif}
    .box{height:100%;display:flex;align-items:center;justify-content:center;gap:18px;padding:28px;box-sizing:border-box}
    .logo{width:54px;height:54px;border-radius:15px;background:linear-gradient(145deg,#5b4bff,#22c7a9);display:flex;align-items:center;justify-content:center;font:700 22px/1 'Segoe UI',sans-serif;color:white;box-shadow:0 10px 30px rgba(91,75,255,.35)}
    h1{margin:0;font-size:19px;letter-spacing:.2px}p{margin:4px 0 0;color:#8fa4c4;font-size:12px}
    .bar{margin-top:14px;width:190px;height:3px;border-radius:999px;background:#142039;overflow:hidden}
    .bar:after{content:'';display:block;width:45%;height:100%;background:#31d3b0;border-radius:999px;animation:load 1.15s ease-in-out infinite alternate}
    @keyframes load{from{transform:translateX(-20%)}to{transform:translateX(140%)}}
  </style></head><body><div class="box"><div class="logo">P26</div><div><h1>Personel26</h1>
  <p>Veritabanı ve panel hazırlanıyor…</p><div class="bar"></div></div></div></body></html>`;
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function isLocal(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function external(url) {
  if (!/^(https?|mailto|tel|whatsapp):/i.test(url)) return;
  shell.openExternal(url).catch(() => { /* varsayılan işleyici yoksa sessiz geç */ });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: '#070b14',
    title: 'Personel26',
    icon: fs.existsSync(iconFile) ? iconFile : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    closeSplash();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
    log('Masaüstü penceresi açıldı');
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    external(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isLocal(url)) return;
    event.preventDefault();
    external(url);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !mainWindow || mainWindow.isDestroyed()) return;
    const enter = input.key === 'Enter' || input.key === 'NumpadEnter' || input.code === 'Enter';
    if ((input.alt && enter) || input.key === 'F11') {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      return;
    }
    if (input.key === 'Escape' && mainWindow.isFullScreen()) {
      event.preventDefault();
      mainWindow.setFullScreen(false);
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(`http://127.0.0.1:${activePort}/`);
}

function registerDownloadRedirect() {
  session.defaultSession.on('will-download', (event, item) => {
    const name = item.getFilename() || '';
    if (!/\.json$/i.test(name)) return;
    try {
      fs.mkdirSync(backupsDir, { recursive: true });
      let target = path.join(backupsDir, name);
      if (fs.existsSync(target)) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        target = path.join(backupsDir, name.replace(/\.json$/i, `-${stamp}.json`));
      }
      item.setSavePath(target);
    } catch {
      /* Klasör yazılamıyorsa Electron'un normal indirme akışına bırak. */
    }
  });
}

async function desktopTest() {
  await startServer();
  const window = new BrowserWindow({
    width: 1440,
    height: 1000,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  await window.loadURL(`http://127.0.0.1:${activePort}/`);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const result = await window.webContents.executeJavaScript(
    `(() => ({
      title: document.title,
      text: (document.body.textContent || '').slice(0, 240),
      navButtons: document.querySelectorAll('aside nav button').length,
      hasFullscreenApi: typeof document.documentElement.requestFullscreen === 'function'
    }))()`,
    true,
  );
  console.log('DESKTOP_TEST ' + JSON.stringify(result));
  const passed = result.navButtons >= 5 && result.text.includes('Personel26');
  app.exit(passed ? 0 : 1);
}

async function runCommand() {
  try {
    if (hasFlag('--stop')) {
      const backedUp = await requestNativeBackup('close', 60_000);
      const result = await runManager('Stop', backedUp ? ['-SkipBackup'] : [], STOP_TIMEOUT_MS);
      if (result.code !== 0 && !quiet) dialog.showErrorBox('Personel26', outputTail(result.output) || 'Personel26 kapatılamadı.');
      app.exit(result.code === 0 ? 0 : 1);
      return;
    }
    if (hasFlag('--backup')) {
      if (await requestNativeBackup('create')) {
        app.exit(0);
        return;
      }
      const result = await runManager('Backup', [], BACKUP_TIMEOUT_MS);
      if (result.code !== 0 && !quiet) dialog.showErrorBox('Personel26', outputTail(result.output) || 'SQL yedeği alınamadı.');
      app.exit(result.code === 0 ? 0 : 1);
      return;
    }
    if (startOnly) {
      await startServer();
      app.exit(0);
      return;
    }
    if (smoke) {
      await desktopTest();
      return;
    }
    if (forceBrowser) {
      await startServer();
      await shell.openExternal(`http://127.0.0.1:${activePort}/`);
      app.exit(0);
      return;
    }
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    log(`Komut hatası: ${message}`);
    // Komut modunda (--start-only/--desktop-test/--backup/--stop) modal kutu
    // açılmaz; kurulum ve otomasyon süreçleri yanıt bekleyerek kilitlenmesin.
    if (!quiet) console.error(message);
    app.exit(1);
  }
}

async function runDesktop() {
  showSplash();
  try {
    await startServer();
  } catch (error) {
    closeSplash();
    dialog.showErrorBox('Personel26 başlatılamadı', error && error.message ? error.message : String(error));
    app.exit(1);
    return;
  }
  createMainWindow();
}

async function shutdown() {
  if (shutdownStarted) return;
  shutdownStarted = true;
  closeSplash();
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
    // Kapanış yedeği PowerShell yerine sunucudan alınır; başarılıysa betik
    // yedeği atlanır, böylece antivirüsün engellediği zincir devreye girmez.
    const backedUp = await requestNativeBackup('close', 60_000);
    await stopServer({ skipBackup: backedUp });
    log('Uygulama kapatıldı ve kapanış yedeği kontrol edildi');
  } catch (error) {
    log(`Kapanış hatası: ${error && error.message ? error.message : error}`);
  }
  shutdownFinished = true;
  app.exit(0);
}

const gotLock = app.requestSingleInstanceLock({ args: argv });
if (!gotLock) {
  // Açık bir Personel26 varsa komutu ona iletir. Kapatma isteğinde kurulum
  // sihirbazı dosya değiştirmeden önce sunucunun gerçekten durmasını bekleriz.
  if (hasFlag('--stop')) {
    const port = readPort();
    const deadline = Date.now() + STOP_TIMEOUT_MS;
    const poll = async () => {
      if (Date.now() >= deadline || !(await healthy(port))) {
        app.exit(0);
        return;
      }
      setTimeout(poll, 500);
    };
    setTimeout(poll, 500);
  } else if (hasFlag('--backup')) {
    setTimeout(() => app.exit(0), 4000);
  } else {
    app.quit();
  }
} else {
  app.on('second-instance', (_event, commandLine, _workingDirectory, additionalData) => {
    const forwarded = Array.isArray(additionalData && additionalData.args)
      ? additionalData.args.map(String)
      : commandLine.slice(1).map(String);
    if (forwarded.includes('--stop')) {
      log('İkinci kopyadan kapatma isteği alındı');
      app.quit();
      return;
    }
    if (forwarded.includes('--backup')) {
      log('İkinci kopyadan yedek isteği alındı');
      void requestNativeBackup('create').then((done) => {
        if (!done) return runManager('Backup', [], BACKUP_TIMEOUT_MS);
      });
      return;
    }
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    log(`Electron başladı: ${argv.join(' ')}`);
    if (commandMode) return runCommand();
    registerDownloadRedirect();
    return runDesktop();
  }).catch((error) => {
    dialog.showErrorBox('Personel26 başlatılamadı', error && error.message ? error.message : String(error));
    app.exit(1);
  });

  if (!commandMode) {
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) runDesktop();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') app.quit();
    });

    app.on('before-quit', (event) => {
      if (shutdownFinished) return;
      event.preventDefault();
      void shutdown();
    });
  }
}

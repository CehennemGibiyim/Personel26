/**
 * Kurulum klasöründeki `backups` dizini.
 *
 * Windows kurulumunda dosyalar Personel26'nın kurulu olduğu klasörde tutulur
 * (`P26_ROOT`, varsayılan olarak kurulum kökü). Yedek, paketteki `pg_dump.exe`
 * doğrudan çalıştırılarak alınır; 7 günden eski yedekler temizlenir.
 *
 * PowerShell betiği bilinçli olarak kullanılmaz: antivirüs programları
 * `powershell.exe -ExecutionPolicy Bypass` zincirini ve betikten dosya yazmayı
 * sık sık engellediği için otomatik ve elle yedekler başarısız oluyordu.
 * Doğrudan pg_dump/psql çağrısı hem daha hızlı hem de imzalı PostgreSQL
 * araçlarıyla çalıştığı için antivirüs davranış korumalarına takılmaz.
 *
 * Bu modül yalnızca sunucuda kullanılır; GitHub Pages (statik) sürümünde
 * tarayıcı köprüsü bu ucu tanımaz.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appRoot, dataDir } from "@/lib/server/update";

export const BACKUP_RETENTION_DAYS = 7;
/** Kapanış yedeği bu süreden sık alınmaz (her sekme kapanışında yedek alınmasın). */
export const AUTO_BACKUP_INTERVAL_MS = 15 * 60 * 1000;

const AUTO_MARKER = ".last-auto-backup";
const BACKUP_EXT = ".sql";

export type BackupFile = {
  name: string;
  size: number;
  modifiedAt: string;
};

export type BackupFolderInfo = {
  supported: boolean;
  reason: string | null;
  folder: string | null;
  files: BackupFile[];
  retentionDays: number;
};

/** Yedek klasörü: açıkça tanımlıysa `P26_BACKUP_DIR`, yoksa kurulum kökü/backups. */
export function backupFolder(): string | null {
  const configured = process.env.P26_BACKUP_DIR?.trim();
  if (configured) return path.resolve(configured);
  const root = appRoot();
  return root ? path.join(root, "backups") : null;
}

/** Paketteki PostgreSQL araçlarının klasörü (`pg_dump.exe`, `psql.exe`). */
function pgBinDir(): string | null {
  const root = appRoot();
  if (!root) return null;
  const bin = path.join(root, "pgsql", "bin");
  return existsSync(path.join(bin, "pg_dump.exe")) ? bin : null;
}

function unsupportedReason(): string | null {
  if (process.platform !== "win32") return "Yedek klasörü yalnızca Windows kurulumunda kullanılabilir.";
  const root = appRoot();
  if (!root) return "Kurulum klasörü bulunamadı; bu çalışma biçiminde dosya yedeği alınamaz.";
  if (!pgBinDir()) return "Yedekleme araçları (pg_dump) bulunamadı; yeni kurulum paketiyle güncelleyin.";
  return null;
}

export function backupFolderInfo(): BackupFolderInfo {
  const folder = backupFolder();
  const reason = unsupportedReason();
  return {
    supported: !reason,
    reason,
    folder,
    files: folder && existsSync(folder) ? listBackupFiles(folder) : [],
    retentionDays: BACKUP_RETENTION_DAYS,
  };
}

/** Klasördeki SQL yedekleri (en yeni önce). */
export function listBackupFiles(folder: string): BackupFile[] {
  try {
    return readdirSync(folder)
      .filter(name => name.toLowerCase().endsWith(BACKUP_EXT))
      .map(name => {
        const full = path.join(folder, name);
        const stat = statSync(full);
        return { name, size: stat.size, modifiedAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
      .slice(0, 40);
  } catch {
    return [];
  }
}

function runProcess(command: string, args: string[], cwd: string, timeoutMs: number, env: NodeJS.ProcessEnv, failureLabel: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      env,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${failureLabel} zaman aşımına uğradı.`));
    }, timeoutMs);
    child.stdout?.on("data", chunk => { stdout += String(chunk); });
    child.stderr?.on("data", chunk => { stderr += String(chunk); });
    child.on("error", error => {
      clearTimeout(timer);
      reject(new Error(`${failureLabel} başlatılamadı: ${error.message}`));
    });
    child.on("close", code => {
      clearTimeout(timer);
      if (code === 0) return resolve(stdout);
      const detail = (stderr || stdout).trim().split(/\r?\n/).slice(-3).join(" ");
      reject(new Error(detail || `${failureLabel} başarısız oldu (kod ${code}).`));
    });
  });
}

/** `personel26-YYYYMMDD-HHmmss-fff.sql` (Personel26-Yonet.ps1 ile aynı ad düzeni). */
function backupStamp(): string {
  const now = new Date();
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}` +
    `-${pad(now.getMilliseconds(), 3)}`
  );
}

/** 7 günden eski otomatik yedekleri siler (Personel26-Yonet.ps1 ile aynı kural). */
function pruneOldBackups(folder: string): void {
  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let names: string[];
  try {
    names = readdirSync(folder);
  } catch {
    return;
  }
  for (const name of names) {
    if (!/^personel26-.*\.sql$/i.test(name)) continue;
    const full = path.join(folder, name);
    try {
      if (statSync(full).mtimeMs < cutoff) rmSync(full, { force: true });
    } catch {
      /* Dosya başka bir işlemce kullanılıyorsa sonraki yedekte yeniden denenir. */
    }
  }
}

/**
 * Dosya yazımı Windows güvenlik katmanı (antivirüs, kontrollü klasör erişimi)
 * tarafından engellendiğinde kullanıcıya ne yapacağını söyleyen mesaj üretir.
 */
function blockedBackupError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/EPERM|EACCES|EBUSY|permission denied|operation not permitted|access is denied|erişim engellendi/i.test(message)) {
    return new Error(
      "Yedek dosyası Windows veya antivirüs programı tarafından engellendi. " +
      "Personel26'yı antivirüsün izin listesine ekleyip yeniden deneyin.",
    );
  }
  return error instanceof Error ? error : new Error(message);
}

/**
 * `pg_dump.exe` doğrudan çalıştırılarak tam SQL yedeği üretir.
 *
 * PowerShell ya da komut kabuğu kullanılmaz; böylece antivirüslerin betik
 * motoru ve `-ExecutionPolicy Bypass` için uyguladığı engeller devreye girmez.
 * Yedek doğrudan hedef dosyaya yazılır, boş/yarım dosya bırakılmaz.
 */
export async function createFolderBackup(): Promise<{ file: string | null; folder: string }> {
  const reason = unsupportedReason();
  if (reason) throw new Error(reason);
  const root = appRoot();
  const folder = backupFolder();
  const bin = pgBinDir();
  if (!root || !folder || !bin) throw new Error("Yedek klasörü belirlenemedi.");
  const connection = pgConnection();
  mkdirSync(folder, { recursive: true });

  const target = path.join(folder, `personel26-${backupStamp()}.sql`);
  try {
    await runProcess(
      path.join(bin, "pg_dump.exe"),
      [
        "-h", "127.0.0.1", "-p", String(connection.port), "-U", connection.user,
        "-d", connection.database, "--clean", "--if-exists", "--no-owner", "--no-privileges",
        "-f", target,
      ],
      root,
      3 * 60 * 1000,
      { ...process.env, PGPASSWORD: connection.password, PGCONNECT_TIMEOUT: "15", PGCLIENTENCODING: "UTF8" },
      "Yedekleme",
    );
  } catch (error) {
    try { rmSync(target, { force: true }); } catch { /* yarım dosya kalabilir */ }
    throw blockedBackupError(error);
  }

  let size = 0;
  try {
    size = statSync(target).size;
  } catch (error) {
    throw blockedBackupError(error);
  }
  if (size === 0) {
    try { rmSync(target, { force: true }); } catch { /* boş dosya silinemedi */ }
    throw new Error("Yedek dosyası boş oluştu; antivirüs dosyayı engellemiş olabilir. Yeniden deneyin.");
  }

  pruneOldBackups(folder);
  return { file: target, folder };
}

/** Kapanışta otomatik yedek: 15 dakikada en fazla bir kez. */
let autoLock: Promise<{ skipped: boolean; file?: string | null }> | null = null;
export function autoBackupOnClose(): Promise<{ skipped: boolean; file?: string | null }> {
  if (autoLock) return autoLock;
  const promise = (async () => {
    const folder = backupFolder();
    if (!folder || unsupportedReason()) return { skipped: true };
    mkdirSync(folder, { recursive: true });
    const marker = path.join(folder, AUTO_MARKER);
    try {
      const last = Number(readFileSync(marker, "utf8").trim());
      if (Number.isFinite(last) && Date.now() - last < AUTO_BACKUP_INTERVAL_MS) return { skipped: true };
    } catch {
      /* ilk kapanış */
    }
    const result = await createFolderBackup();
    writeFileSync(marker, String(Date.now()), "utf8");
    return { skipped: false, file: result.file };
  })();
  autoLock = promise;
  promise.then(
    () => { autoLock = null; },
    () => { autoLock = null; },
  );
  return promise;
}

/** `data/connection.json` içindeki yerel PostgreSQL bağlantı bilgileri. */
type PgConnection = { user: string; password: string; database: string; port: number };

function pgConnection(): PgConnection {
  const dir = dataDir();
  if (!dir) throw new Error("Veri klasörü bulunamadı.");
  const file = path.join(dir, "connection.json");
  if (!existsSync(file)) throw new Error("Veritabanı bağlantı ayarları bulunamadı.");
  let raw: Record<string, unknown>;
  try {
    // Windows PowerShell 5.1 UTF-8 dosyalarina BOM ekler; JSON.parse BOM kabul etmez.
    raw = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")) as Record<string, unknown>;
  } catch {
    throw new Error("Veritabanı bağlantı ayarları okunamadı.");
  }
  const user = typeof raw.user === "string" ? raw.user : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  const database = typeof raw.database === "string" ? raw.database : "";
  const port = Number(raw.pgPort);
  if (!user || !password || !database || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Veritabanı bağlantı ayarları geçersiz.");
  }
  return { user, password, database, port };
}

/**
 * Seçilen SQL yedeğini `psql` ile geri yükler.
 *
 * Önce güvenlik yedeği alınır. Uygulama durdurulmadan, tek işlem içinde
 * (`--single-transaction`) geri yükleme yapılır; hata olursa veritabanı eski
 * hâlinde kalır. İşlem sonrası panelin yenilenmesi önerilir.
 */
export async function restoreFolderBackup(fileName: string): Promise<{ file: string; safety: string | null; folder: string }> {
  const reason = unsupportedReason();
  if (reason) throw new Error(reason);
  const root = appRoot();
  const folder = backupFolder();
  if (!root || !folder) throw new Error("Yedek klasörü belirlenemedi.");

  // Yalnızca yedek klasöründeki adlar; `..` veya alt dizin kabul edilmez.
  const name = path.basename(fileName);
  if (!name || name !== fileName || !name.toLowerCase().endsWith(BACKUP_EXT)) {
    throw new Error("Geçersiz yedek dosyası.");
  }
  const source = path.join(folder, name);
  if (!existsSync(source)) throw new Error("Yedek dosyası bulunamadı.");
  if (statSync(source).size === 0) throw new Error("Yedek dosyası boş.");

  const psql = path.join(root, "pgsql", "bin", "psql.exe");
  if (!existsSync(psql)) throw new Error("Pakette psql bulunamadı; yeni kurulum paketiyle güncelleyin.");
  const connection = pgConnection();

  const safety = await createFolderBackup();
  await runProcess(
    psql,
    [
      "-h", "127.0.0.1", "-p", String(connection.port), "-U", connection.user,
      "-d", connection.database, "-v", "ON_ERROR_STOP=1", "--single-transaction", "-f", source,
    ],
    root,
    5 * 60 * 1000,
    { ...process.env, PGPASSWORD: connection.password },
    "Geri yükleme",
  );

  return { file: source, safety: safety.file, folder };
}

/** Windows Gezgini'nde yedek klasörünü açar. */
export function openBackupFolder(): void {
  const folder = backupFolder();
  if (!folder) throw new Error("Yedek klasörü belirlenemedi.");
  mkdirSync(folder, { recursive: true });
  if (process.platform !== "win32") throw new Error("Klasör açma yalnızca Windows'ta kullanılabilir.");
  const child = spawn("explorer.exe", [folder], { detached: true, stdio: "ignore", windowsHide: false });
  child.unref();
}

/**
 * Sunucu taraflı güncelleme denetimi ve uygulama hazırlığı.
 *
 * Akış:
 *   1. Uygulama, GitHub sürümündeki `update.json` beslemesini okur.
 *   2. Sürüm karşılaştırılır; ara sürümler atlanarak en son sürüme geçilebilir.
 *   3. Paket, SHA-256 doğrulamasıyla indirilir (bkz. Personel26-Guncelle.ps1).
 *   4. Windows betiği veritabanını yedekler, uygulamayı değiştirir, sağlık
 *      kontrolü yapar ve başarısız olursa eski sürüme döner.
 *
 * Bu modül yalnızca sunucuda (Node.js çalışma zamanı) kullanılır.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { APP_VERSION, BROWSER_ONLY, DEFAULT_UPDATE_FEED } from "@/lib/app-info";
import type { UpdateAutoUpdateInfo, UpdateCheckResult, UpdateStatus } from "@/lib/update-types";
import {
  compareVersions,
  isNewerVersion,
  newerReleases,
  parseVersion,
  type UpdateManifest,
  type UpdatePackage,
  type UpdateRelease,
} from "@/lib/version-utils";

const ROOT_SCRIPT = "Personel26-Yonet.ps1";
const UPDATER_SCRIPT = "Personel26-Guncelle.ps1";
const FEED_TIMEOUT_MS = 20_000;
/** Durum dosyası bu süreden uzun süredir güncellenmiyorsa yarıda kalmış sayılır. */
const STALE_STATUS_MS = 20 * 60 * 1000;

const RUNNING_STATES = new Set(["downloading", "verifying", "extracting", "stopping", "backing-up", "installing", "restarting"]);

export type PendingUpdate = {
  from: string;
  to: string;
  url?: string;
  /** Yerel ZIP (çevrimdışı/test) — API tarafından kullanılmaz, betik destekler. */
  path?: string;
  sha256: string;
  size?: number;
  fileName?: string;
  createdAt: string;
};

/** Kurulum kökü: Personel26-Yonet.ps1'in bulunduğu klasör (taşınabilir paket). */
export function appRoot(): string | null {
  const configured = process.env.P26_ROOT?.trim();
  if (configured && existsSync(path.join(configured, ROOT_SCRIPT))) return path.resolve(configured);
  const candidate = path.resolve(process.cwd(), "..");
  if (existsSync(path.join(candidate, ROOT_SCRIPT))) return candidate;
  return null;
}

/** Veri klasörü; taşınabilir kurulum dışında null. */
export function dataDir(): string | null {
  const configured = process.env.P26_DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  const root = appRoot();
  return root ? path.join(root, "data") : null;
}

export function autoUpdateInfo(): UpdateAutoUpdateInfo {
  if (BROWSER_ONLY) {
    return { supported: false, reason: "Tarayıcı (GitHub Pages) sürümünde uygulama dosyaları güncellenemez; yeni sürümü elle indirin." };
  }
  if (process.platform !== "win32") {
    return { supported: false, reason: "Otomatik güncelleme yalnızca Windows kurulumunda kullanılabilir." };
  }
  const root = appRoot();
  if (!root) {
    return { supported: false, reason: "Bu çalışma biçiminde otomatik güncelleme desteklenmiyor (geliştirme veya web sürümü)." };
  }
  if (!existsSync(path.join(root, UPDATER_SCRIPT))) {
    return { supported: false, reason: "Güncelleme yardımcı betiği bulunamadı; yeni kurulum paketiyle güncelleyin." };
  }
  return { supported: true, reason: null };
}

export function feedUrl(): string {
  const configured = process.env.P26_UPDATE_FEED?.trim();
  const value = configured || DEFAULT_UPDATE_FEED;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Güncelleme adresi geçersiz.");
  }
  if (!isSafeUrl(parsed)) {
    throw new Error("Güncelleme adresi HTTPS olmalıdır.");
  }
  return parsed.href;
}

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

/** Besleme ve paket adresleri yalnızca HTTPS (yerel geliştirme için HTTP loopback). */
function isSafeUrl(url: URL): boolean {
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && isLoopback(url.hostname);
}

function readJson<T>(file: string | null): T | null {
  if (!file || !existsSync(file)) return null;
  try {
    // Windows PowerShell 5.1 UTF-8 dosyalarina BOM ekler; JSON.parse BOM kabul etmez.
    return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")) as T;
  } catch {
    return null;
  }
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const target = `${file}.${process.pid}.tmp`;
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  // Aynı klasörde atomik yer değiştirme: yarım yazılmış JSON okunmaz.
  try {
    renameSync(target, file);
  } catch (error) {
    rmSync(target, { force: true });
    throw error;
  }
}

function requireString(value: unknown, field: string, maxLength = 4000): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Güncelleme dosyasında "${field}" alanı eksik.`);
  if (value.length > maxLength) throw new Error(`Güncelleme dosyasında "${field}" alanı çok uzun.`);
  return value.trim();
}

function optionalString(value: unknown, maxLength = 4000): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function parseReleases(value: unknown): UpdateRelease[] {
  if (!Array.isArray(value)) return [];
  const releases: UpdateRelease[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const version = optionalString(raw.version, 40);
    if (!version || !parseVersion(version)) continue;
    const notes = Array.isArray(raw.notes)
      ? raw.notes.filter((note): note is string => typeof note === "string").map(note => note.slice(0, 600)).slice(0, 40)
      : undefined;
    const kind = ["feature", "fix", "security", "maintenance"].includes(String(raw.kind)) ? (raw.kind as UpdateRelease["kind"]) : undefined;
    releases.push({
      version,
      kind,
      title: optionalString(raw.title, 200),
      date: optionalString(raw.date, 40),
      notes,
    });
  }
  return releases;
}

function parsePackage(value: unknown): UpdatePackage {
  if (!value || typeof value !== "object") throw new Error("Güncelleme paketi bilgisi eksik.");
  const raw = value as Record<string, unknown>;
  const url = requireString(raw.url, "package.url");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Güncelleme paketi adresi geçersiz.");
  }
  if (!isSafeUrl(parsed)) throw new Error("Güncelleme paketi adresi HTTPS olmalıdır.");
  const sha256 = requireString(raw.sha256, "package.sha256", 64);
  if (!/^[a-f0-9]{64}$/i.test(sha256)) throw new Error("Güncelleme paketi SHA-256 özeti geçersiz.");
  const size = typeof raw.size === "number" && Number.isFinite(raw.size) && raw.size > 0 ? Math.round(raw.size) : undefined;
  return {
    url: parsed.href,
    sha256: sha256.toLowerCase(),
    size,
    fileName: optionalString(raw.fileName, 200) ?? "Personel26-Portable.zip",
  };
}

/** Besleme dosyasını doğrular; bilinmeyen/eksik alanlarda Türkçe hata verir. */
export function parseManifest(raw: unknown): UpdateManifest {
  if (!raw || typeof raw !== "object") throw new Error("Güncelleme dosyası okunamadı.");
  const data = raw as Record<string, unknown>;
  if (data.schema !== 1) throw new Error("Güncelleme dosyası sürümü desteklenmiyor.");
  if (data.app !== "Personel26") throw new Error("Güncelleme dosyası bu uygulamaya ait değil.");
  const version = requireString(data.version, "version", 40);
  if (!parseVersion(version)) throw new Error("Güncelleme dosyasındaki sürüm numarası geçersiz.");
  const minSupportedVersion = optionalString(data.minSupportedVersion, 40);
  if (minSupportedVersion && !parseVersion(minSupportedVersion)) throw new Error("En düşük desteklenen sürüm geçersiz.");
  const releases = parseReleases(data.releases);
  const notes = Array.isArray(data.notes)
    ? data.notes.filter((note): note is string => typeof note === "string").map(note => note.slice(0, 600)).slice(0, 40)
    : undefined;
  return {
    schema: 1,
    app: "Personel26",
    version,
    releasedAt: optionalString(data.releasedAt, 40),
    kind: ["feature", "fix", "security", "maintenance"].includes(String(data.kind)) ? (data.kind as UpdateManifest["kind"]) : undefined,
    title: optionalString(data.title, 200),
    notes,
    schemaVersion: optionalString(data.schemaVersion, 40),
    minSupportedVersion,
    releases: releases.length ? releases : undefined,
    package: parsePackage(data.package),
  };
}

async function fetchManifest(url: string): Promise<UpdateManifest> {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: { accept: "application/json", "user-agent": `Personel26/${APP_VERSION}` },
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    });
  } catch {
    throw new Error("Güncelleme sunucusuna ulaşılamadı. İnternet bağlantınızı kontrol edin.");
  }
  if (!response.ok) {
    throw new Error(`Güncelleme bilgisi alınamadı (HTTP ${response.status}). Daha sonra tekrar deneyin.`);
  }
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new Error("Güncelleme dosyası JSON biçiminde değil.");
  }
  return parseManifest(raw);
}

/** Mevcut sürüme göre denetim sonucunu üretir. */
export function buildCheckResult(manifest: UpdateManifest, current = APP_VERSION): UpdateCheckResult {
  const latest = manifest.version;
  const releaseList = newerReleases(
    manifest.releases?.length
      ? manifest.releases
      : [{ version: latest, kind: manifest.kind, title: manifest.title, date: manifest.releasedAt, notes: manifest.notes }],
    current,
  );
  const minSupported = manifest.minSupportedVersion ?? null;
  const blocked = minSupported && compareVersions(current, minSupported) < 0
    ? `Kurulu sürümünüz (${current}) doğrudan güncelleme için çok eski. En az ${minSupported} sürümü gerekir; lütfen tam kurulum paketini kullanın.`
    : null;
  return {
    checkedAt: new Date().toISOString(),
    currentVersion: current,
    latestVersion: latest,
    updateAvailable: isNewerVersion(latest, current),
    releases: releaseList,
    latestKind: releaseList[0]?.kind ?? manifest.kind ?? null,
    skippedVersions: releaseList.map(release => release.version).filter(version => version !== latest),
    minSupportedVersion: minSupported,
    blocked,
    package: {
      url: manifest.package.url,
      size: manifest.package.size ?? null,
      fileName: manifest.package.fileName ?? null,
      sha256: manifest.package.sha256,
    },
    feed: feedUrl(),
  };
}

function lastCheckFile(): string | null {
  const dir = dataDir();
  return dir ? path.join(dir, "update-check.json") : null;
}

export function readLastCheck(): UpdateCheckResult | null {
  const value = readJson<UpdateCheckResult>(lastCheckFile());
  if (!value || typeof value.checkedAt !== "string" || typeof value.latestVersion !== "string") return null;
  return value;
}

/** Denetim sonucunu diske yazar; yazılamazsa denetim yine de başarılıdır. */
export function rememberCheck(result: UpdateCheckResult): void {
  const file = lastCheckFile();
  if (!file) return;
  try {
    writeJson(file, result);
  } catch {
    /* disk izni yoksa denetim sonucu yalnızca yanıtla döner */
  }
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const manifest = await fetchManifest(feedUrl());
  const result = buildCheckResult(manifest, APP_VERSION);
  rememberCheck(result);
  return result;
}

function statusFile(): string | null {
  const dir = dataDir();
  return dir ? path.join(dir, "update-status.json") : null;
}

export function readStatus(): UpdateStatus | null {
  const status = readJson<UpdateStatus>(statusFile());
  if (!status || typeof status.state !== "string" || typeof status.message !== "string") return null;
  return status;
}

export function isRunningState(state: string | undefined): boolean {
  return !!state && RUNNING_STATES.has(state);
}

/** Durum dosyası güncelleme sürerken bayatladıysa true (betik çökmüş olabilir). */
export function isStaleStatus(status: UpdateStatus | null): boolean {
  if (!status || !isRunningState(status.state)) return false;
  const stamp = Date.parse(status.updatedAt ?? status.startedAt ?? "");
  return Number.isFinite(stamp) ? Date.now() - stamp > STALE_STATUS_MS : true;
}

export function updateLogTail(maxChars = 4000): string | null {
  const dir = dataDir();
  if (!dir) return null;
  const file = path.join(dir, "updates", "update.log");
  try {
    const size = statSync(file).size;
    if (!size) return null;
    const raw = readFileSync(file, "utf8");
    return raw.slice(-maxChars).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Güncelleme betiğini ayrı bir PowerShell sürecinde başlatır. Süreç, uygulama
 * kapansa da devam eder; ilerleme `data/update-status.json` üzerinden izlenir.
 */
export function startUpdater(pending: PendingUpdate): number {
  const root = appRoot();
  if (!root) throw new Error("Kurulum klasörü bulunamadı.");
  const dir = dataDir();
  if (!dir) throw new Error("Veri klasörü bulunamadı.");
  const pendingFile = path.join(dir, "updates", "pending.json");
  writeJson(pendingFile, pending);
  const script = path.join(root, UPDATER_SCRIPT);
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", script, "-PendingFile", pendingFile],
    { cwd: root, detached: true, stdio: "ignore", windowsHide: true },
  );
  child.unref();
  return child.pid ?? 0;
}

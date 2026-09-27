/**
 * Tarayıcı içi PostgreSQL (PGlite) — yalnızca GitHub Pages sürümünde kullanılır.
 * Veriler tarayıcının IndexedDB'sinde kalıcıdır ("idb://personel26").
 *
 * PGlite paketi derleyiciye (bundler) sokulmaz: public/pglite/ altına kopyalanmış
 * dağıtım dosyaları çalışma anında yüklenir. Böylece WASM dosyaları kendi
 * konumlarından sorunsuz bulunur.
 */

type PGliteLike = {
  waitReady: Promise<void>;
  query: (sql: string, params?: unknown[], opts?: Record<string, unknown>) => Promise<{ rows: unknown[] }>;
  exec: (sql: string) => Promise<unknown>;
};

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * node-postgres + drizzle ile aynı davranış: tarih/saat ve büyük sayı tipleri
 * ham metin olarak döner (uygulama kodu "2026-09-01" gibi metin bekler).
 */
const identity = (v: string) => v;
export const RAW_PARSERS: Record<number, (v: string) => string> = {
  1082: identity, // date
  1083: identity, // time
  1114: identity, // timestamp
  1184: identity, // timestamptz
  1186: identity, // interval
  20: identity,   // int8
  1700: identity, // numeric
};

let instance: Promise<PGliteLike> | null = null;

export function getPGlite(): Promise<PGliteLike> {
  if (!instance) instance = init();
  return instance;
}

// Derleyicinin bu import'u paketlemeye çalışmaması için dinamik fonksiyon
const runtimeImport = new Function("u", "return import(u)") as (u: string) => Promise<Record<string, unknown>>;

async function init(): Promise<PGliteLike> {
  const mod = await runtimeImport(`${window.location.origin}${BASE}/pglite/index.js`);
  const PGlite = mod.PGlite as new (dataDir: string) => PGliteLike;
  const pg = new PGlite("idb://personel26");
  await pg.waitReady;

  // İlk açılış: tablolar yoksa şemayı kur
  const r = await pg.query("select to_regclass('public.departments') as t");
  const exists = (r.rows[0] as { t: unknown } | undefined)?.t;
  if (!exists) {
    const res = await fetch(`${BASE}/schema.sql`, { cache: "no-store" });
    if (!res.ok) throw new Error("Veritabanı şeması yüklenemedi (schema.sql).");
    await pg.exec(await res.text());
  }
  return pg;
}

/** Tarayıcı veritabanını tamamen siler (yeniden örnek verilerle başlar). */
export async function resetBrowserDatabase(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("/pglite/personel26");
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

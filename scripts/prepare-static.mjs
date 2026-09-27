/**
 * GitHub Pages derlemesi öncesi hazırlık:
 *  1) PGlite (tarayıcı PostgreSQL) dağıtım dosyalarını public/pglite/ altına kopyalar
 *  2) Veritabanı şemasını public/schema.sql olarak hazırlar (tarayıcıda ilk açılışta kurulur)
 *
 * Kullanım:  node scripts/prepare-static.mjs
 * Sonra:     STATIC_EXPORT=1 PAGES_BASE_PATH=/DEPO-ADI npx next build   → out/ klasörü
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "@electric-sql", "pglite", "dist");
const dst = join(root, "public", "pglite");

if (!existsSync(src)) {
  console.error("HATA: @electric-sql/pglite bulunamadı. Önce `npm install` çalıştırın.");
  process.exit(1);
}

// 1) PGlite — eklenti arşivleri (*.tar.gz) ve kaynak haritaları (*.map) gereksiz
rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
let bytes = 0, files = 0;
function copyDir(from, to) {
  for (const name of readdirSync(from)) {
    if (name.endsWith(".tar.gz") || name.endsWith(".map") || name.endsWith(".d.ts") || name.endsWith(".d.cts") || name.endsWith(".cjs")) continue;
    const a = join(from, name), b = join(to, name);
    if (statSync(a).isDirectory()) { mkdirSync(b, { recursive: true }); copyDir(a, b); }
    else { cpSync(a, b); bytes += statSync(a).size; files++; }
  }
}
copyDir(src, dst);
console.log(`PGlite: ${files} dosya, ${(bytes / 1024 / 1024).toFixed(1)} MB → public/pglite/`);

// 2) Şema — pg_dump'a özgü oturum ayarları tarayıcıda sorun çıkarır, temizlenir.
//    Özellikle search_path'i boşaltan set_config satırı kaldırılmalı (PGlite tek oturumdur).
const schema = readFileSync(join(root, "windows", "schema.sql"), "utf8")
  .split("\n")
  .filter(l => !/^SELECT pg_catalog\.set_config\('search_path'/.test(l))
  .filter(l => !/^SET (statement_timeout|lock_timeout|idle_in_transaction_session_timeout|transaction_timeout|client_encoding|standard_conforming_strings|check_function_bodies|xmloption|client_min_messages|row_security|default_tablespace|default_table_access_method)/.test(l))
  .filter(l => !/^\\/.test(l))
  .join("\n");
writeFileSync(join(root, "public", "schema.sql"), schema);
console.log(`Şema: ${(schema.match(/CREATE TABLE/g) || []).length} tablo → public/schema.sql`);

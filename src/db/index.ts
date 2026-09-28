import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

/**
 * Next.js build aşamasında bazı API route'ları import edilir ama çalıştırılmaz.
 * DATABASE_URL yok diye modül yüklenirken throw etmek `next build`'i (Windows
 * paketleyici ve GitHub/Vercel CI dahil) tamamen durduruyordu.
 *
 * Artık import/build güvenlidir. Gerçek DB sorgusu, sadece çalışma anında
 * eksik URL varsa hızlıca reddedilen localhost portuna gider; API katmanları
 * bunu anlaşılır 503 hata mesajına dönüştürür.
 */
export const databaseConfigured = Boolean(databaseUrl?.trim());
const connectionString = databaseConfigured
  ? databaseUrl!
  : "postgresql://missing:missing@127.0.0.1:1/database_url_not_configured";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

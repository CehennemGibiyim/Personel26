import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// GitHub Pages sürümünde (NEXT_PUBLIC_STATIC_MODE=1) `pg` ve `drizzle-orm/node-postgres`
// tarayıcı uyarlamalarına yönlendirilir; bağlantı adresi kullanılmaz.
const isStaticMode = process.env.NEXT_PUBLIC_STATIC_MODE === "1";
const databaseUrl = process.env.DATABASE_URL ?? (isStaticMode ? "pglite://tarayici" : undefined);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

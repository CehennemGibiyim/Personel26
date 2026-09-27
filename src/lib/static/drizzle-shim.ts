/**
 * GitHub Pages sürümü: `drizzle-orm/node-postgres` yerine geçer.
 * Aynı `drizzle()` imzası, fakat sorgular tarayıcıdaki PGlite'a gider
 * (drizzle'ın pg-proxy sürücüsü üzerinden). Uygulama kodu hiç değişmez.
 */
import { drizzle as proxyDrizzle } from "drizzle-orm/pg-proxy";
import { getPGlite, RAW_PARSERS } from "./pglite";

export function drizzle(..._args: unknown[]) {
  return proxyDrizzle(async (sql, params, method) => {
    const pg = await getPGlite();
    const res = await pg.query(sql, params, {
      rowMode: method === "all" ? "array" : "object",
      parsers: RAW_PARSERS,
    });
    return { rows: res.rows as unknown[] };
  });
}

export default { drizzle };

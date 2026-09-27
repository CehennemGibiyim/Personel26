import type { NextConfig } from "next";

/**
 * İki derleme modu:
 *  1) Normal (varsayılan): Next.js sunucusu + PostgreSQL. Windows paketi bunu kullanır
 *     (output: "standalone").
 *  2) GitHub Pages (STATIC_EXPORT=1): tamamen statik site. Veritabanı tarayıcıda
 *     çalışan PGlite'tır (WASM PostgreSQL, veriler IndexedDB'de saklanır). API
 *     kodları aynen tarayıcıda çalışır; `pg` ve `drizzle-orm/node-postgres`
 *     tarayıcı uyarlamalarına yönlendirilir.
 *     Yalnızca *.gh.tsx dosyaları sayfa sayılır (route.ts API'leri derlenmez).
 */
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = (process.env.PAGES_BASE_PATH ?? "").replace(/\/$/, "");

const staticConfig: NextConfig = {
  output: "export",
  distDir: "out",
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  pageExtensions: ["gh.tsx"],
  env: {
    NEXT_PUBLIC_STATIC_MODE: "1",
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  turbopack: {
    resolveAlias: {
      pg: "./src/lib/static/pg-shim.ts",
      "drizzle-orm/node-postgres": "./src/lib/static/drizzle-shim.ts",
    },
  },
};

const serverConfig: NextConfig = {
  // Windows taşınabilir paket için: node_modules olmadan çalışan
  // bağımsız sunucu çıktısı (.next/standalone) üretir.
  output: "standalone",
};

export default isStatic ? staticConfig : serverConfig;

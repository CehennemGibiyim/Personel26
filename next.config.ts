import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/**
 * İki derleme modu vardır:
 *
 * 1. Varsayılan (sunuculu) — `npm run build`
 *    `output: "standalone"`: Windows taşınabilir paketi için node_modules
 *    olmadan çalışan bağımsız sunucu çıktısı üretir. Vercel/Neon kurulumu da
 *    bu modu kullanır (PostgreSQL sunucu tarafındadır).
 *
 * 2. GitHub Pages (statik) — `npm run pages:build`
 *    `output: "export"`: sunucusuz statik site üretir. Bu modda API rotaları
 *    (`route.ts`) devre dışı bırakılır (pageExtensions) ve panel, veritabanını
 *    tarayıcıda çalıştırır (PGlite + IndexedDB) — bkz. src/lib/browser-db/.
 */
const staticPages = process.env.P26_STATIC_EXPORT === "1";
const basePath = (process.env.P26_BASE_PATH ?? "").replace(/\/$/, "");

/**
 * Sürümün tek kaynağı package.json'dur. Windows paketleyici ve arayüz aynı
 * değeri kullanır; burada derlemeye gömülür.
 */
function appVersion(): string {
  try {
    const raw = readFileSync(path.join(process.cwd(), "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const version = appVersion();

/** Web sürümü adresi; özel alan adı kullanılıyorsa P26_WEB_URL ile değiştirilir. */
const webUrl = process.env.P26_WEB_URL?.trim();

/** Her iki derleme modunda da arayüze taşınan ortak değerler. */
const sharedEnv = {
  NEXT_PUBLIC_P26_VERSION: version,
  ...(webUrl ? { NEXT_PUBLIC_P26_WEB_URL: webUrl } : {}),
};

const nextConfig: NextConfig = staticPages
  ? {
      output: "export",
      distDir: ".next-pages",
      // Sunucu taraflı API rotaları statik dışa aktarımda kullanılamaz; panel
      // bu uçları tarayıcı içindeki köprüden çalıştırır.
      pageExtensions: ["tsx"],
      basePath: basePath || undefined,
      trailingSlash: true,
      images: { unoptimized: true },
      env: {
        ...sharedEnv,
        NEXT_PUBLIC_P26_BROWSER_DB: "1",
        NEXT_PUBLIC_P26_BASE_PATH: basePath,
      },
    }
  : {
      // Windows taşınabilir paket için: node_modules olmadan çalışan
      // bağımsız sunucu çıktısı (.next/standalone) üretir.
      output: "standalone",
      env: sharedEnv,
    };

export default nextConfig;

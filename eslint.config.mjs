import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  globalIgnores([
    ".next/**",
    ".next-pages/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Derleme/dağıtım çıktıları (scripts/pages-*.mjs üretir)
    "_site/**",
    ".pages-build/**",
    ".pg-ddl/**",
  ]),
  {
    // Köprü betiği bilinçli olarak senkron gömülür: modül betiği (pglite/app.js)
    // çözülecek sözü yalnızca bu betik çalıştıktan sonra bulabilir.
    // (Yalnızca GitHub Pages derlemesinde sayfaya eklenir.)
    files: ["src/app/layout.tsx"],
    rules: { "@next/next/no-sync-scripts": "off" },
  },
  {
    rules: {
      // Panelin veri yükleme deseni (mount sonrası fetch + state) bu yeni
      // React Compiler kuralında hata olarak çıkıyor. Mevcut ve bilinçli desen
      // olduğundan uyarı seviyesinde tutuluyor; refactor ayrı bir iş olarak
      // ele alınmalı (bkz. AppShell, sayfa bileşenleri).
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

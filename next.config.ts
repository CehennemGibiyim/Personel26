import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Windows taşınabilir paket için: node_modules olmadan çalışan
  // bağımsız sunucu çıktısı (.next/standalone) üretir.
  output: "standalone",
};

export default nextConfig;

"use client";
/**
 * GitHub Pages sürümü ana sayfa (yalnızca STATIC_EXPORT=1 derlemesinde sayfa sayılır).
 * Sunucu sürümündeki page.tsx ile aynı arayüz; veri tarayıcı içi PGlite'tan gelir.
 */
import { useCallback } from "react";
import StaticBoot from "@/components/StaticBoot";
import AppShell, { type BootstrapPayload } from "@/components/AppShell";

export default function StaticHome() {
  const preload = useCallback(async () => {
    const r = await fetch("/api/bootstrap", { cache: "no-store" });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Açılış verisi alınamadı");
    const now = new Date();
    return { ...data, today: { year: now.getFullYear(), month: now.getMonth() } };
  }, []);

  return (
    <StaticBoot preload={preload}>
      {(d) => <AppShell initialData={d as BootstrapPayload} />}
    </StaticBoot>
  );
}

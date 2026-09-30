"use client";
import { useEffect } from "react";
import { applyTheme } from "@/lib/themes";
import { type AppSettings, publishSettings } from "@/lib/settings";
export default function ThemeLoader() {
  useEffect(() => {
    function apply(settings: AppSettings) { applyTheme(settings.theme, settings.compact, settings.reducedMotion); }
    try { const local = localStorage.getItem("p26-settings"); if (local) apply(JSON.parse(local)); } catch { /* Yerel tercih bozulmuşsa sunucu tercihi kullanılır. */ }
    const listener = (event: Event) => apply((event as CustomEvent<AppSettings>).detail);
    window.addEventListener("p26-settings", listener);
    fetch("/api/settings").then(async response => { if (!response.ok) return; const data = await response.json(); apply(data.settings); publishSettings(data.settings); }).catch(() => {});
    return () => window.removeEventListener("p26-settings", listener);
  }, []);
  return null;
}

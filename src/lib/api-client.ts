"use client";
import { useEffect, useState } from "react";

/**
 * Sunucu sürümü ve GitHub Pages (tarayıcı veritabanı) sürümünde
 * aynı şekilde çalışan istemci yardımcıları.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_MODE === "1";

/** Statik dosya / sayfa yoluna GitHub Pages alt klasörünü ekler. */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}

/**
 * API'den dosya indirir (Excel/CSV/JSON yedek).
 * fetch → blob → indirme bağlantısı: sayfa gezinmesi yapmadığı için hem
 * sunucu sürümünde hem tarayıcı içi API'de çalışır.
 */
export async function downloadFromApi(url: string, fallbackName = "dosya"): Promise<void> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    let msg = `İndirme başarısız (${res.status})`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* yok say */ }
    alert(msg);
    return;
  }
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = cd.match(/filename\*=UTF-8''([^;]+)/i) ?? cd.match(/filename="?([^";]+)"?/i);
  let name = fallbackName;
  if (m) { try { name = decodeURIComponent(m[1]); } catch { name = m[1]; } }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}

/**
 * API'den gelen görseller (profil fotoğrafı) için adres.
 * Sunucu sürümünde adresi aynen döner; tarayıcı veritabanı sürümünde
 * görseli fetch ile alıp geçici blob adresine çevirir (img etiketi fetch'ten geçmez).
 */
export function useApiImage(src: string | null): string | null {
  const [resolved, setResolved] = useState<string | null>(IS_STATIC ? null : src);
  useEffect(() => {
    if (!IS_STATIC) { setResolved(src); return; }
    if (!src) { setResolved(null); return; }
    let alive = true;
    let objectUrl: string | null = null;
    fetch(src).then(r => (r.ok ? r.blob() : null)).then(b => {
      if (!alive || !b) return;
      objectUrl = URL.createObjectURL(b);
      setResolved(objectUrl);
    }).catch(() => {});
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);
  return resolved;
}

"use client";
/**
 * Uç noktalardan dosya indirme yardımcıları.
 *
 * `window.location.href = "/api/..."` yaklaşımı GitHub Pages gibi statik
 * yayınlarda çalışmaz (sunucu yok); bu yüzden indirmeler `fetch` + blob
 * akışıyla yapılır — tarayıcı köprüsü bu isteği yakalayıp veritabanından
 * üretir. Sunuculu sürümde de aynı şekilde çalışır.
 */

/** Sunucunun gönderdiği Content-Disposition başlığından dosya adını okur. */
export function filenameFromResponse(res: Response, fallback: string): string {
  const header = res.headers.get("content-disposition");
  if (!header) return fallback;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* yok say */
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : fallback;
}

/** Bir blob'u dosya olarak indirir. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * `/api/...` ucundan üretilen dosyayı indirir (Excel, CSV, PDF, JSON).
 * Hata durumunda açıklayıcı bir mesaj fırlatır.
 */
export async function downloadFromApi(url: string, fallbackName: string): Promise<void> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    let detail = `Sunucu hatası (${res.status})`;
    try {
      const data = await res.clone().json();
      if (data?.error) detail = String(data.error);
    } catch {
      /* JSON değilse varsayılan mesaj */
    }
    throw new Error(detail);
  }
  const blob = await res.blob();
  if (!blob.size) throw new Error("Boş dosya alındı");
  saveBlob(blob, filenameFromResponse(res, fallbackName));
}

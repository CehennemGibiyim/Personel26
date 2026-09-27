/**
 * Zaman aşımlı JSON getirme — hiçbir isteğin sonsuza kadar asılı kalmamasını sağlar.
 * Hata mesajları kullanıcıya gösterilebilir niteliktedir.
 */
export async function fetchJson<T = unknown>(url: string, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `İstek başarısız (HTTP ${res.status})`;
      throw new Error(msg);
    }
    if (data === null) throw new Error("Sunucudan geçersiz yanıt alındı.");
    return data as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Sunucu yanıt vermedi (zaman aşımı).");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** JSON isteği; başarısız olursa null döner (hafif veriler için). */
export async function fetchJsonSafe<T = unknown>(url: string, timeoutMs = 15000): Promise<T | null> {
  try {
    return await fetchJson<T>(url, timeoutMs);
  } catch {
    return null;
  }
}

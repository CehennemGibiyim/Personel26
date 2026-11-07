/**
 * Panel içinde güncelleme denetiminin tek bir istekte paylaşılması.
 *
 * Hem kenar çubuğundaki rozet hem de Ayarlar → Güncellemeler kartı aynı
 * sonucu kullanır; panel açılışında yalnızca bir kez GitHub'a gidilir.
 * Kullanıcı "Güncellemeleri denetle" derse `force` ile yeniden sorgulanır.
 */
import type { UpdateCheckResult } from "@/lib/update-types";

let cached: UpdateCheckResult | null = null;
let pending: Promise<UpdateCheckResult> | null = null;

export function fetchUpdateCheck(force = false): Promise<UpdateCheckResult> {
  if (!force && cached) return Promise.resolve(cached);
  if (pending) return pending;
  const request = (async () => {
    const response = await fetch("/api/update/check", { method: "POST", cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error ?? "Güncelleme denetlenemedi.");
    cached = data as UpdateCheckResult;
    return cached;
  })();
  pending = request.finally(() => { pending = null; });
  return pending;
}

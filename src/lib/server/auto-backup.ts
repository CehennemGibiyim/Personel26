/**
 * Personel26'da veri değiştiren personel/servis işlemlerinden sonra kurulum
 * klasöründeki `backups` dizinine otomatik SQL yedeği yazdırır.
 *
 * İşlem yanıtını bekletmemek için kısa bir debounce kullanılır: aynı anda
 * yapılan birkaç değişiklik tek yedekte toplanır. Yedekleme yalnızca Windows
 * kurulumunda (Personel26-Yonet.ps1 ve pg_dump bulunan pakette) çalışır.
 */
import { backupFolderInfo, createFolderBackup } from "@/lib/server/backup-folder";

const DEBOUNCE_MS = 1200;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let dirty = false;

export function scheduleMutationBackup(): void {
  if (typeof process === "undefined" || process.platform !== "win32") return;
  try {
    if (!backupFolderInfo().supported) return;
  } catch {
    return;
  }

  dirty = true;
  if (timer || running) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, DEBOUNCE_MS);
  // Sunucu kapanırken bekleyen zamanlayıcı süreci askıda bırakmasın.
  timer.unref?.();
}

async function flush(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (dirty) {
      dirty = false;
      try {
        await createFolderBackup();
      } catch (error) {
        console.warn("[auto-backup]", error instanceof Error ? error.message : error);
      }
    }
  } finally {
    running = false;
    if (dirty) scheduleMutationBackup();
  }
}

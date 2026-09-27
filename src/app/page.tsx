import AppShell from "@/components/AppShell";
import { ensureSeeded, getBootstrap } from "@/lib/server/core";
import type { BootstrapData } from "@/lib/shared";

export const dynamic = "force-dynamic";

/**
 * Açılış verisi SUNUCUDAN çekilir ve sayfa HTML'i ile birlikte gelir.
 * Tarayıcının ayrıca istek atıp beklemesi gerekmez; bu yüzden
 * "yükleniyor" ekranında takılma yaşanmaz.
 */
async function fetchBootstrap(): Promise<BootstrapData> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await ensureSeeded();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Veriler sunucudan alınamadı (zaman aşımı). Try the build again.")),
        25000,
      );
    });
    return (await Promise.race([getBootstrap(), timeout])) as BootstrapData;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default async function Home() {
  let initialData: BootstrapData | null = null;
  let initialError: string | null = null;
  try {
    initialData = await fetchBootstrap();
  } catch (e) {
    initialError = e instanceof Error ? e.message : "Açılış verisi alınamadı.";
  }
  return <AppShell initialData={initialData} initialError={initialError} />;
}

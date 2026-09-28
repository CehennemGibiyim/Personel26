import { ensureSeeded, getBootstrap, ensureDailyBackup } from "@/lib/server/core";
import AppShell, { type BootstrapPayload } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Sunucu tarafında veriyi hazırla; olası bir hata sayfayı düşürmesin —
  // istemci tarafı yedek yükleme (loadBootstrap) devreye girer.
  let data: BootstrapPayload | undefined;
  try {
    await ensureSeeded();
    ensureDailyBackup().catch(() => {});
    const boot = await getBootstrap();
    const now = new Date();
    data = {
      ...(boot as unknown as BootstrapPayload),
      today: { year: now.getFullYear(), month: now.getMonth() },
    };
  } catch {
    data = undefined;
  }
  return <AppShell initialData={data} />;
}

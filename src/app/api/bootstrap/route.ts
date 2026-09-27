import { ensureSeeded, getBootstrap, ensureDailyBackup } from "@/lib/server/core";

export const dynamic = "force-dynamic";

/** Uygulama açılış verisi: departman, personel, tatil, şablon verileri + lazy seed + günlük yedek. */
export async function GET() {
  try {
    await ensureSeeded();
    ensureDailyBackup().catch(() => {});
    const data = await getBootstrap();
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Bootstrap hatası" }, { status: 500 });
  }
}

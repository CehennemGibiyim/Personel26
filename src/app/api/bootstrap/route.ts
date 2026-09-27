import { ensureSeeded, getBootstrap, ensureDailyBackup } from "@/lib/server/core";

export const dynamic = "force-dynamic";

/** Uygulama açılış verisi: departman, personel, tatil, şablon verileri + lazy seed + günlük yedek. */
export async function GET() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const work = (async () => {
      await ensureSeeded();
      // Günlük yedek arka planda; yanıtı bekletmez.
      ensureDailyBackup().catch(() => {});
      return getBootstrap();
    })();
    // Rota seviyesi zaman aşımı: hiçbir koşulda istek asılı kalmaz.
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("BOOTSTRAP_TIMEOUT")), 25000);
    });
    const data = await Promise.race([work, timeout]);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bootstrap hatası";
    const isTimeout = msg === "BOOTSTRAP_TIMEOUT";
    return Response.json(
      { error: isTimeout ? "Sunucu yanıt vermiyor, lütfen tekrar deneyin." : msg },
      { status: isTimeout ? 503 : 500 },
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}

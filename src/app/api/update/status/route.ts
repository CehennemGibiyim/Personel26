import { APP_VERSION } from "@/lib/app-info";
import { isStaleStatus, readStatus, updateLogTail } from "@/lib/server/update";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Süren/tamamlanan güncellemenin durumu. Uygulama yeniden başlarken istekler
 * birkaç saniye başarısız olabilir; arayüz bu durumda yeniden dener.
 */
export async function GET() {
  const status = readStatus();
  return Response.json(
    {
      currentVersion: APP_VERSION,
      status,
      statusStale: isStaleStatus(status),
      logTail: status?.state === "error" ? status.logTail ?? updateLogTail() : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

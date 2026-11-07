import { APP_VERSION } from "@/lib/app-info";
import { autoUpdateInfo, feedUrl, isStaleStatus, readLastCheck, readStatus, updateLogTail } from "@/lib/server/update";
import type { UpdateInfo } from "@/lib/update-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Kurulu sürüm, güncelleme desteği, son denetim ve varsa süren güncellemenin durumu. */
export async function GET() {
  const status = readStatus();
  const stale = isStaleStatus(status);
  let feed = "";
  try {
    feed = feedUrl();
  } catch {
    feed = "";
  }
  // Sürüm değiştiyse (uygulama güncellendiyse) eski denetim sonucu geçersizdir.
  const lastCheck = readLastCheck();
  const info: UpdateInfo = {
    currentVersion: APP_VERSION,
    platform: process.platform,
    feed,
    autoUpdate: autoUpdateInfo(),
    lastCheck: lastCheck && lastCheck.currentVersion === APP_VERSION ? lastCheck : null,
    status: status
      ? { ...status, logTail: status.state === "error" ? status.logTail ?? updateLogTail() ?? undefined : undefined }
      : null,
    statusStale: stale,
  };
  return Response.json(info, { headers: { "cache-control": "no-store" } });
}

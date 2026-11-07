import { requireSameOrigin } from "@/lib/server/settings";
import {
  autoBackupOnClose,
  backupFolderInfo,
  createFolderBackup,
  openBackupFolder,
  restoreFolderBackup,
} from "@/lib/server/backup-folder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Kurulum klasöründeki yedekler, klasör yolu ve destek durumu. */
export async function GET() {
  return Response.json(backupFolderInfo());
}

/**
 * `create`: elle SQL yedeği · `close`: kapanışta otomatik yedek (15 dk sınırı)
 * `restore`: seçilen SQL yedeğini geri yükle · `open`: yedek klasörünü aç.
 */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const action = String(body?.action ?? "");
    if (action === "open") {
      openBackupFolder();
      return Response.json({ ok: true });
    }
    if (action === "create") {
      const result = await createFolderBackup();
      return Response.json({ ok: true, ...result, ...backupFolderInfo() });
    }
    if (action === "close") {
      const result = await autoBackupOnClose();
      return Response.json({ ok: true, ...result });
    }
    if (action === "restore") {
      const fileName = String(body?.fileName ?? "");
      if (!fileName) return Response.json({ error: "Geri yüklenecek yedek seçilmedi." }, { status: 400 });
      const result = await restoreFolderBackup(fileName);
      return Response.json({ ok: true, ...result, ...backupFolderInfo() });
    }
    return Response.json({ error: "Geçersiz yedek işlemi." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Yedek işlemi başarısız.";
    if (/izni yok|izin yok/i.test(message)) return Response.json({ error: message }, { status: 403 });
    const unsupported = /yalnızca Windows|bulunamadı|belirlenemedi|desteklenmiyor/i.test(message);
    return Response.json({ error: message }, { status: unsupported ? 409 : 500 });
  }
}

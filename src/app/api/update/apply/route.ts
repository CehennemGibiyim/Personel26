import {
  appRoot,
  autoUpdateInfo,
  checkForUpdates,
  isRunningState,
  isStaleStatus,
  readStatus,
  startUpdater,
  type PendingUpdate,
} from "@/lib/server/update";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Güncelleme başlatılamadı.";
}

/**
 * Güncellemeyi başlatır. İndirme, doğrulama ve dosya değişimi ayrı bir
 * PowerShell sürecinde yapılır; bu istek yalnızca süreci başlatıp döner.
 * İlerleme `GET /api/update/status` ile izlenir.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return Response.json({ error: "Bu istek farklı bir kaynaktan geldi." }, { status: 403 });
      }
    } catch {
      return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
    }
  }

  let body: { version?: unknown; confirm?: unknown };
  try {
    body = (await request.json()) as { version?: unknown; confirm?: unknown };
  } catch {
    return Response.json({ error: "İstek gövdesi okunamadı." }, { status: 400 });
  }
  if (body.confirm !== "GÜNCELLE") {
    return Response.json({ error: "Güncelleme için onay metni gerekli." }, { status: 400 });
  }

  const support = autoUpdateInfo();
  if (!support.supported) {
    return Response.json({ error: support.reason ?? "Otomatik güncelleme desteklenmiyor." }, { status: 409 });
  }
  if (!appRoot()) {
    return Response.json({ error: "Kurulum klasörü bulunamadı." }, { status: 409 });
  }

  const current = readStatus();
  if (isRunningState(current?.state) && !isStaleStatus(current)) {
    return Response.json({ error: "Zaten bir güncelleme sürüyor. Bitmesini bekleyin." }, { status: 409 });
  }

  try {
    const result = await checkForUpdates();
    if (result.blocked) return Response.json({ error: result.blocked }, { status: 409 });
    if (!result.updateAvailable) {
      return Response.json({ error: `Kurulu sürüm (${result.currentVersion}) zaten güncel.` }, { status: 409 });
    }
    if (typeof body.version === "string" && body.version !== result.latestVersion) {
      return Response.json(
        { error: `Sürüm değişti: en son sürüm artık ${result.latestVersion}. Güncellemeleri yeniden denetleyin.` },
        { status: 409 },
      );
    }
    const pending: PendingUpdate = {
      from: result.currentVersion,
      to: result.latestVersion,
      url: result.package.url,
      sha256: result.package.sha256,
      size: result.package.size ?? undefined,
      fileName: result.package.fileName ?? undefined,
      createdAt: new Date().toISOString(),
    };
    startUpdater(pending);
    return Response.json(
      {
        ok: true,
        version: result.latestVersion,
        message: `${result.latestVersion} sürümü indiriliyor. Uygulama kısa süreliğine kapanıp yeniden açılacak.`,
        statusUrl: "/api/update/status",
      },
      { status: 202, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 502 });
  }
}

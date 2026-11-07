import { checkForUpdates } from "@/lib/server/update";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Güncelleme denetlenemedi.";
}

/**
 * Güncelleme beslemesini sunucu tarafında okur. Adres istemciden alınmaz;
 * yalnızca `P26_UPDATE_FEED` veya derlemeye gömülü varsayılan kullanılır.
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
  try {
    const result = await checkForUpdates();
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}

import { db } from "@/db";
import { dbBackups } from "@/db/schema";
import { eq } from "drizzle-orm";
import { restoreBackup } from "@/lib/server/core";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Yedeği JSON dosyası olarak indir. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const row = (await db.select().from(dbBackups).where(eq(dbBackups.id, id)))[0];
  if (!row) return Response.json({ error: "Yedek bulunamadı" }, { status: 404 });
  return new Response(JSON.stringify(row.data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${row.filename}"`,
    },
  });
}

/** Tek tıkla geri yükleme (öncesinde otomatik güvenlik yedeği alınır). */
export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const row = (await db.select().from(dbBackups).where(eq(dbBackups.id, id)))[0];
    if (!row?.data) return Response.json({ error: "Yedek bulunamadı" }, { status: 404 });
    await restoreBackup(row.data as Record<string, unknown[]>);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Geri yükleme başarısız" }, { status: 500 });
  }
}

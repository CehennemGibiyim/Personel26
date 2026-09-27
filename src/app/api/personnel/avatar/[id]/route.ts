import { db } from "@/db";
import { personnel } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Personel profil fotoğrafını görsel olarak sunar (ETag + uzun önbellek). */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const row = (await db
    .select({ data: personnel.avatarData, mime: personnel.avatarMime, updatedAt: personnel.avatarUpdatedAt })
    .from(personnel)
    .where(eq(personnel.id, id)))[0];

  if (!row?.data || !row.mime) {
    return new Response(null, { status: 404 });
  }

  const etag = `"${id}-${row.updatedAt ? new Date(row.updatedAt).getTime() : 0}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  // atob hem Node 18+ hem tarayıcıda (GitHub Pages sürümü) vardır
  const bin = atob(row.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: etag,
    },
  });
}

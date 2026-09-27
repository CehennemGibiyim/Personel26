import { db } from "@/db";
import { departments } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** İmza alanları (unvan/isim) güncelleme. */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return Response.json({ error: "id gerekli" }, { status: 400 });
    const allowed = ["sorumluHemsire", "hemsireUnvan", "saglikBakimMuduru", "saglikBakimUnvan", "bashekim", "bashekimUnvan", "name", "managerName"];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in fields) patch[k] = fields[k];
    const rows = await db.update(departments).set(patch).where(eq(departments.id, id)).returning();
    return Response.json({ department: rows[0] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

/** Yeni departman ekleme. */
export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name?.trim()) return Response.json({ error: "Departman adı gerekli" }, { status: 400 });
    const rows = await db.insert(departments).values({ name: name.trim() }).returning();
    return Response.json({ department: rows[0] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id gerekli" }, { status: 400 });
    await db.delete(departments).where(eq(departments.id, id));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

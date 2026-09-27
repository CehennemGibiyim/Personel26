import { db } from "@/db";
import { personnel, personnelDepartments, departments } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { isValidPersonnelType } from "@/lib/shared";

export const dynamic = "force-dynamic";

function normalizeType(t: unknown): "ISCI" | "MEMUR" | "HEMSIRE" {
  return isValidPersonnelType(t) ? t : "MEMUR";
}

const EDITABLE = [
  "name", "fullName", "tcNo", "personnelType", "title", "phone", "email",
  "emergencyContact", "address", "startDate", "notes", "profileImage",
  "annualLeaveBalance", "sickLeaveBalance", "unpaidLeaveBalance", "departmentId", "isActive",
] as const;

function sanitizeImage(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val !== "string") return null;
  // data:image/...;base64,... formatı; max 1 MB ham base64
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(val)) return null;
  if (val.length > 1_400_000) return null; // ~1 MB limit
  return val;
}

async function setAssignments(personnelId: string, deptIds: string[]) {
  await db.delete(personnelDepartments).where(eq(personnelDepartments.personnelId, personnelId));
  if (deptIds.length) {
    await db.insert(personnelDepartments)
      .values(deptIds.map(d => ({ personnelId, departmentId: d })))
      .onConflictDoNothing();
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name?.trim()) return Response.json({ error: "Ad gerekli" }, { status: 400 });
    const deptIds: string[] = body.departmentIds ?? (body.departmentId ? [body.departmentId] : []);
    if (!deptIds.length) return Response.json({ error: "En az bir departman seçin" }, { status: 400 });
    // Departmanların gerçekten var olduğunu doğrula
    const deptRows = await db.select({ id: departments.id }).from(departments).where(inArray(departments.id, deptIds));
    if (deptRows.length !== deptIds.length) {
      return Response.json({ error: "Geçersiz departman seçimi" }, { status: 400 });
    }
    const ptype = normalizeType(body.personnelType);
    const numOr = (v: unknown, fallback: number | null) => {
      if (v === null || v === undefined || v === "") return fallback;
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const rows = await db.insert(personnel).values({
      name: body.name.trim().toUpperCase(),
      fullName: (body.fullName ?? body.name).trim().toUpperCase(),
      tcNo: body.tcNo?.trim() || null,
      personnelType: ptype,
      departmentId: body.departmentId && deptIds.includes(body.departmentId) ? body.departmentId : deptIds[0],
      title: body.title?.trim() || null,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      emergencyContact: body.emergencyContact?.trim() || null,
      address: body.address?.trim() || null,
      startDate: body.startDate || null,
      notes: body.notes?.trim() || null,
      profileImage: sanitizeImage(body.profileImage),
      annualLeaveBalance: numOr(body.annualLeaveBalance, ptype === "ISCI" ? 14 : 20),
      sickLeaveBalance: numOr(body.sickLeaveBalance, 30),
      unpaidLeaveBalance: numOr(body.unpaidLeaveBalance, 0),
    }).returning();
    await setAssignments(rows[0].id, deptIds);
    return Response.json({ personnel: { ...rows[0], departmentIds: deptIds } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, departmentIds, ...rest } = body;
    if (!id) return Response.json({ error: "id gerekli" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    for (const k of EDITABLE) if (k in rest) patch[k] = rest[k];
    if (patch.name) patch.name = String(patch.name).toUpperCase();
    if (patch.fullName) patch.fullName = String(patch.fullName).toUpperCase();
    if (patch.profileImage !== undefined) patch.profileImage = sanitizeImage(patch.profileImage);
    if (patch.personnelType !== undefined) patch.personnelType = normalizeType(patch.personnelType);
    if (Array.isArray(departmentIds)) {
      if (!departmentIds.length) return Response.json({ error: "En az bir departman seçin" }, { status: 400 });
      const deptRows = await db.select({ id: departments.id }).from(departments).where(inArray(departments.id, departmentIds));
      if (deptRows.length !== departmentIds.length) {
        return Response.json({ error: "Geçersiz departman seçimi" }, { status: 400 });
      }
      // Ana departman seçim dışında kaldıysa ilk seçili departmanı ana yap
      const current = (await db.select().from(personnel).where(eq(personnel.id, id)))[0];
      const primary = (patch.departmentId as string | undefined) ?? current?.departmentId;
      if (!primary || !departmentIds.includes(primary)) patch.departmentId = departmentIds[0];
      await setAssignments(id, departmentIds);
    }
    const rows = await db.update(personnel).set(patch).where(eq(personnel.id, id)).returning();
    if (!rows[0]) return Response.json({ error: "Personel bulunamadı" }, { status: 404 });
    const assignments = await db.select().from(personnelDepartments).where(eq(personnelDepartments.personnelId, id));
    return Response.json({
      personnel: { ...rows[0], departmentIds: assignments.map(a => a.departmentId) },
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

/** Soft delete: is_active = false (puantaj geçmişi korunur). */
export async function DELETE(req: Request) {
  try {
    const { id, hard } = await req.json();
    if (!id) return Response.json({ error: "id gerekli" }, { status: 400 });
    if (hard) {
      await db.delete(personnel).where(eq(personnel.id, id));
    } else {
      await db.update(personnel).set({ isActive: false }).where(eq(personnel.id, id));
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

/** Toplu listeyi döner (gerekirse). */
export async function GET() {
  const people = await db.select().from(personnel);
  const assignments = await db.select().from(personnelDepartments);
  return Response.json({
    personnel: people.map(p => ({
      ...p,
      departmentIds: assignments.filter(a => a.personnelId === p.id).map(a => a.departmentId),
    })),
  });
}

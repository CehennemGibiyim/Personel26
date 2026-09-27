import { createDraft } from "@/lib/server/roster";

export const dynamic = "force-dynamic";

/** Dengeli taslak: boş hücreleri izinlileri atlayıp adil dağıtımla doldurur. */
export async function POST(req: Request) {
  try {
    const { departmentId, year, month, overwrite } = await req.json();
    if (!departmentId || !year || month === undefined) {
      return Response.json({ error: "Eksik alan" }, { status: 400 });
    }
    const res = await createDraft(departmentId, year, month, overwrite === true);
    return Response.json(res);
  } catch (e) {
    const status = (e as { status?: number })?.status ?? 500;
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status });
  }
}

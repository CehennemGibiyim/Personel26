import { db, databaseConfigured } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!databaseConfigured) {
    return Response.json({ ok: false, error: "DATABASE_URL tanımlanmamış. .env veya dağıtım ayarlarına ekleyin." }, { status: 503 });
  }
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "PostgreSQL bağlantısı kurulamadı." }, { status: 500 });
  }
}

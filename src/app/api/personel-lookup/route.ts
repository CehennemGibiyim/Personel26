import { db } from "@/db";
import { personnel, departments, shiftSchedules, leaveRequests, timesheetEntries, holidays } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";

const trUpper = (s: string) =>
  s.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase().trim();

/** Türk TC Kimlik No algoritma doğrulaması (kaynak projeyle aynı). */
function isValidTc(tc: string): boolean {
  if (!/^[1-9]\d{10}$/.test(tc)) return false;
  const d = tc.split("").map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const digit10 = (odd * 7 - even) % 10;
  if (((digit10 + 10) % 10) !== d[9]) return false;
  const sum = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return sum % 10 === d[10];
}

/** Hız sınırı: aynı TC için 15 dakikada en fazla 5 hatalı deneme. */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW = 15 * 60 * 1000;
const MAX_TRIES = 5;
function checkRate(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW) {
    attempts.set(key, { count: 1, first: now });
    return;
  }
  rec.count += 1;
  if (rec.count > MAX_TRIES) {
    throw new Error("Çok fazla hatalı deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.");
  }
}

/** Her hatada aynı mesaj: hangi bilginin yanlış olduğu sızdırılmaz. */
const GENERIC = "Bilgiler eşleşmedi. TC Kimlik No ve soyadınızı kontrol edin.";

function surnamesOf(p: { name?: string | null; fullName?: string | null }): string[] {
  const out: string[] = [];
  for (const v of [p.fullName, p.name]) {
    const parts = trUpper(v ?? "").split(/\s+/).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) out.push(last);
  }
  return out;
}

/**
 * Şifresiz, salt-okunur personel sorgusu:
 * TC + soyad doğrulanırsa yalnızca o kişinin kendi nöbet, izin ve puantaj verisi döner.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tc = String(body.tcNo ?? "").replace(/\D/g, "");
    const surname = trUpper(String(body.surname ?? ""));
    checkRate(tc || "bos");
    if (!isValidTc(tc) || surname.length < 2) return err();

    const matches = await db.select().from(personnel)
      .where(and(eq(personnel.tcNo, tc), eq(personnel.isActive, true))).limit(2);
    if (matches.length !== 1) return err();
    const person = matches[0];
    if (!surnamesOf(person).includes(surname)) return err();

    const nowDt = new Date();
    const year = Number(body.year) || nowDt.getFullYear();
    const month = Number.isInteger(body.month) ? Number(body.month) : nowDt.getMonth();
    const dim = new Date(year, month + 1, 0).getDate();
    const startD = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endD = `${year}-${String(month + 1).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;

    const [schedules, leaves, entries, hols, dept] = await Promise.all([
      db.select().from(shiftSchedules).where(and(
        eq(shiftSchedules.personnelId, person.id),
        gte(shiftSchedules.scheduleDate, startD), lte(shiftSchedules.scheduleDate, endD))),
      db.select().from(leaveRequests).where(eq(leaveRequests.personnelId, person.id)),
      db.select().from(timesheetEntries).where(and(
        eq(timesheetEntries.personnelId, person.id),
        gte(timesheetEntries.entryDate, startD), lte(timesheetEntries.entryDate, endD))),
      db.select().from(holidays).where(and(gte(holidays.holidayDate, startD), lte(holidays.holidayDate, endD))),
      person.departmentId
        ? db.select().from(departments).where(eq(departments.id, person.departmentId)).limit(1)
        : Promise.resolve([]),
    ]);

    return Response.json({
      person: {
        name: person.name, title: person.title, personnelType: person.personnelType,
        departmentName: dept[0]?.name ?? null,
        annualLeaveBalance: person.annualLeaveBalance,
        sickLeaveBalance: person.sickLeaveBalance,
        unpaidLeaveBalance: person.unpaidLeaveBalance,
      },
      year, month,
      schedules: schedules.sort((a, b) => a.scheduleDate.localeCompare(b.scheduleDate)),
      leaves: leaves
        .filter(l => l.status !== "CANCELLED")
        .map(l => ({
          id: l.id, leaveType: l.leaveType, startDate: l.startDate, endDate: l.endDate,
          daysCount: l.daysCount, status: l.status, reason: l.reason,
        }))
        .sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 24),
      entries,
      holidays: hols,
    });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Çok fazla")) {
      return Response.json({ error: e.message }, { status: 429 });
    }
    return Response.json({ error: GENERIC }, { status: 400 });
  }
}

function err() {
  return Response.json({ error: GENERIC }, { status: 400 });
}

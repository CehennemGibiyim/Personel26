import { db } from "@/db";
import { personnel, departments, shiftSchedules, leaveRequests, timesheetEntries, holidays } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";

const trUpper = (s: string) =>
  s.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase().trim();

/**
 * Karşılaştırma için Türkçe harf katlama: "Çelik", "ÇELIK", "celik", "ÇELİK"
 * hepsi aynı kabul edilir (klavye / Türkçe karakter farkı giriş engellemesin).
 */
function fold(s: string): string {
  return trUpper(s)
    .replace(/Ç/g, "C").replace(/Ğ/g, "G").replace(/[İI]/g, "I")
    .replace(/Ö/g, "O").replace(/Ş/g, "S").replace(/Ü/g, "U")
    .replace(/\s+/g, " ").trim();
}

/** TC biçimi: 11 hane, 0 ile başlamaz. (Algoritma kontrolü giriş engeli değildir —
 *  kayıttaki TC ile birebir eşleşme aranır.) */
function isTcFormat(tc: string): boolean {
  return /^[1-9]\d{10}$/.test(tc);
}

/**
 * Hız sınırı — YALNIZCA HATALI denemeler sayılır.
 * (Eski sürüm başarılı sorguları ve ay değiştirmeyi de sayıyordu; kullanıcı
 *  4-5 ay gezinince 15 dk kilitleniyordu.)
 */
const failures = new Map<string, { count: number; first: number }>();
const WINDOW = 15 * 60 * 1000;
const MAX_FAILS = 8;
function isLocked(key: string): boolean {
  const rec = failures.get(key);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW) { failures.delete(key); return false; }
  return rec.count >= MAX_FAILS;
}
function recordFailure(key: string) {
  const now = Date.now();
  const rec = failures.get(key);
  if (!rec || now - rec.first > WINDOW) failures.set(key, { count: 1, first: now });
  else rec.count += 1;
}
function clearFailures(key: string) { failures.delete(key); }

/** Her hatada aynı mesaj: hangi bilginin yanlış olduğu sızdırılmaz. */
const GENERIC = "Bilgiler eşleşmedi. TC Kimlik No ve soyadınızı kontrol edin.";
const LOCKED = "Çok fazla hatalı deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.";

/** Soyadı veya tam ad ile eşleşme (Türkçe karakter duyarsız). */
function nameMatches(p: { name?: string | null; fullName?: string | null }, input: string): boolean {
  const q = fold(input);
  if (q.length < 2) return false;
  for (const v of [p.fullName, p.name]) {
    const full = fold(v ?? "");
    if (!full) continue;
    const parts = full.split(" ");
    if (parts[parts.length - 1] === q) return true; // soyad
    if (full === q) return true;                    // ad + soyad
  }
  return false;
}

/**
 * Şifresiz, salt-okunur personel sorgusu:
 * TC + soyad doğrulanırsa yalnızca o kişinin kendi nöbet, izin ve puantaj verisi döner.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tc = String(body.tcNo ?? "").replace(/\D/g, "");
    const surname = String(body.surname ?? "");
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "yerel";
    const key = `${ip}|${tc || "bos"}`;

    if (isLocked(key)) return Response.json({ error: LOCKED }, { status: 429 });
    if (!isTcFormat(tc) || fold(surname).length < 2) { recordFailure(key); return err(); }

    const matches = await db.select().from(personnel)
      .where(and(eq(personnel.tcNo, tc), eq(personnel.isActive, true))).limit(2);
    if (matches.length !== 1 || !nameMatches(matches[0], surname)) {
      recordFailure(key);
      return err();
    }
    const person = matches[0];
    clearFailures(key); // başarılı giriş: sayaç sıfırlanır, ay gezinmesi serbest

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
        id: person.id,
        name: person.name, title: person.title, personnelType: person.personnelType,
        departmentName: dept[0]?.name ?? null,
        annualLeaveBalance: person.annualLeaveBalance,
        sickLeaveBalance: person.sickLeaveBalance,
        unpaidLeaveBalance: person.unpaidLeaveBalance,
        hasAvatar: Boolean(person.avatarMime),
        avatarUpdatedAt: person.avatarUpdatedAt ? new Date(person.avatarUpdatedAt).toISOString() : null,
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

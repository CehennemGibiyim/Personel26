import { db, pool } from "@/db";
import {
  departments, personnel, personnelDepartments, holidays, timesheetEntries,
  shiftSchedules, leaveRequests, shiftSwapRequests, shiftTemplates, weeklyOverrides,
  announcements, dbBackups, dutyColumns,
} from "@/db/schema";
import { sortByName } from "@/lib/shared";
import { and, eq, gte, lte, inArray, desc } from "drizzle-orm";
import { getShiftRangeMetrics } from "@/lib/puantaj-engine";
import { daysBetween } from "@/lib/shared";

// ═════════════════════════════════════════════════════════════
// Bootstrap: uygulamanın ihtiyaç duyduğu temel veriler + lazy seed
// Eşzamanlı isteklere karşı: process-içi memo + PG advisory lock.
// ═════════════════════════════════════════════════════════════

let seeded = false;

export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  const existing = await db.select({ id: departments.id }).from(departments).limit(1);
  if (existing.length > 0) {
    seeded = true;
    // Mevcut veride nöbet saatlerini güncel ara dinlenme kuralına göre bir kez düzelt
    await recalcNobetHours().catch(() => {});
    return;
  }
  // Örnek veriler YALNIZCA ilk kurulumda yüklenir. Kullanıcı tüm servisleri
  // silmiş olsa bile (personel veya tatil kaydı duruyorsa) örnekler geri gelmez.
  const [anyPerson, anyHoliday] = await Promise.all([
    db.select({ id: personnel.id }).from(personnel).limit(1),
    db.select({ id: holidays.id }).from(holidays).limit(1),
  ]);
  if (anyPerson.length > 0 || anyHoliday.length > 0) {
    seeded = true;
    return;
  }
  await seedDatabase();
  seeded = true;
}

/**
 * Nöbetten gelen puantaj kayıtlarını (shift_type = NOBET) güncel net saat
 * kuralıyla yeniden hesaplar. Yalnızca farklı olan kayıtlar güncellenir.
 * (Eski kural 9–11 saatlik vardiyalarda yarım saat düşüyordu; yeni kural 1 saat.)
 */
export async function recalcNobetHours(): Promise<number> {
  const scheds = await db.select({
    personnelId: shiftSchedules.personnelId, date: shiftSchedules.scheduleDate,
    start: shiftSchedules.startTime, end: shiftSchedules.endTime,
  }).from(shiftSchedules);
  const totals = new Map<string, number>();
  for (const s of scheds) {
    const k = `${s.personnelId}|${s.date}`;
    totals.set(k, (totals.get(k) ?? 0) + getShiftRangeMetrics(s.start, s.end).worked);
  }
  const entries = await db.select({
    id: timesheetEntries.id, personnelId: timesheetEntries.personnelId,
    date: timesheetEntries.entryDate, hours: timesheetEntries.hoursWorked,
  }).from(timesheetEntries).where(eq(timesheetEntries.shiftType, "NOBET"));
  let changed = 0;
  for (const e of entries) {
    const t = totals.get(`${e.personnelId}|${e.date}`);
    if (t === undefined) continue;
    const next = Math.round(t * 100) / 100;
    if (Math.abs(next - e.hours) > 0.001) {
      await db.update(timesheetEntries).set({ hoursWorked: next }).where(eq(timesheetEntries.id, e.id));
      changed++;
    }
  }
  return changed;
}

async function seedDatabase() {
  // ── Departmanlar ──
  const [acil, yogunBakim, dahiliye] = await db.insert(departments).values([
    { name: "Acil Servis", sorumluHemsire: "ELİF KAYA", hemsireUnvan: "Sorumlu Hemşire", saglikBakimMuduru: "MURAT ÖZTÜRK", saglikBakimUnvan: "Sağlık Bakım Hizmetleri Müdürü", bashekim: "DOÇ. DR. AHMET YILDIRIM", bashekimUnvan: "Başhekim" },
    { name: "Yoğun Bakım", sorumluHemsire: "ZEYNEP ARSLAN", hemsireUnvan: "Sorumlu Hemşire", saglikBakimMuduru: "MURAT ÖZTÜRK", saglikBakimUnvan: "Sağlık Bakım Hizmetleri Müdürü", bashekim: "DOÇ. DR. AHMET YILDIRIM", bashekimUnvan: "Başhekim" },
    { name: "Dahiliye Servisi", sorumluHemsire: "FATMA DEMİR", hemsireUnvan: "Sorumlu Hemşire", saglikBakimMuduru: "MURAT ÖZTÜRK", saglikBakimUnvan: "Sağlık Bakım Hizmetleri Müdürü", bashekim: "DOÇ. DR. AHMET YILDIRIM", bashekimUnvan: "Başhekim" },
  ]).returning();

  // ── Personel ──
  const people: {
    name: string; tc: string; type: "ISCI" | "MEMUR"; title: string; dept: string; group?: "SAGLIK" | "DESTEK";
    phone?: string; email?: string; emergency?: string;
  }[] = [
    { name: "AYŞE ÇELİK", tc: "10000000146", type: "MEMUR", title: "Hemşire", dept: acil.id, phone: "0532 111 22 33", email: "ayse.celik@hastane.gov.tr", emergency: "MEHMET ÇELİK — 0533 000 11 22" },
    { name: "MEHMET ŞAHİN", tc: "10000000236", type: "ISCI", title: "Hemşire", dept: acil.id, phone: "0534 222 33 44" },
    { name: "HATİCE YILMAZ", tc: "10000000326", type: "MEMUR", title: "Ebe", dept: acil.id },
    { name: "OSMAN KOÇ", tc: "10000000479", type: "ISCI", title: "Sağlık Memuru", dept: acil.id },
    { name: "SERKAN AKDOĞAN", tc: "10000000569", type: "MEMUR", title: "ATT", dept: acil.id },
    { name: "MERVE AKSOY", tc: "10000000659", type: "MEMUR", title: "Hemşire", dept: yogunBakim.id, phone: "0536 333 44 55" },
    { name: "BURAK ÖZDEMİR", tc: "10000000749", type: "ISCI", title: "Hemşire", dept: yogunBakim.id },
    { name: "GİZEM TÜRK", tc: "10000000838", type: "MEMUR", title: "Hemşire", dept: yogunBakim.id },
    { name: "EMRE DOĞAN", tc: "10000000928", type: "ISCI", title: "Tıbbi Sekreter", dept: yogunBakim.id },
    { name: "SELİN KURT", tc: "10000001017", type: "MEMUR", title: "Hemşire", dept: yogunBakim.id },
    { name: "CAN ÖZTÜRK", tc: "10000001199", type: "MEMUR", title: "Hemşire", dept: dahiliye.id },
    { name: "DENİZ GÜNEŞ", tc: "10000001289", type: "ISCI", title: "Hemşire", dept: dahiliye.id },
    { name: "PINAR ERDEM", tc: "10000001379", type: "MEMUR", title: "Diyetisyen", dept: dahiliye.id },
    { name: "KEREM AYDIN", tc: "10000001469", type: "ISCI", title: "Hasta Bakıcı", dept: dahiliye.id },
    { name: "ASLI POLAT", tc: "10000001559", type: "MEMUR", title: "Hemşire", dept: dahiliye.id },
    // Temizlik / Destek grubu (ayrı nöbet çizelgesi ve puantaj)
    { name: "HASAN KILIÇ", tc: "10000002001", type: "ISCI", title: "Temizlik Personeli", dept: acil.id, group: "DESTEK" },
    { name: "SEVGİ ARIKAN", tc: "10000002002", type: "ISCI", title: "Temizlik Personeli", dept: acil.id, group: "DESTEK" },
    { name: "RAMAZAN ÖZ", tc: "10000002003", type: "ISCI", title: "Temizlik Personeli", dept: acil.id, group: "DESTEK" },
    { name: "NURAY ŞEN", tc: "10000002004", type: "ISCI", title: "Hasta Bakıcı", dept: acil.id, group: "DESTEK" },
    { name: "ERKAN YAVUZ", tc: "10000002005", type: "ISCI", title: "Temizlik Personeli", dept: yogunBakim.id, group: "DESTEK" },
    { name: "DİLEK ÇAKIR", tc: "10000002006", type: "ISCI", title: "Temizlik Personeli", dept: yogunBakim.id, group: "DESTEK" },
    { name: "MUSA TEKİN", tc: "10000002007", type: "ISCI", title: "Temizlik Personeli", dept: yogunBakim.id, group: "DESTEK" },
    { name: "FADİME KORKMAZ", tc: "10000002008", type: "ISCI", title: "Temizlik Personeli", dept: dahiliye.id, group: "DESTEK" },
    { name: "İBRAHİM ACAR", tc: "10000002009", type: "ISCI", title: "Temizlik Personeli", dept: dahiliye.id, group: "DESTEK" },
  ];
  const inserted = await db.insert(personnel).values(people.map(p => ({
    name: p.name, fullName: p.name, tcNo: p.tc, personnelType: p.type, title: p.title,
    departmentId: p.dept, phone: p.phone ?? null, email: p.email ?? null,
    emergencyContact: p.emergency ?? null,
    staffGroup: p.group ?? (p.title === "Hasta Bakıcı" ? "DESTEK" : "SAGLIK"),
    annualLeaveBalance: p.type === "ISCI" ? 14 : 20, sickLeaveBalance: 30, unpaidLeaveBalance: 0,
  }))).returning();

  await db.insert(personnelDepartments).values(inserted.map(p => ({
    personnelId: p.id, departmentId: p.departmentId!,
  })));

  // ── Resmî tatiller (2025–2027) ──
  const hol: [string, string][] = [
    ["2025-01-01", "Yılbaşı"], ["2025-03-30", "Ramazan Bayramı"], ["2025-03-31", "Ramazan Bayramı"],
    ["2025-04-01", "Ramazan Bayramı"], ["2025-04-23", "Ulusal Egemenlik ve Çocuk Bayramı"],
    ["2025-05-01", "Emek ve Dayanışma Günü"], ["2025-05-19", "Gençlik ve Spor Bayramı"],
    ["2025-06-06", "Kurban Bayramı"], ["2025-06-07", "Kurban Bayramı"], ["2025-06-08", "Kurban Bayramı"],
    ["2025-06-09", "Kurban Bayramı"], ["2025-07-15", "Demokrasi ve Millî Birlik Günü"],
    ["2025-08-30", "Zafer Bayramı"], ["2025-10-29", "Cumhuriyet Bayramı"],
    ["2026-01-01", "Yılbaşı"], ["2026-03-20", "Ramazan Bayramı"], ["2026-03-21", "Ramazan Bayramı"],
    ["2026-03-22", "Ramazan Bayramı"], ["2026-04-23", "Ulusal Egemenlik ve Çocuk Bayramı"],
    ["2026-05-01", "Emek ve Dayanışma Günü"], ["2026-05-19", "Gençlik ve Spor Bayramı"],
    ["2026-05-27", "Kurban Bayramı"], ["2026-05-28", "Kurban Bayramı"], ["2026-05-29", "Kurban Bayramı"],
    ["2026-05-30", "Kurban Bayramı"], ["2026-07-15", "Demokrasi ve Millî Birlik Günü"],
    ["2026-08-30", "Zafer Bayramı"], ["2026-10-29", "Cumhuriyet Bayramı"],
    ["2027-01-01", "Yılbaşı"],
  ];
  await db.insert(holidays).values(hol.map(([holidayDate, name]) => ({ holidayDate, name })));

  // ── Vardiya şablonları (kaydedilmiş sütun düzenleri) ──
  await db.insert(shiftTemplates).values([
    { departmentId: null, name: "2'li Vardiya Düzeni (12s)", shiftCount: 2, slots: [
      { service: "Genel Servis", shiftLabel: "08:00–20:00", startTime: "08:00", endTime: "20:00" },
      { service: "Genel Servis", shiftLabel: "20:00–08:00", startTime: "20:00", endTime: "08:00" },
    ] },
    { departmentId: null, name: "3'lü Vardiya Düzeni (8s)", shiftCount: 3, slots: [
      { service: "Genel Servis", shiftLabel: "08:00–16:00", startTime: "08:00", endTime: "16:00" },
      { service: "Genel Servis", shiftLabel: "16:00–00:00", startTime: "16:00", endTime: "00:00" },
      { service: "Genel Servis", shiftLabel: "00:00–08:00", startTime: "00:00", endTime: "08:00" },
    ] },
  ]);

  // ── Son 6 ayın örnek nöbet çizelgesi (deterministik rotasyon) ──
  const now = new Date();
  const depts = [acil, yogunBakim, dahiliye];
  const peopleByDept = new Map<string, typeof inserted>();
  for (const d of depts) {
    peopleByDept.set(d.id, inserted.filter(p => p.departmentId === d.id && p.staffGroup !== "DESTEK"));
  }
  const schedulesToInsert: {
    departmentId: string; scheduleDate: string; personnelId: string;
    shiftSlot: string; shiftLabel: string; startTime: string; endTime: string;
  }[] = [];

  for (let back = 5; back >= 0; back--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const y = ref.getFullYear(); const m = ref.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    const maxDay = back === 0 ? now.getDate() : dim;
    for (const d of depts) {
      const plist = peopleByDept.get(d.id)!;
      if (plist.length === 0) continue;
      for (let day = 1; day <= maxDay; day++) {
        const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        // Gündüz nöbeti: 2 kişi, 12 saat — 2 gün çalış 2 gün dinlen rotasyonu
        const g1 = plist[(day + 0) % plist.length];
        const g2 = plist[(day + 2) % plist.length];
        const n1 = plist[(day + 3) % plist.length];
        if (Math.floor((day + 0) / 2) % 2 === 0 && g1) {
          schedulesToInsert.push({ departmentId: d.id, scheduleDate: dateStr, personnelId: g1.id, shiftSlot: "08-20", shiftLabel: "08:00 – 20:00 (12s Gündüz)", startTime: "08:00", endTime: "20:00" });
        }
        if (Math.floor((day + 2) / 2) % 2 === 1 && g2) {
          schedulesToInsert.push({ departmentId: d.id, scheduleDate: dateStr, personnelId: g2.id, shiftSlot: "08-20", shiftLabel: "08:00 – 20:00 (12s Gündüz)", startTime: "08:00", endTime: "20:00" });
        }
        // Gece nöbeti: her gün 1 kişi, rotasyonel
        if (n1 && day % 2 === 1) {
          schedulesToInsert.push({ departmentId: d.id, scheduleDate: dateStr, personnelId: n1.id, shiftSlot: "20-08", shiftLabel: "20:00 – 08:00 (12s Gece)", startTime: "20:00", endTime: "08:00" });
        }
      }
    }
  }
  // Aynı (personel, tarih) çakışmalarını temizle
  const seen = new Set<string>();
  const clean = schedulesToInsert.filter(s => {
    const k = `${s.personnelId}|${s.scheduleDate}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  for (let i = 0; i < clean.length; i += 100) {
    await db.insert(shiftSchedules).values(clean.slice(i, i + 100));
  }
  // Nöbet → puantaj senkronu (toplu hesap, tek seferde insert)
  const totals = new Map<string, number>();
  for (const s of clean) {
    const k = `${s.personnelId}|${s.scheduleDate}`;
    totals.set(k, (totals.get(k) ?? 0) + getShiftRangeMetrics(s.startTime, s.endTime).worked);
  }
  const tsRows = [...totals.entries()]
    .map(([k, hrs]) => {
      const [personnelId, entryDate] = k.split("|");
      return { personnelId, entryDate, shiftType: "NOBET", hoursWorked: Math.round(hrs * 100) / 100 };
    })
    .filter(r => r.hoursWorked > 0);
  for (let i = 0; i < tsRows.length; i += 200) {
    await db.insert(timesheetEntries).values(tsRows.slice(i, i + 200));
  }

  // ── Örnek izin talepleri ──
  const curY = now.getFullYear(); const curM = now.getMonth();
  const dstr = (day: number) => `${curY}-${String(curM + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const ayse = inserted[0]; const burak = inserted[6]; const can = inserted[10]; const selin = inserted[9];
  const leaves = await db.insert(leaveRequests).values([
    { personnelId: ayse.id, leaveType: "YILLIK", startDate: dstr(Math.min(5, 28)), endDate: dstr(Math.min(7, 28)), daysCount: 3, reason: "Yıllık izin kullanımı", status: "APPROVED", approvalStage: "DONE", stageHemsireBy: "ELİF KAYA", stageMudurBy: "MURAT ÖZTÜRK", stageBashekimBy: "AHMET YILDIRIM" },
    { personnelId: burak.id, leaveType: "RAPOR", startDate: dstr(Math.min(10, 28)), endDate: dstr(Math.min(12, 28)), daysCount: 3, reason: "Sağlık raporu", status: "APPROVED", approvalStage: "DONE", stageHemsireBy: "ZEYNEP ARSLAN", stageMudurBy: "MURAT ÖZTÜRK", stageBashekimBy: "AHMET YILDIRIM" },
    { personnelId: can.id, leaveType: "YILLIK", startDate: dstr(Math.min(18, 28)), endDate: dstr(Math.min(20, 28)), daysCount: 3, reason: "Ailevi neden", status: "PENDING", approvalStage: "MUDUR", stageHemsireBy: "FATMA DEMİR" },
    { personnelId: selin.id, leaveType: "MAZERET", startDate: dstr(Math.min(22, 28)), endDate: dstr(Math.min(22, 28)), daysCount: 1, reason: "Kişisel işler", status: "PENDING", approvalStage: "HEMSIRE" },
  ]).returning();
  for (const lv of leaves.filter(l => l.status === "APPROVED")) {
    await applyLeaveToTimesheet(lv);
  }

  // ── Örnek vardiya değişim talebi ──
  const mehmet = inserted[1]; const osman = inserted[3];
  const mehmetShift = clean.find(s => s.personnelId === mehmet.id);
  await db.insert(shiftSwapRequests).values([
    { requesterId: mehmet.id, requesterShiftId: mehmetShift ? undefined : undefined, swapDate: dstr(15), reason: "Özel nedenle nöbet değişimi rica ediyorum.", status: "PENDING", targetPersonnelId: osman.id },
  ]);

  // ── Örnek duyurular ──
  await db.insert(announcements).values([
    { departmentId: null, title: "Ocak ayı nöbet listeleri", body: "Yeni ayın nöbet çizelgeleri en geç ayın 28'inde onaylanmış olmalıdır. Vardiya şablonlarını kullanarak listeleri hızlıca oluşturabilirsiniz.", kind: "INFO", createdBy: "İdare" },
    { departmentId: acil.id, title: "Hafta sonu akademik değerlendirme", body: "Cumartesi 09:00'da serviste olgu sunumu yapılacaktır. Gündüz ekibinin katılımı zorunludur.", kind: "WARNING", createdBy: "ELİF KAYA" },
    { departmentId: null, title: "İzin planlaması hakkında", body: "Bayram dönemi yıllık izin talepleri en geç iki hafta önceden iletilmelidir.", kind: "URGENT", createdBy: "İdare" },
  ]);
}

// ═════════════════════════════════════════════════════════════
// Nöbet → Puantaj otomatik senkronu (kaynak projedeki DB trigger karşılığı)
// ═════════════════════════════════════════════════════════════
export async function syncTimesheetFromSchedules(personnelId: string, date: string) {
  const scheds = await db.select().from(shiftSchedules)
    .where(and(eq(shiftSchedules.personnelId, personnelId), eq(shiftSchedules.scheduleDate, date)));
  const total = Math.round(scheds.reduce((s, x) => s + getShiftRangeMetrics(x.startTime, x.endTime).worked, 0) * 100) / 100;
  const existing = await db.select().from(timesheetEntries)
    .where(and(eq(timesheetEntries.personnelId, personnelId), eq(timesheetEntries.entryDate, date)));
  const row = existing[0];
  if (row) {
    if (row.shiftType === "NOBET") {
      if (total > 0) {
        await db.update(timesheetEntries).set({ hoursWorked: total }).where(eq(timesheetEntries.id, row.id));
      } else {
        await db.delete(timesheetEntries).where(eq(timesheetEntries.id, row.id));
      }
    }
    // Manuel / izin kodlu kayıtlar varken dokunma (elle girilen veri önceliklidir)
    return;
  }
  if (total > 0) {
    await db.insert(timesheetEntries).values({ personnelId, entryDate: date, shiftType: "NOBET", hoursWorked: total });
  }
}

// ═════════════════════════════════════════════════════════════
// Onaylanan izin → Puantaj senkronu (izin kodu yazılır / silinir)
// ═════════════════════════════════════════════════════════════
export async function applyLeaveToTimesheet(leave: { personnelId: string; startDate: string; endDate: string; leaveType: string }) {
  const days = daysBetween(leave.startDate, leave.endDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(leave.startDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    const existing = await db.select().from(timesheetEntries)
      .where(and(eq(timesheetEntries.personnelId, leave.personnelId), eq(timesheetEntries.entryDate, date)));
    if (existing[0]) {
      await db.update(timesheetEntries).set({ shiftType: leave.leaveType, hoursWorked: 0 }).where(eq(timesheetEntries.id, existing[0].id));
    } else {
      await db.insert(timesheetEntries).values({ personnelId: leave.personnelId, entryDate: date, shiftType: leave.leaveType, hoursWorked: 0 });
    }
  }
}

export async function removeLeaveFromTimesheet(leave: { personnelId: string; startDate: string; endDate: string; leaveType: string }) {
  const days = daysBetween(leave.startDate, leave.endDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(leave.startDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    await db.delete(timesheetEntries).where(and(
      eq(timesheetEntries.personnelId, leave.personnelId),
      eq(timesheetEntries.entryDate, date),
      eq(timesheetEntries.shiftType, leave.leaveType),
    ));
  }
}

/**
 * Personel listesi kolonları — ağır avatar verisi hariç tutulur.
 * Fotoğraf /api/personnel/avatar/[id] ucundan ayrıca sunulur.
 */
export const personnelListColumns = {
  id: personnel.id, name: personnel.name, fullName: personnel.fullName, tcNo: personnel.tcNo,
  personnelType: personnel.personnelType, isActive: personnel.isActive, departmentId: personnel.departmentId,
  staffGroup: personnel.staffGroup,
  title: personnel.title, phone: personnel.phone, email: personnel.email,
  emergencyContact: personnel.emergencyContact, address: personnel.address,
  startDate: personnel.startDate, notes: personnel.notes,
  annualLeaveBalance: personnel.annualLeaveBalance, sickLeaveBalance: personnel.sickLeaveBalance,
  unpaidLeaveBalance: personnel.unpaidLeaveBalance,
  avatarMime: personnel.avatarMime, avatarUpdatedAt: personnel.avatarUpdatedAt,
  createdAt: personnel.createdAt,
} as const;

/** Ham satırı istemci tipine çevirir: hasAvatar üretir, ham veriyi sızdırmaz. */
export function toClientPersonnel<T extends { avatarMime?: string | null; avatarUpdatedAt?: Date | string | null }>(row: T) {
  const { avatarMime, ...rest } = row as T & Record<string, unknown>;
  return {
    ...rest,
    hasAvatar: Boolean(avatarMime),
    avatarUpdatedAt: row.avatarUpdatedAt ? new Date(row.avatarUpdatedAt).toISOString() : null,
  };
}

// ═════════════════════════════════════════════════════════════
// Bootstrap verileri
// ═════════════════════════════════════════════════════════════
export async function getBootstrap() {
  const [depts, people, assignments, hols, templates] = await Promise.all([
    db.select().from(departments).orderBy(departments.name),
    db.select(personnelListColumns).from(personnel).where(eq(personnel.isActive, true)),
    db.select().from(personnelDepartments),
    db.select().from(holidays).orderBy(holidays.holidayDate),
    db.select().from(shiftTemplates).orderBy(desc(shiftTemplates.createdAt)),
  ]);
  return {
    departments: sortByName(depts),
    personnel: people.map(p => ({
      ...toClientPersonnel(p),
      departmentIds: assignments.filter(a => a.personnelId === p.id).map(a => a.departmentId),
    })),
    holidays: hols,
    templates,
  };
}

// ═════════════════════════════════════════════════════════════
// Yedekleme
// ═════════════════════════════════════════════════════════════
const BACKUP_TABLES = [
  "departments", "holidays", "personnel", "shift_templates", "shift_schedules",
  "leave_requests", "shift_swap_requests", "timesheet_entries",
  "personnel_departments", "weekly_overrides", "announcements", "duty_columns",
] as const;

export async function snapshotAll() {
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  const tables = {
    departments, holidays, personnel, shift_templates: shiftTemplates, shift_schedules: shiftSchedules,
    leave_requests: leaveRequests, shift_swap_requests: shiftSwapRequests, timesheet_entries: timesheetEntries,
    personnel_departments: personnelDepartments, weekly_overrides: weeklyOverrides, announcements,
    duty_columns: dutyColumns,
  } as const;
  for (const key of BACKUP_TABLES) {
    const rows = await db.select().from(tables[key]);
    data[key] = rows;
    counts[key] = rows.length;
  }
  return { data, counts };
}

export async function writeBackup(kind: "AUTO" | "MANUAL" | "SAFETY") {
  const { data, counts } = await snapshotAll();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `yedek_${kind === "AUTO" ? "otomatik" : kind === "SAFETY" ? "guvenlik" : "elle"}_${stamp}.json`;
  const inserted = await db.insert(dbBackups).values({ filename, kind, recordCounts: counts, data }).returning();
  // Son 30 yedeği sakla
  const old = await db.select({ id: dbBackups.id }).from(dbBackups).orderBy(desc(dbBackups.createdAt)).offset(30);
  if (old.length) await db.delete(dbBackups).where(inArray(dbBackups.id, old.map(r => r.id)));
  return { id: inserted[0].id, filename, counts };
}

export async function ensureDailyBackup() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db.select({ id: dbBackups.id }).from(dbBackups)
    .where(and(eq(dbBackups.kind, "AUTO"), gte(dbBackups.createdAt, since))).limit(1);
  if (recent.length) return { created: false as const };
  const res = await writeBackup("AUTO");
  return { created: true as const, ...res };
}

export async function restoreBackup(payload: Record<string, unknown[]>) {
  // Güvenlik yedeği
  await writeBackup("SAFETY");
  // Silme sırası: çocuk → ebeveyn
  await db.delete(timesheetEntries);
  await db.delete(shiftSwapRequests);
  await db.delete(leaveRequests);
  await db.delete(shiftSchedules);
  await db.delete(dutyColumns);
  await db.delete(weeklyOverrides);
  await db.delete(announcements);
  await db.delete(personnelDepartments);
  await db.delete(shiftTemplates);
  await db.delete(personnel);
  await db.delete(departments);
  await db.delete(holidays);

  async function insertRows(table: any, rows: any[]) {
    const step = 200;
    for (let i = 0; i < rows.length; i += step) {
      await db.insert(table).values(rows.slice(i, i + step));
    }
  }
  const p = payload;
  if (p.departments?.length) await insertRows(departments, p.departments);
  if (p.holidays?.length) await insertRows(holidays, p.holidays);
  if (p.personnel?.length) await insertRows(personnel, p.personnel);
  if (p.shift_templates?.length) await insertRows(shiftTemplates, p.shift_templates);
  if (p.duty_columns?.length) await insertRows(dutyColumns, p.duty_columns);
  if (p.personnel_departments?.length) await insertRows(personnelDepartments, p.personnel_departments);
  if (p.shift_schedules?.length) await insertRows(shiftSchedules, p.shift_schedules);
  if (p.leave_requests?.length) await insertRows(leaveRequests, p.leave_requests);
  if (p.shift_swap_requests?.length) await insertRows(shiftSwapRequests, p.shift_swap_requests);
  if (p.timesheet_entries?.length) await insertRows(timesheetEntries, p.timesheet_entries);
  if (p.weekly_overrides?.length) await insertRows(weeklyOverrides, p.weekly_overrides);
  if (p.announcements?.length) await insertRows(announcements, p.announcements);
}

export { lte, and, eq, gte, inArray, desc };

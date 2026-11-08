import assert from "node:assert/strict";
import { Client } from "pg";

/**
 * Personel26 — yedek/geri yükleme uçtan uca testi.
 *
 * Senaryo gerçek bir bilgisayar değişikliğini taklit eder:
 *   1. Servis, vardiya şablonu, profil fotoğraflı personel, nöbet ve puantaj oluştur.
 *   2. Panelden JSON yedeği indir.
 *   3. Veritabanındaki tüm veriyi sil (yeni/bos kurulum).
 *   4. Yedeği panelin geri yükleme ucuyla geri yükle.
 *   5. Personel, fotoğraf, şablon, nöbet, puantaj ve servislerin birebir döndüğünü doğrula.
 *   6. Art arda okumalarda verinin yeniden sıfırlanmadığını doğrula.
 *
 * Sunucu DATABASE_URL ile çalışıyor olmalıdır (CI'da postgres:16 servisi).
 */

const base = (process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL gerekli.");

const stamp = Date.now().toString(36).toUpperCase();
// 1x1 saydam PNG — gerçek bir profil fotoğrafı gibi base64 olarak gönderilir.
const AVATAR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
let passed = 0;
function check(name, condition, detail = "") {
  assert.ok(condition, detail ? `${name} (${detail})` : name);
  passed++;
  console.log(`PASS ${name}`);
}

async function request(path, init = {}) {
  const response = await fetch(base + path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${data?.error ?? response.status}`);
  return data;
}

const health = await request("/api/health");
check("Sunucu ve veritabanı hazır", health.ok === true);

const createdDepartment = await request("/api/departments", {
  method: "POST",
  body: JSON.stringify({ name: `YEDEK TEST SERVİSİ ${stamp}` }),
});
const department = createdDepartment.department;
check("Yeni servis oluşturuldu", Boolean(department?.id), department?.name);

const createdTemplate = await request("/api/templates", {
  method: "POST",
  body: JSON.stringify({
    departmentId: department.id,
    name: `YEDEK TEST ŞABLONU ${stamp}`,
    slots: [
      { service: department.name, shiftLabel: "08:00–16:00", startTime: "08:00", endTime: "16:00" },
      { service: department.name, shiftLabel: "16:00–00:00", startTime: "16:00", endTime: "00:00" },
    ],
  }),
});
const template = createdTemplate.template;
check("Nöbet şablonu oluşturuldu", template?.slots?.length === 2);

const tcNo = `9${String(Date.now()).slice(-10)}`;
const createdPerson = await request("/api/personnel", {
  method: "POST",
  body: JSON.stringify({
    name: `YEDEK TEST PERSONEL ${stamp}`,
    fullName: `YEDEK TEST PERSONEL ${stamp}`,
    tcNo,
    personnelType: "HEMSIRE",
    title: "Hemşire",
    staffGroup: "SAGLIK",
    departmentId: department.id,
    departmentIds: [department.id],
    phone: "0500 000 00 00",
    email: "yedek.test@example.com",
    annualLeaveBalance: 21,
    avatar: AVATAR,
  }),
});
const person = createdPerson.personnel;
check("Profil fotoğraflı personel oluşturuldu", Boolean(person?.id) && person.hasAvatar === true);
check("Personel servise atandı", person.departmentIds.includes(department.id));

const avatarResponse = await fetch(`${base}/api/personnel/avatar/${person.id}`);
check("Profil fotoğrafı sunuluyor", avatarResponse.ok && (avatarResponse.headers.get("content-type") ?? "").startsWith("image/png"));

const scheduleDate = "2026-11-12";
const createdSchedule = await request("/api/schedules", {
  method: "POST",
  body: JSON.stringify({
    departmentId: department.id,
    personnelId: person.id,
    scheduleDate,
    shiftSlot: "CUSTOM",
    shiftLabel: "08:00 – 16:00",
    startTime: "08:00",
    endTime: "16:00",
  }),
});
const schedule = createdSchedule.schedule;
check("Nöbet kaydı oluşturuldu", Boolean(schedule?.id) && schedule.scheduleDate === scheduleDate);

await request("/api/timesheet", {
  method: "PUT",
  body: JSON.stringify({ personnelId: person.id, entryDate: "2026-11-13", shiftType: "MANUAL", hoursWorked: 7.5 }),
});
const timesheetBefore = await request(`/api/timesheet?year=2026&month=10&personnel=${person.id}`);
const manualEntry = timesheetBefore.entries.find(entry => entry.entryDate === "2026-11-13");
check("Puantaj kaydı oluşturuldu", manualEntry?.hoursWorked === 7.5);

const createdBackup = await request("/api/backup", { method: "POST" });
const backupResponse = await fetch(`${base}/api/backup/${createdBackup.id}`);
check("JSON yedeği indirilebildi", backupResponse.ok);
const backup = await backupResponse.json();
check("Yedek personeli içeriyor", Array.isArray(backup.personnel) && backup.personnel.some(row => row.id === person.id));
check("Yedek profil fotoğrafını içeriyor", backup.personnel.some(row => row.id === person.id && Boolean(row.avatarData)));
check("Yedek şablonu içeriyor", Array.isArray(backup.shift_templates) && backup.shift_templates.some(row => row.id === template.id));
check("Yedek nöbeti içeriyor", Array.isArray(backup.shift_schedules) && backup.shift_schedules.some(row => row.id === schedule.id));
check("Yedek puantajı içeriyor", Array.isArray(backup.timesheet_entries) && backup.timesheet_entries.some(row => row.personnelId === person.id));
check("Yedek servisi içeriyor", Array.isArray(backup.departments) && backup.departments.some(row => row.id === department.id));

// Yeni bilgisayar / boş kurulum: tüm veri tablolarını sil.
const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  const tables = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%'",
  );
  const names = tables.rows.map(row => `"public"."${row.tablename}"`).join(", ");
  if (names) await client.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
} finally {
  await client.end();
}

const empty = await request("/api/personnel");
check("Veritabanı sıfırlandı (yeni kurulum)", empty.personnel.length === 0);

const restored = await request("/api/database", {
  method: "POST",
  body: JSON.stringify({ action: "restore", data: backup, confirm: "GERİ YÜKLE" }),
});
check("Yedek panelden geri yüklendi", restored.ok === true);

const bootstrap = await request("/api/bootstrap");
check("Servis geri geldi", bootstrap.departments.some(row => row.id === department.id && row.name === department.name));
const restoredPerson = bootstrap.personnel.find(row => row.id === person.id);
check("Personel geri geldi", Boolean(restoredPerson) && restoredPerson.fullName === person.fullName);
check("Personelin servis ataması geri geldi", restoredPerson.departmentIds.includes(department.id));
check("Profil fotoğrafı bayrağı geri geldi", restoredPerson.hasAvatar === true);
check("İletişim ve izin bakiyesi geri geldi", restoredPerson.phone === person.phone && restoredPerson.annualLeaveBalance === 21);
const restoredAvatar = await fetch(`${base}/api/personnel/avatar/${person.id}`);
const restoredAvatarBytes = restoredAvatar.ok ? new Uint8Array(await restoredAvatar.arrayBuffer()) : new Uint8Array();
check("Profil fotoğrafı baytları geri geldi", restoredAvatar.ok &&
  (restoredAvatar.headers.get("content-type") ?? "").startsWith("image/png") && restoredAvatarBytes.length > 0);

const templates = await request("/api/templates");
const restoredTemplate = templates.templates.find(row => row.id === template.id);
check("Nöbet şablonu geri geldi", restoredTemplate?.slots?.length === 2 && restoredTemplate.name === template.name);

const schedules = await request(`/api/schedules?dept=${department.id}&start=2026-11-01&end=2026-11-30`);
const restoredSchedule = schedules.schedules.find(row => row.id === schedule.id);
check("Nöbet çizelgesi geri geldi", Boolean(restoredSchedule) && restoredSchedule.startTime === "08:00" && restoredSchedule.endTime === "16:00");

const timesheet = await request(`/api/timesheet?year=2026&month=10&personnel=${person.id}`);
check("Puantaj kaydı geri geldi", timesheet.entries.some(entry => entry.entryDate === "2026-11-13" && entry.hoursWorked === 7.5));
check("Nöbetten gelen puantaj geri geldi", timesheet.entries.some(entry => entry.entryDate === scheduleDate && entry.shiftType === "NOBET"));

// Art arda okumalar örnek veriyi yeniden kurmamalı / veriyi sıfırlamamalı.
const counts = [];
for (let i = 0; i < 3; i++) {
  const [people, depts, shifts] = await Promise.all([
    request("/api/personnel"),
    request("/api/departments"),
    request(`/api/schedules?dept=${department.id}&start=2026-11-01&end=2026-11-30`),
  ]);
  counts.push(`${people.personnel.length}|${depts.departments.length}|${shifts.schedules.length}`);
  await new Promise(resolve => setTimeout(resolve, 150));
}
check("Tekrarlı okumalarda veri sıfırlanmıyor", new Set(counts).size === 1, counts.join(" / "));

const backupList = await request("/api/backup");
check("Geri yükleme öncesi güvenlik yedeği alındı", backupList.backups.some(row => row.kind === "SAFETY"));

console.log(`\n${passed} yedek/geri yükleme kontrolü geçti.`);

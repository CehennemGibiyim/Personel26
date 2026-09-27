// Uygulama genelinde paylaşılan sabitler, tipler ve takvim yardımcıları.

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
export const DAYS_FULL = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export type PersonnelType = 'ISCI' | 'MEMUR' | 'HEMSIRE';

/** Personel sınıfı kartları: İşçi / Memur / Hemşire. */
export const PERSONNEL_TYPE_META: Record<PersonnelType, {
  label: string; upper: string; short: string; desc: string; weekly: string;
  badge: string; chip: string; card: string;
}> = {
  MEMUR: {
    label: "Memur", upper: "MEMUR", short: "M", desc: "40 saat / hafta", weekly: "40s",
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/35",
    chip: "type-memur",
    card: "bg-sky-500/25 border-sky-400/70 text-sky-200",
  },
  ISCI: {
    label: "İşçi", upper: "İŞÇİ", short: "İ", desc: "45 saat / hafta", weekly: "45s",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/35",
    chip: "type-isci",
    card: "bg-amber-500/25 border-amber-400/70 text-amber-200",
  },
  HEMSIRE: {
    label: "Hemşire", upper: "HEMŞİRE", short: "H", desc: "40 saat / hafta · nöbet düzeni", weekly: "40s",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35",
    chip: "type-hemsire",
    card: "bg-emerald-500/25 border-emerald-400/70 text-emerald-200",
  },
};

export const PERSONNEL_TYPE_ORDER: PersonnelType[] = ["MEMUR", "ISCI", "HEMSIRE"];

/**
 * Hastane ünvan kataloğu (gruplu). Her grubun önerilen personel sınıfı vardır;
 * listeden ünvan seçilince sınıf otomatik önerilir (kullanıcı değiştirebilir).
 * Listede olmayan ünvanlar serbest metin olarak da yazılabilir.
 */
export const TITLE_GROUPS: { group: string; type: PersonnelType; titles: string[] }[] = [
  {
    group: "Hemşirelik ve Ebelik", type: "HEMSIRE",
    titles: [
      "Hemşire", "Sorumlu Hemşire", "Servis Sorumlu Hemşiresi", "Yoğun Bakım Hemşiresi",
      "Acil Servis Hemşiresi", "Ameliyathane Hemşiresi", "Diyaliz Hemşiresi",
      "Enfeksiyon Kontrol Hemşiresi", "Eğitim Hemşiresi", "Ebe", "Sorumlu Ebe",
    ],
  },
  {
    group: "Hekimler", type: "MEMUR",
    titles: ["Uzman Doktor", "Pratisyen Hekim", "Asistan Doktor", "Diş Hekimi", "Başhekim", "Başhekim Yardımcısı"],
  },
  {
    group: "Sağlık Teknik ve Yardımcı Personel", type: "MEMUR",
    titles: [
      "Acil Tıp Teknisyeni (ATT)", "Paramedik", "Sağlık Memuru", "Sağlık Teknikeri",
      "Anestezi Teknikeri", "Radyoloji Teknikeri", "Röntgen Teknisyeni", "Laboratuvar Teknikeri",
      "Laborant", "Diyaliz Teknikeri", "Ameliyathane Teknikeri", "Fizyoterapist", "Diyetisyen",
      "Psikolog", "Sosyal Çalışmacı", "Eczacı", "Ecza Teknisyeni", "Biyolog", "Odyometrist",
    ],
  },
  {
    group: "İdari ve Büro Personeli", type: "MEMUR",
    titles: [
      "Tıbbi Sekreter", "Sağlık Bakım Hizmetleri Müdürü", "İdari ve Mali İşler Müdürü",
      "Müdür Yardımcısı", "Şef", "Memur", "Veri Hazırlama ve Kontrol İşletmeni (VHKİ)",
      "Ayniyat Saymanı", "Muhasebe Personeli", "Satın Alma Personeli", "İnsan Kaynakları Personeli",
      "Arşiv Personeli", "Kalite Birimi Personeli", "Halkla İlişkiler Personeli",
      "Hasta Hakları Personeli", "Bilgi İşlem Personeli",
    ],
  },
  {
    group: "Destek Hizmetleri (İşçi)", type: "ISCI",
    titles: [
      "Temizlik Personeli", "Temizlik Sorumlusu", "Hasta Bakım Personeli", "Hasta Bakıcı",
      "Hasta Kabul Personeli", "Hasta Karşılama / Yönlendirme", "Hasta Taşıma / Transfer Personeli",
      "Güvenlik Görevlisi", "Özel Güvenlik Sorumlusu", "Şoför", "Ambulans Şoförü",
      "Aşçı", "Aşçı Yardımcısı", "Yemekhane Personeli", "Bulaşıkçı", "Çamaşırhane Personeli",
      "Ütücü", "Terzi", "Sterilizasyon Personeli", "Morg Görevlisi", "Depo Personeli",
      "Santral Operatörü", "Çağrı Merkezi Personeli", "Kurye / Evrak Taşıma", "Bahçıvan",
      "Çay Ocağı Personeli", "Büro Personeli (İşçi)",
    ],
  },
  {
    group: "Teknik Hizmetler (İşçi)", type: "ISCI",
    titles: [
      "Teknik Servis Personeli", "Elektrik Teknisyeni", "Elektrikçi", "Tesisatçı",
      "Kaloriferci / Kazan Operatörü", "Biyomedikal Teknisyeni", "Klima Teknisyeni",
      "Asansör Teknisyeni", "Jeneratör Operatörü", "Medikal Gaz Teknisyeni",
      "Marangoz", "Boyacı", "Kaynakçı",
    ],
  },
];

/** Ünvanın bağlı olduğu grubun önerdiği sınıf (listede yoksa null). */
export function suggestedTypeForTitle(title: string): PersonnelType | null {
  const t = title.trim().toLocaleLowerCase("tr");
  if (!t) return null;
  for (const g of TITLE_GROUPS) {
    if (g.titles.some(x => x.toLocaleLowerCase("tr") === t)) return g.type;
  }
  return null;
}

export function personnelTypeLabel(t: string | null | undefined): string {
  if (t === "ISCI" || t === "MEMUR" || t === "HEMSIRE") return PERSONNEL_TYPE_META[t].label;
  return "Memur";
}

/** Rozete tıklayınca sınıfı döndürür: Memur → İşçi → Hemşire → Memur… */
export function cyclePersonnelType(t: string | null | undefined): PersonnelType {
  if (t === "MEMUR") return "ISCI";
  if (t === "ISCI") return "HEMSIRE";
  return "MEMUR";
}

export function isValidPersonnelType(t: unknown): t is PersonnelType {
  return t === "ISCI" || t === "MEMUR" || t === "HEMSIRE";
}

export type Department = {
  id: string; name: string;
  sorumluHemsire: string | null; hemsireUnvan: string | null;
  saglikBakimMuduru: string | null; saglikBakimUnvan: string | null;
  bashekim: string | null; bashekimUnvan: string | null;
  managerName: string | null;
};

export type Personnel = {
  id: string; name: string; fullName: string | null; tcNo: string | null;
  personnelType: PersonnelType; isActive: boolean; departmentId: string | null;
  departmentIds: string[];
  title: string | null; phone: string | null; email: string | null;
  emergencyContact: string | null; address: string | null; startDate: string | null; notes: string | null;
  annualLeaveBalance: number | null; sickLeaveBalance: number | null; unpaidLeaveBalance: number | null;
  /** Profil fotoğrafı var mı (görsel ayrı uçtan sunulur, listeler hafif kalır). */
  hasAvatar?: boolean;
  /** Tarayıcı önbelleğini tazelemek için sürüm damgası. */
  avatarUpdatedAt?: string | null;
};

/** Personelin profil fotoğrafı adresi (yoksa null). */
export function avatarSrc(p: { id: string; hasAvatar?: boolean; avatarUpdatedAt?: string | null }): string | null {
  if (!p.hasAvatar) return null;
  const v = p.avatarUpdatedAt ? Date.parse(p.avatarUpdatedAt) || 0 : 0;
  return `/api/personnel/avatar/${p.id}${v ? `?v=${v}` : ""}`;
}

/** Ad-soyaddan baş harfler (fotoğraf yoksa yedek gösterim). */
export function personInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(x => x[0]).join("").slice(0, 2).toLocaleUpperCase("tr");
}

export type TimesheetEntry = {
  id: string; personnelId: string; entryDate: string; shiftType: string; hoursWorked: number; notes: string | null;
};

export type Holiday = { id: string; holidayDate: string; name: string };

export type ShiftSchedule = {
  id: string; departmentId: string; scheduleDate: string; personnelId: string;
  shiftSlot: string; shiftLabel: string | null; startTime: string | null; endTime: string | null;
  columnKey: string | null;
  notes: string | null; createdAt: string;
};

export type WeeklyOverride = {
  personnelId: string; weekIndex: number; worked: number | null; night: number | null; extra: number | null; holiday: number | null;
};

export type LeaveRequest = {
  id: string; personnelId: string; leaveType: string; startDate: string; endDate: string;
  daysCount: number; reason: string | null; status: string; approvalStage: string;
  reasonHemsire?: string | null;
  stageHemsireBy: string | null; stageHemsireAt: string | null;
  stageMudurBy: string | null; stageMudurAt: string | null;
  stageBashekimBy: string | null; stageBashekimAt: string | null;
  decidedBy: string | null; decidedAt: string | null; decisionNote: string | null;
  createdAt: string;
};

export type SwapRequest = {
  id: string; requesterId: string; requesterShiftId: string | null;
  targetPersonnelId: string | null; targetShiftId: string | null;
  swapDate: string; reason: string | null; status: string;
  decidedBy: string | null; decidedAt: string | null; createdAt: string;
};

/** Nöbet çizelgesi sütunu: ızgaranın "Hizmet (Saat aralığı)" başlıkları. */
export type DutyColumn = {
  id: string; departmentId: string; periodYear: number; periodMonth: number; key: string;
  service: string; shiftLabel: string; startTime: string; endTime: string; position: number;
};

/** Referans projeyle aynı: sütun anahtarı "Hizmet¦Saat Etiketi". */
export function dutyColumnKey(service: string, shiftLabel: string) {
  return `${String(service || "").trim()}¦${String(shiftLabel || "").trim()}`;
}
export function formatDutyColumn(c: { service: string; shiftLabel: string }) {
  return c.service ? `${c.service} (${c.shiftLabel})` : c.shiftLabel;
}

/** Vardiya şablonu = kaydedilmiş sütun düzeni (referans: duty-template-state). */
export type TemplateColumn = { service: string; shiftLabel: string; startTime: string; endTime: string };
export type ShiftTemplate = {
  id: string; departmentId: string | null; name: string; shiftCount: number; slots: TemplateColumn[] | unknown;
};

/** Eski (kişi-sayılı slot) ve yeni (sütun düzeni) şablon biçimlerini normalize eder. */
export function normalizeTemplateColumns(raw: unknown): TemplateColumn[] {
  if (!Array.isArray(raw)) return [];
  const out: TemplateColumn[] = [];
  for (const item of raw as Record<string, unknown>[]) {
    if (!item || typeof item !== "object") continue;
    const start = String(item.start ?? item.startTime ?? "08:00");
    const end = String(item.end ?? item.endTime ?? "16:00");
    const service = String(item.service ?? "").trim();
    const shiftLabel = String(item.shiftLabel ?? item.label ?? `${start}–${end}`).trim();
    if (!shiftLabel) continue;
    out.push({ service, shiftLabel, startTime: start, endTime: end });
  }
  return out;
}

export type Announcement = {
  id: string; departmentId: string | null; title: string; body: string; kind: string;
  createdBy: string | null; createdAt: string;
};

// ─── Takvim yardımcıları ───
export function dayName(year: number, month: number, day: number) {
  return DAYS_TR[new Date(year, month, day).getDay()];
}
export function isWeekendDay(year: number, month: number, day: number) {
  const d = new Date(year, month, day).getDay();
  return d === 0 || d === 6;
}
export function isWeeklyRestDay(year: number, month: number, day: number) {
  return new Date(year, month, day).getDay() === 0;
}
export function buildWeeks(year: number, month: number, daysInMonth: number): number[][] {
  const weeks: number[][] = [];
  let week: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (new Date(year, month, d).getDay() === 0 || d === daysInMonth) {
      weeks.push(week);
      week = [];
    }
  }
  return weeks;
}
export function requiredDailyHours(type: PersonnelType | string) {
  if (type === 'ISCI') return 7.5;   // İşçi: 45 saat / hafta
  return 40 / 6;                      // Memur + Hemşire: 40 saat / hafta
}

export function fmtDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function fmtTr(dateStr: string) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}
export function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

export function personnelInDepartment(p: Personnel, deptId: string) {
  return p.departmentId === deptId || p.departmentIds.includes(deptId);
}

// ─── Vardiya saat aralıkları (kaynak projedeki SHIFT_SLOTS) ───
export const SHIFT_SLOTS: { key: string; label: string; start: string; end: string; isNight: boolean }[] = [
  { key: '07-19', label: '07:00 – 19:00 (12s Gündüz)', start: '07:00', end: '19:00', isNight: false },
  { key: '19-07', label: '19:00 – 07:00 (12s Gece)',   start: '19:00', end: '07:00', isNight: true  },
  { key: '08-20', label: '08:00 – 20:00 (12s Gündüz)', start: '08:00', end: '20:00', isNight: false },
  { key: '20-08', label: '20:00 – 08:00 (12s Gece)',   start: '20:00', end: '08:00', isNight: true  },
  { key: '06-14', label: '06:00 – 14:00 (8s Gündüz)',  start: '06:00', end: '14:00', isNight: false },
  { key: '14-22', label: '14:00 – 22:00 (8s Akşam)',   start: '14:00', end: '22:00', isNight: false },
  { key: '22-06', label: '22:00 – 06:00 (8s Gece)',    start: '22:00', end: '06:00', isNight: true  },
  { key: '08-16', label: '08:00 – 16:00 (8s Gündüz)',  start: '08:00', end: '16:00', isNight: false },
  { key: '16-24', label: '16:00 – 00:00 (8s Akşam)',   start: '16:00', end: '00:00', isNight: false },
  { key: '00-08', label: '00:00 – 08:00 (8s Gece)',    start: '00:00', end: '08:00', isNight: true  },
  { key: '09-17', label: '09:00 – 17:00 (8s Gündüz)',  start: '09:00', end: '17:00', isNight: false },
  { key: 'YEMEK', label: 'Yemek Ocağı (8s)',           start: '08:00', end: '16:00', isNight: false },
  { key: 'CUSTOM', label: 'Özel (saat aralığını sen seç)', start: '08:00', end: '16:00', isNight: false },
];

export function slotByKey(key: string) {
  return SHIFT_SLOTS.find(s => s.key === key);
}

// Nöbet çizelgesi gün başlığında gösterilen hizmet satırları (kaynak projedeki DUTY_COLUMNS)
export const DUTY_SLOTS = ['07-19', '06-14', '19-07'];

// ─── İzin tipleri (kaynak LEAVE_TYPES) ───
export type LeaveTypeKey = 'YILLIK' | 'MAZERET' | 'RAPOR' | 'UCRETSIZ' | 'IDARI' | 'DOGUM' | 'BABALIK' | 'OLUM' | 'EVLILIK';

export const LEAVE_TYPES: { key: LeaveTypeKey; label: string; code: string; color: string }[] = [
  { key: 'YILLIK',   label: 'Yıllık İzin',       code: 'YIL', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { key: 'MAZERET',  label: 'Mazeret İzni',      code: 'MAZ', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  { key: 'RAPOR',    label: 'Rapor (Sağlık)',    code: 'RAP', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  { key: 'UCRETSIZ', label: 'Ücretsiz İzin',     code: 'ÜCR', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { key: 'IDARI',    label: 'İdari İzin',        code: 'İDA', color: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
  { key: 'DOGUM',    label: 'Doğum İzni',        code: 'DOĞ', color: 'bg-pink-500/20 text-pink-300 border-pink-500/40' },
  { key: 'BABALIK',  label: 'Babalık İzni',      code: 'BAB', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
  { key: 'OLUM',     label: 'Ölüm İzni',         code: 'ÖLÜ', color: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
  { key: 'EVLILIK',  label: 'Evlilik İzni',      code: 'EVL', color: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40' },
];

export const LEAVE_CODE_MAP: Record<string, { code: string; label: string; color: string }> =
  Object.fromEntries(LEAVE_TYPES.map(t => [t.key, { code: t.code, label: t.label, color: t.color }]));

/** Puantaj hücresinde izin kodunu gösterirken kullanılacak ters eşleme (YILLIK → YIL) */
export function leaveCodeFor(shiftType: string): string | null {
  return LEAVE_CODE_MAP[shiftType]?.code ?? null;
}

export const APPROVAL_FLOW: { stage: string; label: string; short: string }[] = [
  { stage: 'HEMSIRE',  label: 'Sorumlu Hemşire Onayı', short: 'Sorumlu Hemşire' },
  { stage: 'MUDUR',    label: 'Sağlık Bakım Müdürü Onayı', short: 'Sağlık Bakım Müdürü' },
  { stage: 'BASHEKIM', label: 'Başhekim Onayı', short: 'Başhekim' },
];

export function nextStage(s: string): string {
  return s === 'HEMSIRE' ? 'MUDUR' : s === 'MUDUR' ? 'BASHEKIM' : 'DONE';
}

/** Vardiya saat aralığı 22:00–06:00 penceresine giriyorsa "gece" say (kaynak projeyle aynı). */
export function isNightRange(start?: string | null, end?: string | null): boolean {
  if (!start || !end) return false;
  const [sh] = start.split(':').map(Number);
  const [eh] = end.split(':').map(Number);
  if (eh < sh) return true;
  if (sh >= 20 || sh < 6) return true;
  if (eh <= 6) return true;
  return false;
}

/** Saat çakışması kontrolü için aralık yardımcıları (kaynak projeyle aynı). */
export function toIntervals(start: string, end: string): Array<[number, number]> {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm;
  const e0 = eh * 60 + em;
  if (e0 <= s) return [[s, 1440], [0, e0]];
  return [[s, e0]];
}
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const A = toIntervals(aStart, aEnd);
  const B = toIntervals(bStart, bEnd);
  for (const [as, ae] of A) for (const [bs, be] of B) {
    if (as < be && bs < ae) return true;
  }
  return false;
}

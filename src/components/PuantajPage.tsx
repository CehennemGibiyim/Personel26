"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Calendar, FileSpreadsheet, FileText, Printer, UserPlus, Users, FileSignature,
  RefreshCw, Info,
} from "lucide-react";
import {
  MONTHS, DAYS_FULL, type Department, type Personnel, type TimesheetEntry, type Holiday,
  type ShiftSchedule, type WeeklyOverride, type LeaveRequest, type PersonnelType,
  dayName, isWeekendDay, isWeeklyRestDay, buildWeeks, requiredDailyHours, fmtDate,
  personnelInDepartment, slotByKey, isNightRange, LEAVE_CODE_MAP,
  PERSONNEL_TYPE_META, cyclePersonnelType,
} from "@/lib/shared";
import { getShiftMetrics, normalizeShiftCode, isKnownCode, getShiftRangeMetrics } from "@/lib/puantaj-engine";
import { fetchJson } from "@/lib/fetcher";
import { Btn, Spinner } from "@/components/ui-kit";
import { AddPersonnelModal, PersonnelManageModal, SignatureModal } from "@/components/modals";
import PrintArea, { openPrintPreview } from "@/components/PrintArea";

// ─────────────────────────────────────────────
// Puantaj hücre girişi (kod veya saat — kaynak ShiftCodeCell)
// ─────────────────────────────────────────────
function ShiftCodeCell({ value, disabled, onCommit, title, className }: {
  value: string; disabled: boolean; onCommit: (val: string) => void; title: string; className: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      type="text"
      value={draft}
      title={title}
      disabled={disabled}
      maxLength={5}
      onChange={e => setDraft(e.target.value.toUpperCase().replace(/[^0-9A-ZİÜÖÇĞŞ.,]/g, ""))}
      onBlur={() => {
        const normalized = draft.trim().replace(",", ".").toUpperCase();
        setDraft(normalized);
        if (normalized !== value) onCommit(normalized);
      }}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={className}
    />
  );
}

function grossHours(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh + em / 60) - (sh + sm / 60);
  if (diff <= 0) diff += 24;
  return diff;
}

export default function PuantajPage({
  departments, personnel, holidays, selectedDept, year, month,
  onPersonnelChanged,
}: {
  departments: Department[];
  personnel: Personnel[];
  holidays: Holiday[];
  selectedDept: string;
  year: number; month: number;
  onPersonnelChanged: () => Promise<void> | void;
}) {
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [scheds, setScheds] = useState<ShiftSchedule[]>([]);
  const [overrides, setOverrides] = useState<WeeklyOverride[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeWeek, setActiveWeek] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showSig, setShowSig] = useState(false);
  const [deptList, setDeptList] = useState<Department[]>(departments);
  useEffect(() => setDeptList(departments), [departments]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const allDays = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);
  const weeks = useMemo(() => buildWeeks(year, month, daysInMonth), [year, month, daysInMonth]);
  const holidayMap = useMemo(() => new Map(holidays.map(h => [h.holidayDate, h.name])), [holidays]);

  const dept = deptList.find(d => d.id === selectedDept);
  const deptName = dept?.name ?? "";

  const filteredPersonnel = useMemo(
    () => personnel.filter(p => personnelInDepartment(p, selectedDept) && p.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [personnel, selectedDept]
  );

  function fmt(d: number) { return fmtDate(year, month, d); }
  function isHoliday(d: number) { return holidayMap.has(fmt(d)); }
  function holidayLabel(d: number) { return holidayMap.get(fmt(d)) ?? ""; }

  // ═════ Veri yükleme (zaman aşımı + hata görünürlüğü) ═════
  async function load() {
    setLoading(true);
    setLoadError("");
    const ids = filteredPersonnel.map(p => p.id);
    if (!ids.length) { setEntries([]); setScheds([]); setOverrides([]); setApprovedLeaves([]); setLoading(false); return; }
    try {
      const data = await fetchJson(`/api/timesheet?year=${year}&month=${month}&dept=${selectedDept}&personnel=${ids.join(",")}`) as {
        entries?: TimesheetEntry[]; schedules?: ShiftSchedule[];
        overrides?: (WeeklyOverride & { weekIndex: number })[];
        approvedLeaves?: LeaveRequest[];
      };
      setEntries(data.entries ?? []);
      setScheds(data.schedules ?? []);
      setOverrides((data.overrides ?? []).map(o => ({
        personnelId: o.personnelId, weekIndex: o.weekIndex, worked: o.worked, night: o.night, extra: o.extra, holiday: o.holiday,
      })));
      setApprovedLeaves(data.approvedLeaves ?? []);
    } catch (e) {
      // Spinner'ın asılı kalmaması + hatanın görünür olması kritik.
      setLoadError(e instanceof Error ? e.message : "Veriler yüklenemedi");
      setEntries([]); setScheds([]); setOverrides([]); setApprovedLeaves([]);
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedDept) load(); }, [selectedDept, year, month, personnel]);
  useEffect(() => {
    // Aktif haftayı bugünün haftasına getir (mevcut aysa)
    const now = new Date();
    if (now.getFullYear() === year && now.getMonth() === month) {
      const idx = weeks.findIndex(wk => wk.includes(now.getDate()));
      setActiveWeek(idx >= 0 ? idx : 0);
    } else setActiveWeek(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  // ═════ Hesaplamalar ═════
  function getEntry(personId: string, day: number) {
    return entries.find(e => e.personnelId === personId && e.entryDate === fmt(day));
  }
  function getHours(personId: string, day: number): number {
    return getEntry(personId, day)?.hoursWorked || 0;
  }
  function isOnLeaveDay(personId: string, day: number) {
    const date = fmt(day);
    return approvedLeaves.some(l => l.personnelId === personId && date >= l.startDate && date <= l.endDate);
  }
  function weekRequired(wk: number[], type: PersonnelType, personId?: string) {
    const n = wk.filter(d => !isWeeklyRestDay(year, month, d) && !isHoliday(d) && (!personId || !isOnLeaveDay(personId, d))).length;
    return Math.round(n * requiredDailyHours(type) * 100) / 100;
  }
  function weekWorked(personId: string, wk: number[]) {
    return Math.round(wk.reduce((s, d) => s + getHours(personId, d), 0) * 100) / 100;
  }
  function weeklyOverride(personId: string, weekIndex: number) {
    return overrides.find(o => o.personnelId === personId && o.weekIndex === weekIndex);
  }
  // Fazla mesai (hafta sonu ×1.5), Bayram (resmî tatil ×2), Gece (22:00–06:00 net)
  function overtimeFor(person: Personnel, days: number[]) {
    let fmRaw = 0, bmRaw = 0, gm = 0;
    for (const d of days) {
      const hrs = getHours(person.id, d);
      if (isHoliday(d)) bmRaw += hrs;
      else if (isWeekendDay(year, month, d)) fmRaw += hrs;
      const dateStr = fmt(d);
      for (const s of scheds.filter(x => x.personnelId === person.id && x.scheduleDate === dateStr)) {
        if (isNightRange(s.startTime, s.endTime)) {
          gm += getShiftRangeMetrics(s.startTime, s.endTime).worked;
        }
      }
    }
    return {
      fm: Math.round(fmRaw * 1.5 * 100) / 100,
      bm: Math.round(bmRaw * 2 * 100) / 100,
      gm: Math.round(gm * 100) / 100,
    };
  }
  function weekMetric(personId: string, weekIndex: number, wk: number[], field: "worked" | "night" | "extra" | "holiday") {
    const ov = weeklyOverride(personId, weekIndex);
    const v = ov?.[field];
    if (v !== null && v !== undefined) return Number(v) || 0;
    if (field === "worked") return weekWorked(personId, wk);
    const person = filteredPersonnel.find(p => p.id === personId);
    if (!person) return 0;
    return overtimeFor(person, wk)[field === "night" ? "gm" : field === "extra" ? "fm" : "bm"];
  }
  function monthStats(person: Personnel) {
    const required = Math.round(
      allDays.filter(d => !isWeeklyRestDay(year, month, d) && !isHoliday(d) && !isOnLeaveDay(person.id, d)).length
      * requiredDailyHours(person.personnelType) * 100) / 100;
    const worked = Math.round(weeks.reduce((s, wk, i) => s + weekMetric(person.id, i, wk, "worked"), 0) * 100) / 100;
    const workDays = allDays.filter(d => getHours(person.id, d) > 0).length;
    return { required, worked, workDays, diff: Math.round((worked - required) * 100) / 100 };
  }

  function getPuantajCode(personId: string, day: number): string {
    const entry = getEntry(personId, day);
    if (!entry) return "";
    const leave = LEAVE_CODE_MAP[entry.shiftType];
    if (leave) return leave.code;
    if (entry.shiftType !== "MANUAL" && entry.shiftType !== "NOBET") return entry.shiftType;
    if (entry.shiftType === "NOBET") {
      const schedule = scheds.find(s => s.personnelId === personId && s.scheduleDate === fmt(day));
      const slot = schedule ? slotByKey(schedule.shiftSlot) : undefined;
      if (slot) return `${slot.isNight ? "N" : "G"}${grossHours(slot.start, slot.end) >= 12 ? "2" : ""}`;
      // Referans punchCodeForDuty: saat aralığından gündüz/gece kodu üret.
      if (schedule?.startTime && schedule?.endTime) {
        const sh = Number(schedule.startTime.split(":")[0]);
        const eh = Number(schedule.endTime.split(":")[0]);
        const night = eh <= sh || sh >= 18 || sh < 6;
        return `${night ? "N" : "G"}${grossHours(schedule.startTime, schedule.endTime) >= 12 ? "2" : ""}`;
      }
    }
    return entry.hoursWorked ? String(entry.hoursWorked) : "";
  }

  // ═════ Kaydetme ═════
  async function callApi(path: string, method: string, body: unknown) {
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "İşlem başarısız");
    return data;
  }

  async function updatePuantajCode(personId: string, day: number, value: string) {
    const code = normalizeShiftCode(value.replace(",", "."));
    const date = fmt(day);
    const existing = entries.find(e => e.personnelId === personId && e.entryDate === date);
    const metrics = getShiftMetrics(code, isHoliday(day));
    const hours = isKnownCode(code)
      ? metrics.worked
      : /^\d+(?:\.\d+)?$/.test(code) ? Number(code) : 0;
    const shiftType = isKnownCode(code) ? code : "MANUAL";

    if (!code || (hours === 0 && !["İ", "R", "ÜY"].includes(code))) {
      if (existing) {
        await fetch("/api/timesheet", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personnelId: personId, entryDate: date }) });
        setEntries(prev => prev.filter(e => e.id !== existing.id));
      }
      return;
    }
    if (existing) {
      const patch = { shiftType, hoursWorked: hours };
      await callApi("/api/timesheet", "PUT", { personnelId: personId, entryDate: date, ...patch });
      setEntries(prev => prev.map(e => e.id === existing.id ? { ...e, ...patch } : e));
    } else {
      const data = await callApi("/api/timesheet", "PUT", { personnelId: personId, entryDate: date, shiftType, hoursWorked: hours });
      setEntries(prev => [...prev, data.entry]);
    }
  }

  async function saveWeeklyOverride(personId: string, weekIndex: number, field: "worked" | "night" | "extra" | "holiday", value: string) {
    const numeric = value.trim() === "" ? null : Number(value.replace(",", "."));
    if (numeric !== null && !Number.isFinite(numeric)) return;
    const current = weeklyOverride(personId, weekIndex);
    const payload = {
      departmentId: selectedDept, personnelId: personId, periodYear: year, periodMonth: month, weekIndex,
      worked: current?.worked ?? null, night: current?.night ?? null,
      extra: current?.extra ?? null, holiday: current?.holiday ?? null,
      [field]: numeric,
    };
    const data = await callApi("/api/overrides", "PUT", payload);
    const o = data.override;
    setOverrides(prev => [...prev.filter(x => !(x.personnelId === o.personnelId && x.weekIndex === o.weekIndex)), {
      personnelId: o.personnelId, weekIndex: o.weekIndex, worked: o.worked, night: o.night, extra: o.extra, holiday: o.holiday,
    }]);
  }

  async function togglePersonnelType(person: Personnel) {
    const nt = person.personnelType === "ISCI" ? "MEMUR" : "ISCI";
    await callApi("/api/personnel", "PATCH", { id: person.id, personnelType: nt });
    await onPersonnelChanged();
  }

  // ═════ Dışa aktarma (sunucudan gerçek dosya indirimi) ═════
  function exportExcel() {
    window.location.href = `/api/export/puantaj?dept=${selectedDept}&year=${year}&month=${month}&format=xlsx`;
  }

  function exportCSV() {
    window.location.href = `/api/export/puantaj?dept=${selectedDept}&year=${year}&month=${month}&format=csv`;
  }

  // ═════ Tablo render ═════
  function renderTableHead(displayWeeks: number[][], showMonthly: boolean) {
    return (
      <thead>
        <tr>
          <th className="p-head p-name">Personel</th>
          {displayWeeks.map(wk => {
            const globalWi = weeks.indexOf(wk);
            return (
              <Fragment key={`grp-${globalWi}`}>
                {wk.map(d => (
                  <th key={`d-${d}`} title={holidayLabel(d)} className="p-head day-col">
                    <div className={`day-head ${isHoliday(d) ? "dh-holiday" : isWeekendDay(year, month, d) ? "dh-weekend" : "dh-workday"}`}>
                      {d}<small>{dayName(year, month, d)}</small>
                    </div>
                  </th>
                ))}
                <th colSpan={6} className="p-head sum first" style={{ textAlign: "center" }}>
                  {globalWi + 1}. Hafta
                </th>
              </Fragment>
            );
          })}
          {showMonthly && <th colSpan={4} className="p-head sum first" style={{ textAlign: "center" }}>Aylık Özet</th>}
        </tr>
        <tr>
          <th className="p-head p-name" />
          {displayWeeks.map((wk, idx) => (
            <Fragment key={`sub-${idx}`}>
              {wk.map(d => (
                <th key={`s-${d}`} className={`p-head day-col ${isHoliday(d) ? "cell-holiday" : isWeekendDay(year, month, d) ? "cell-weekend" : ""}`} />
              ))}
              <th className="p-head sum c-req first">Gerek.</th>
              <th className="p-head sum c-wrk">Çalış.</th>
              <th className="p-head sum">Fark</th>
              <th className="p-head sum c-extra">Fazla</th>
              <th className="p-head sum c-night">Gece</th>
              <th className="p-head sum c-hol">Bayram</th>
            </Fragment>
          ))}
          {showMonthly && (
            <>
              <th className="p-head sum c-req first">Gerek.</th>
              <th className="p-head sum c-wrk">Çalış.</th>
              <th className="p-head sum">Gün</th>
              <th className="p-head sum">Fark</th>
            </>
          )}
        </tr>
      </thead>
    );
  }

  function renderTableBody(displayWeeks: number[][], showMonthly: boolean) {
    if (filteredPersonnel.length === 0) {
      return (
        <tbody><tr><td colSpan={99} className="py-8 text-center text-white/30 text-sm printdoc-empty">
          Bu departmanda personel yok. &quot;Personel Ekle&quot; ile ekleyebilirsiniz.
        </td></tr></tbody>
      );
    }
    return (
      <tbody>
        {filteredPersonnel.map(person => {
          const ms = monthStats(person);
          const tmeta = PERSONNEL_TYPE_META[person.personnelType] ?? PERSONNEL_TYPE_META.MEMUR;
          return (
            <tr key={person.id} className="p-row">
              <td className="p-name">
                <span className="inline-flex items-center gap-1.5">
                  <button
                    onClick={() => togglePersonnelType(person)}
                    title={`${tmeta.label} (${tmeta.weekly}/hf) — tıkla değiştir`}
                    className={`type-chip ${tmeta.chip}`}
                  >{tmeta.short}</button>
                  <span className="truncate">{person.name}</span>
                </span>
              </td>
              {displayWeeks.map(wk => {
                const globalWi = weeks.indexOf(wk);
                const wReq = weekRequired(wk, person.personnelType, person.id);
                const wWrk = weekMetric(person.id, globalWi, wk, "worked");
                const wDiff = Math.round((wWrk - wReq) * 100) / 100;
                const wNight = weekMetric(person.id, globalWi, wk, "night");
                const wExtra = weekMetric(person.id, globalWi, wk, "extra");
                const wHoliday = weekMetric(person.id, globalWi, wk, "holiday");
                return (
                  <Fragment key={`row-${person.id}-w${globalWi}`}>
                    {wk.map(d => {
                      const code = getPuantajCode(person.id, d);
                      const entry = getEntry(person.id, d);
                      const leave = entry ? LEAVE_CODE_MAP[entry.shiftType] : null;
                      const hol = isHoliday(d);
                      const wknd = isWeekendDay(year, month, d);
                      return (
                        <td key={`c-${d}`} className={`p-td day-col ${leave ? "cell-leave" : hol ? "cell-holiday" : wknd ? "cell-weekend" : ""}`}>
                          <ShiftCodeCell
                            value={leave ? leave.code : code}
                            disabled={Boolean(leave)}
                            onCommit={val => updatePuantajCode(person.id, d, val)}
                            title={`${person.name} — ${d} ${dayName(year, month, d)}${holidayLabel(d) ? " · " + holidayLabel(d) : ""}${leave ? " · İzin: " + leave.label : ""}`}
                            className={`day-inp ${leave ? "leave" : hol ? "holiday" : wknd ? "weekend" : ""}`}
                          />
                        </td>
                      );
                    })}
                    <td className="p-td sum c-req first">{wReq}</td>
                    <td className={`p-td sum ${wWrk >= wReq ? "c-wrk" : "c-diff-neg"}`}>
                      <input
                        key={`wo-${person.id}-${globalWi}-${wWrk}`}
                        defaultValue={wWrk || ""}
                        onBlur={e => saveWeeklyOverride(person.id, globalWi, "worked", e.target.value)}
                        className="o-inp" title="Haftalık çalışılan (elle düzeltilebilir)"
                      />
                    </td>
                    <td className={`p-td sum ${wDiff >= 0 ? "c-diff-pos" : "c-diff-neg"}`}>{wDiff > 0 ? `+${wDiff}` : wDiff}</td>
                    <td className="p-td sum c-extra">
                      <input key={`oe-${person.id}-${globalWi}-${wExtra}`} defaultValue={wExtra || ""} onBlur={e => saveWeeklyOverride(person.id, globalWi, "extra", e.target.value)} className="o-inp" title="Fazla mesai (elle düzeltilebilir)" />
                    </td>
                    <td className="p-td sum c-night">
                      <input key={`on-${person.id}-${globalWi}-${wNight}`} defaultValue={wNight || ""} onBlur={e => saveWeeklyOverride(person.id, globalWi, "night", e.target.value)} className="o-inp" title="Gece mesaisi (elle düzeltilebilir)" />
                    </td>
                    <td className="p-td sum c-hol">
                      <input key={`oh-${person.id}-${globalWi}-${wHoliday}`} defaultValue={wHoliday || ""} onBlur={e => saveWeeklyOverride(person.id, globalWi, "holiday", e.target.value)} className="o-inp" title="Bayram mesaisi (elle düzeltilebilir)" />
                    </td>
                  </Fragment>
                );
              })}
              {showMonthly && (
                <>
                  <td className="p-td sum c-req first">{ms.required}</td>
                  <td className={`p-td sum ${ms.worked >= ms.required ? "c-wrk" : "c-diff-neg"}`}>{ms.worked}</td>
                  <td className="p-td sum" style={{ color: "inherit", opacity: .7 }}>{ms.workDays}</td>
                  <td className={`p-td sum ${ms.diff >= 0 ? "c-diff-pos" : "c-diff-neg"}`}>{ms.diff > 0 ? `+${ms.diff}` : ms.diff}</td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    );
  }

  const signatureBlock = (
    <div className="sig-grid print:sig-only">
      {[
        { unvan: dept?.hemsireUnvan ?? "Sorumlu Hemşire", isim: dept?.sorumluHemsire },
        { unvan: dept?.saglikBakimUnvan ?? "Sağlık Bakım Hizmetleri Müdürü", isim: dept?.saglikBakimMuduru },
        { unvan: dept?.bashekimUnvan ?? "Başhekim", isim: dept?.bashekim },
      ].map((s, i) => (
        <div key={i}>
          <div className="sig-line" />
          <div className="who">{s.unvan}</div>
          <div className="title">{s.isim || "………………………………"}</div>
        </div>
      ))}
    </div>
  );

  const printWeeks1 = weeks.slice(0, 3);
  const printWeeks2 = weeks.slice(3);

  if (loadError && !loading) {
    return (
      <div className="panel p-8 text-center max-w-lg mx-auto anim-slide">
        <div className="text-amber-400 font-bold text-sm mb-2">Puantaj verisi yüklenemedi</div>
        <div className="text-rose-300/90 text-xs bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 inline-block break-words">{loadError}</div>
        <p className="text-white/40 text-xs mt-2.5">Yenile ile tekrar deneyin; diğer menüler çalışmaya devam eder.</p>
        <div className="flex justify-center gap-2 mt-4">
          <Btn small variant="primary" onClick={() => load()}><RefreshCw className="w-3.5 h-3.5" /> Tekrar Yükle</Btn>
          <Btn small onClick={() => window.location.reload()}>Sayfayı Yenile</Btn>
        </div>
      </div>
    );
  }
  if (loading && entries.length === 0) return <Spinner label="Puantaj yükleniyor…" />;

  return (
    <div className="space-y-3">
      {/* Araç çubuğu */}
      <div className="flex flex-wrap items-center gap-2">
        <Btn small variant="primary" onClick={() => setShowAdd(true)}><UserPlus className="w-3.5 h-3.5" /> Personel Ekle</Btn>
        <Btn small onClick={() => setShowManage(true)}><Users className="w-3.5 h-3.5" /> Personel Yönet</Btn>
        <Btn small onClick={() => setShowSig(true)}><FileSignature className="w-3.5 h-3.5" /> İmza Alanları</Btn>
        <div className="flex-1" />
        <Btn small onClick={() => load()} title="Yenile"><RefreshCw className="w-3.5 h-3.5" /></Btn>
        <Btn small variant="success" onClick={exportExcel}><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</Btn>
        <Btn small onClick={exportCSV}><FileText className="w-3.5 h-3.5" /> CSV</Btn>
        <Btn small variant="amber" onClick={openPrintPreview}><Printer className="w-3.5 h-3.5" /> Yazdır / PDF</Btn>
      </div>

      {/* Hafta sekmeleri */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {weeks.map((wk, i) => (
          <button key={i} onClick={() => setActiveWeek(i)} className={`week-tab ${activeWeek === i ? "is-active" : ""}`}>
            <span className="week-tab-idx">{i + 1}</span>
            <span>{i + 1}. Hafta</span>
            <small>{wk[0]}-{wk[wk.length - 1]} {MONTHS[month].slice(0, 3)}</small>
          </button>
        ))}
      </div>

      {/* Ana haftalık tablo */}
      <div className={`panel overflow-hidden ${loading ? "opacity-60 pointer-events-none" : ""}`}>
        <div className="overflow-x-auto pui">
          <table>
            {renderTableHead([weeks[activeWeek] ?? weeks[0]], false)}
            {renderTableBody([weeks[activeWeek] ?? weeks[0]], false)}
          </table>
        </div>
      </div>

      {/* Aylık Özet */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400" />
          <h2 className="text-white font-semibold text-sm">Aylık Özet</h2>
        </div>
        <div className="overflow-x-auto pui">
          <table>
            <thead>
              <tr>
                <th className="p-head p-name">Personel</th>
                <th className="p-head c-req">Gereken</th>
                <th className="p-head c-wrk">Çalışılan</th>
                <th className="p-head c-night">Gece</th>
                <th className="p-head c-extra">Fazla</th>
                <th className="p-head c-hol">Bayram</th>
                <th className="p-head">Durum</th>
              </tr>
            </thead>
            <tbody>
              {filteredPersonnel.map(person => {
                const ms = monthStats(person);
                const ot = overtimeFor(person, allDays);
                const diff = ms.diff;
                return (
                  <tr key={`m-${person.id}`} className="p-row">
                    <td className="p-td p-name">{person.name}</td>
                    <td className="p-td c-req" style={{ fontWeight: 700 }}>{ms.required}</td>
                    <td className={`p-td ${diff >= 0 ? "c-wrk" : "c-diff-neg"}`} style={{ fontWeight: 700 }}>{ms.worked}</td>
                    <td className="p-td c-night">{ot.gm}</td>
                    <td className="p-td c-extra">{ot.fm}</td>
                    <td className="p-td c-hol">{ot.bm}</td>
                    <td className={`p-td ${diff >= 0 ? "c-diff-pos" : "c-diff-neg"}`} style={{ fontWeight: 800 }}>
                      {diff > 0 ? `+${diff}` : diff} saat
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Haftalık mesai özeti */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-pink-400" />
          <h2 className="text-white font-semibold text-sm">Haftalık Mesai Özeti — Fazla Mesai (×1.5), Gece ve Bayram Mesaisi (×2)</h2>
        </div>
        <div className="overflow-x-auto pui">
          <table>
            <thead>
              <tr>
                <th className="p-head p-name">Personel</th>
                {weeks.map((_, i) => (
                  <th key={`hw-${i}`} colSpan={6} className="p-head sum first" style={{ textAlign: "center" }}>{i + 1}. Hafta</th>
                ))}
                <th colSpan={5} className="p-head sum first" style={{ textAlign: "center" }}>Ay Sonu</th>
              </tr>
              <tr>
                <th className="p-head p-name" />
                {[...weeks.map((_, i) => i), -1].map((k) => (
                  <Fragment key={`sub-${k}`}>
                    <th className="p-head sum c-req first">Gerek.</th>
                    <th className="p-head sum c-wrk">Çalış.</th>
                    <th className="p-head sum">Fark</th>
                    <th className="p-head sum c-extra">Fazla</th>
                    <th className="p-head sum c-night">Gece</th>
                    {k !== -1 && <th className="p-head sum c-hol">Bayram</th>}
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPersonnel.map(person => {
                const ms = monthStats(person);
                const monthOt = overtimeFor(person, allDays);
                return (
                  <tr key={`ot-${person.id}`} className="p-row">
                    <td className="p-td p-name">{person.name}</td>
                    {weeks.map((wk, i) => {
                      const wReq = weekRequired(wk, person.personnelType, person.id);
                      const wWrk = weekMetric(person.id, i, wk, "worked");
                      const wDiff = Math.round((wWrk - wReq) * 100) / 100;
                      const ot = overtimeFor(person, wk);
                      return (
                        <Fragment key={`otw-${i}`}>
                          <td className="p-td sum c-req first">{wReq}</td>
                          <td className="p-td sum c-wrk">{wWrk}</td>
                          <td className={`p-td sum ${wDiff >= 0 ? "c-diff-pos" : "c-diff-neg"}`}>{wDiff > 0 ? `+${wDiff}` : wDiff}</td>
                          <td className="p-td sum c-extra">{ot.fm || ""}</td>
                          <td className="p-td sum c-night">{ot.gm || ""}</td>
                          <td className="p-td sum c-hol">{ot.bm || ""}</td>
                        </Fragment>
                      );
                    })}
                    <td className="p-td sum c-req first">{ms.required}</td>
                    <td className="p-td sum c-wrk">{ms.worked}</td>
                    <td className={`p-td sum ${ms.diff >= 0 ? "c-diff-pos" : "c-diff-neg"}`}>{ms.diff > 0 ? `+${ms.diff}` : ms.diff}</td>
                    <td className="p-td sum c-extra">{monthOt.fm || ""}</td>
                    <td className="p-td sum c-night">{monthOt.gm || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kod açıklamaları */}
      <div className="panel px-4 py-3 flex flex-wrap gap-x-5 gap-y-1.5 items-center text-white/45 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-white/70 font-semibold"><Info className="w-3.5 h-3.5" /> Hücre Kodları:</span>
        <span><b className="text-sky-300">G</b> Gündüz 8s (7,5 net)</span>
        <span><b className="text-sky-300">G2</b> Gündüz 12s (11 net)</span>
        <span><b className="text-violet-300">N / N2</b> Gece 8s / 12s</span>
        <span><b className="text-amber-300">B / B2</b> Bayram 8s / 12s</span>
        <span><b className="text-emerald-300">İ, R, ÜY</b> İzin / Rapor / Ücretsiz</span>
        <span>Ya da doğrudan saat yazın: <b className="text-white/70">7,5 / 8 / 12</b></span>
      </div>

      {/* İmza bloğu (ekran) */}
      <div className="panel pui px-4 pt-3 pb-6">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-2 flex items-center gap-2">
          <FileSignature className="w-3.5 h-3.5" /> İmzalar
          <button onClick={() => setShowSig(true)} className="text-sky-400 hover:text-sky-300 normal-case font-medium">Düzenle</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl">
          {[
            { unvan: dept?.hemsireUnvan ?? "Sorumlu Hemşire", isim: dept?.sorumluHemsire },
            { unvan: dept?.saglikBakimUnvan ?? "Sağlık Bakım Hizmetleri Müdürü", isim: dept?.saglikBakimMuduru },
            { unvan: dept?.bashekimUnvan ?? "Başhekim", isim: dept?.bashekim },
          ].map((s, i) => (
            <div key={i} className="border-t border-white/15 pt-2 mt-8">
              <div className="text-white/70 text-xs font-semibold">{s.unvan}</div>
              <div className="text-white/40 text-xs">{s.isim || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═════ YAZDIRMA ALANI ═════ */}
      <PrintArea>
        <div className="print-title">
          <h1>PERSONEL PUANTAJ CETVELİ</h1>
          <p>{deptName} — {MONTHS[month]} {year}</p>
        </div>
        <div className="pui"><table>{renderTableHead(printWeeks1, false)}{renderTableBody(printWeeks1, false)}</table></div>
        {printWeeks2.length > 0 && (
          <>
            <div style={{ height: 10 }} />
            <div className="pui"><table>{renderTableHead(printWeeks2, true)}{renderTableBody(printWeeks2, true)}</table></div>
          </>
        )}
        <div style={{ marginTop: 6 }}>{signatureBlock}</div>
        <p style={{ marginTop: 8, color: "#6b7280", fontSize: 8 }}>
          Belgelenen saatler nettir (İş Kanunu M.68 mola düşümü uygulanmıştır). Fazla mesai hafta sonu ×1.5, bayram/resmî tatil ×2 olarak özetlenmiştir.
        </p>
      </PrintArea>

      {/* Modallar */}
      {showAdd && (
        <AddPersonnelModal
          departments={deptList}
          defaultDeptId={selectedDept}
          onAdded={() => onPersonnelChanged()}
          onClose={() => setShowAdd(false)}
        />
      )}
      {showManage && dept && (
        <PersonnelManageModal
          department={dept}
          personnel={filteredPersonnel}
          onChanged={() => onPersonnelChanged()}
          onClose={() => setShowManage(false)}
        />
      )}
      {showSig && dept && (
        <SignatureModal
          department={dept}
          onSaved={d => setDeptList(prev => prev.map(x => x.id === d.id ? { ...x, ...d } : x))}
          onClose={() => setShowSig(false)}
        />
      )}
    </div>
  );
}

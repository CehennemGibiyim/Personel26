"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList, CalendarClock, LayoutTemplate, CalendarDays, Repeat, Users,
  Scale, ShieldAlert, Megaphone, DatabaseBackup, Menu, X, Building2, Plus,
  Fingerprint, HeartPulse, MonitorDown,
} from "lucide-react";
import type { Department, Personnel, Holiday, ShiftTemplate } from "@/lib/shared";
import { MonthNav, Btn, Modal, Field, TextInput, cx } from "@/components/ui-kit";
import { downloadPanelPreview } from "@/lib/download-preview";
import PuantajPage from "@/components/PuantajPage";
import NobetPage from "@/components/NobetPage";
import TemplatesPage from "@/components/TemplatesPage";
import LeavesPage from "@/components/LeavesPage";
import SwapPage from "@/components/SwapPage";
import PersonnelPage from "@/components/PersonnelPage";
import AnalysisPage from "@/components/AnalysisPage";
import WarningsPage from "@/components/WarningsPage";
import NotesPage from "@/components/NotesPage";
import BackupPage from "@/components/BackupPage";

type PageKey =
  | "puantaj" | "nobet" | "sablon" | "izin" | "degisim" | "personel"
  | "analiz" | "uyarilar" | "duyuru" | "yedek";

const NAV: { key: PageKey; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: "puantaj", label: "Puantaj", icon: <ClipboardList className="w-[17px] h-[17px]" />, desc: "Aylık çalışma cetveli" },
  { key: "nobet", label: "Nöbet Çizelgesi", icon: <CalendarClock className="w-[17px] h-[17px]" />, desc: "Vardiya atamaları" },
  { key: "sablon", label: "Vardiya Şablonları", icon: <LayoutTemplate className="w-[17px] h-[17px]" />, desc: "2'li / 3'lü düzenler" },
  { key: "izin", label: "İzin Yönetimi", icon: <CalendarDays className="w-[17px] h-[17px]" />, desc: "Talepler ve onay akışı" },
  { key: "degisim", label: "Değişim Talepleri", icon: <Repeat className="w-[17px] h-[17px]" />, desc: "Nöbet takası" },
  { key: "personel", label: "Personel Yönetimi", icon: <Users className="w-[17px] h-[17px]" />, desc: "Ekle, düzenle, departman ata" },
  { key: "analiz", label: "Adalet Analizi", icon: <Scale className="w-[17px] h-[17px]" />, desc: "Nöbet dağılımı" },
  { key: "uyarilar", label: "Mevzuat Uyarıları", icon: <ShieldAlert className="w-[17px] h-[17px]" />, desc: "Dinlenme ve limitler" },
  { key: "duyuru", label: "Duyurular", icon: <Megaphone className="w-[17px] h-[17px]" />, desc: "Servis bildirimleri" },
  { key: "yedek", label: "Yedekleme", icon: <DatabaseBackup className="w-[17px] h-[17px]" />, desc: "Veri güvenliği" },
];

const MONTH_PAGES: PageKey[] = ["puantaj", "nobet", "sablon", "izin", "degisim", "analiz", "uyarilar"];

export type BootstrapPayload = {
  departments: Department[];
  personnel: Personnel[];
  holidays: Holiday[];
  templates: ShiftTemplate[];
  /** Sunucu tarihi: SSR ve istemci aynı ay ile başlar (hidrasyon uyumu). */
  today?: { year: number; month: number };
};

export default function AppShell({ initialData }: { initialData?: BootstrapPayload }) {
  const [departments, setDepartments] = useState<Department[]>(() => initialData?.departments ?? []);
  const [personnel, setPersonnel] = useState<Personnel[]>(() => initialData?.personnel ?? []);
  const [holidays, setHolidays] = useState<Holiday[]>(() => initialData?.holidays ?? []);
  const [templates, setTemplates] = useState<ShiftTemplate[]>(() => initialData?.templates ?? []);
  const [selectedDept, setSelectedDept] = useState(() => initialData?.departments?.[0]?.id ?? "");
  // KRİTİK: İlk render'da sunucu tarihini kullan. new Date() kullanmak,
  // sunucu ve kullanıcı bilgisayarının saatleri farklıysa hidrasyon
  // uyuşmazlığına ve tüm tıklamaların ölmesine (donuk sayfa) yol açar.
  const [year, setYear] = useState(() => initialData?.today?.year ?? new Date().getFullYear());
  const [month, setMonth] = useState(() => initialData?.today?.month ?? new Date().getMonth());
  const [page, setPage] = useState<PageKey>("puantaj");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [bootError, setBootError] = useState("");

  const loadBootstrap = useCallback(async () => {
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bağlantı hatası");
      setDepartments(data.departments ?? []);
      setPersonnel(data.personnel ?? []);
      setHolidays(data.holidays ?? []);
      setTemplates(data.templates ?? []);
      setSelectedDept(prev => (prev && data.departments?.some((d: Department) => d.id === prev)) ? prev : data.departments?.[0]?.id ?? "");
    } catch (e) {
      setBootError(e instanceof Error ? e.message : "Yüklenemedi");
    }
  }, []);

  useEffect(() => {
    if (!initialData || !initialData.departments?.length) {
      loadBootstrap();
    }
  }, [initialData, loadBootstrap]);

  const deptName = departments.find(d => d.id === selectedDept)?.name ?? "";
  const navItem = NAV.find(n => n.key === page)!;

  return (
    <div className="screen-root min-h-screen lg:flex">
      {/* Mobil üst çubuk */}
      <div className="lg:hidden flex items-center gap-2 px-3 py-2.5 border-b border-white/10 bg-[#0a1020]/95 backdrop-blur sticky top-0 z-40">
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg bg-white/5 text-white/70 hover:text-white transition"><Menu className="w-4 h-4" /></button>
        <div className="text-white font-bold text-sm">{navItem.label}</div>
        <div className="flex-1" />
        {MONTH_PAGES.includes(page) && (
          <MonthNav year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        )}
      </div>

      {/* Kenar çubuğu */}
      <aside className={cx(
        "fixed inset-y-0 left-0 z-50 w-[264px] bg-[#090e1b] border-r border-white/[.09] flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto",
        sidebarOpen ? "translate-x-0 shadow-2xl shadow-black" : "-translate-x-full"
      )}>
        <div className="px-4 pt-5 pb-4 border-b border-white/[.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center shadow-lg shadow-sky-950/50">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-black text-[15px] leading-tight" style={{ fontFamily: "var(--font-grotesk)" }}>Personel26</div>
              <div className="text-white/35 text-[10px] font-medium tracking-wide">Puantaj & Nöbet Yönetimi</div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-1.5 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
          {NAV.map(n => (
            <button
              key={n.key}
              type="button"
              onClick={() => { setPage(n.key); setSidebarOpen(false); }}
              className={cx(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition cursor-pointer select-none group",
                page === n.key
                  ? "bg-gradient-to-r from-sky-500/20 to-sky-500/5 border border-sky-400/30 text-white shadow-[inset_2px_0_0_0_#38bdf8]"
                  : "text-white/55 hover:text-white hover:bg-white/[.05] border border-transparent"
              )}
            >
              <span className={cx("pointer-events-none", page === n.key ? "text-sky-400" : "text-white/35 group-hover:text-white/70")}>{n.icon}</span>
              <span className="flex-1 min-w-0 pointer-events-none">
                <span className="block text-[13px] font-bold leading-tight">{n.label}</span>
                <span className="block text-[10px] opacity-60 truncate">{n.desc}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-white/[.08] space-y-2">
          <a
            href="/personel" target="_blank"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/15 transition text-xs font-bold"
          >
            <Fingerprint className="w-4 h-4" />
            <span>
              Personel Sorgu Ekranı
              <span className="block text-[9.5px] font-medium opacity-60">Şifresiz · TC ile giriş</span>
            </span>
          </a>
          <PreviewDownloadButton />
          <p className="text-white/20 text-[9px] px-1 leading-relaxed">
            İzinli personelin nöbet listesinden çıkarılması, dinlenme süreleri ve mükerrer vardiya koruması aktiftir.
          </p>
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* İçerik */}
      <main className="flex-1 min-w-0 relative z-0">
        <header className="hidden lg:flex items-center gap-3 px-6 pt-5 pb-4 sticky top-0 z-30 bg-[#070b14]/85 backdrop-blur-md border-b border-white/[.07]">
          <div className="min-w-[220px]">
            <h1 className="text-white font-black text-xl leading-tight" style={{ fontFamily: "var(--font-grotesk)" }}>{navItem.label}</h1>
            <p className="text-white/35 text-[11px]">{navItem.desc}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Building2 className="w-3.5 h-3.5 text-white/30" />
            {departments.map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDept(d.id)}
                className={cx(
                  "px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer",
                  selectedDept === d.id
                    ? "bg-sky-500/20 border-sky-400/60 text-sky-200 shadow-[0_0_14px_-2px_rgba(56,189,248,.4)]"
                    : "bg-white/[.04] border-white/10 text-white/50 hover:text-white hover:border-white/25"
                )}
              >{d.name}</button>
            ))}
            <button
              onClick={() => setShowDeptModal(true)}
              title="Yeni departman"
              className="p-1.5 rounded-lg border border-dashed border-white/20 text-white/40 hover:text-sky-300 hover:border-sky-400/50 transition"
            ><Plus className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex-1" />
          {MONTH_PAGES.includes(page) && (
            <MonthNav year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          )}
        </header>

        {/* Mobil departman seçimi */}
        <div className="lg:hidden px-3 py-2 flex items-center gap-1.5 overflow-x-auto border-b border-white/[.07]">
          {departments.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDept(d.id)}
              className={cx(
                "px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap transition",
                selectedDept === d.id ? "bg-sky-500/20 border-sky-400/60 text-sky-200" : "bg-white/[.04] border-white/10 text-white/50"
              )}
            >{d.name}</button>
          ))}
        </div>

        <div className="px-3 sm:px-5 lg:px-6 py-4 max-w-[1600px]">
          {selectedDept && (
            <>
              {page === "puantaj" && (
                <PuantajPage
                  departments={departments} personnel={personnel} holidays={holidays}
                  selectedDept={selectedDept} year={year} month={month}
                  onPersonnelChanged={loadBootstrap}
                />
              )}
              {page === "nobet" && (
                <NobetPage departments={departments} personnel={personnel} holidays={holidays} selectedDept={selectedDept} year={year} month={month} />
              )}
              {page === "sablon" && (
                <TemplatesPage
                  departments={departments} personnel={personnel} templates={templates}
                  selectedDept={selectedDept} year={year} month={month} onTemplatesChanged={loadBootstrap}
                />
              )}
              {page === "izin" && <LeavesPage departments={departments} personnel={personnel} selectedDept={selectedDept} year={year} />}
              {page === "degisim" && <SwapPage departments={departments} personnel={personnel} selectedDept={selectedDept} year={year} month={month} />}
              {page === "personel" && <PersonnelPage departments={departments} selectedDept={selectedDept} onPersonnelChanged={loadBootstrap} />}
              {page === "analiz" && <AnalysisPage departments={departments} personnel={personnel} holidays={holidays} selectedDept={selectedDept} year={year} month={month} />}
              {page === "uyarilar" && <WarningsPage departments={departments} personnel={personnel} selectedDept={selectedDept} year={year} month={month} />}
              {page === "duyuru" && <NotesPage departments={departments} selectedDept={selectedDept} />}
            </>
          )}
          {page === "yedek" && <BackupPage />}
        </div>
      </main>

      {showDeptModal && (
        <NewDeptModal onClose={() => setShowDeptModal(false)} onCreated={async (id) => { await loadBootstrap(); setSelectedDept(id); setShowDeptModal(false); }} />
      )}
    </div>
  );
}

function PreviewDownloadButton() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const res = await downloadPanelPreview();
    setBusy(false);
    if (!res.ok) {
      setFailed(true);
      setTimeout(() => setFailed(false), 4000);
    }
  }
  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title="Nöbet Çizelgesi ekranının statik kopyasını index.html olarak indir"
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/15 active:scale-[.98] transition text-xs font-bold text-left disabled:opacity-60"
    >
      <MonitorDown className={`w-4 h-4 shrink-0 ${busy ? "animate-pulse" : ""}`} />
      <span>
        {busy ? "Hazırlanıyor…" : failed ? "Tekrar Dene — Yeni Sekme Açıldı" : "Arayüzü index.html Olarak İndir"}
        <span className="block text-[9.5px] font-medium opacity-60">Tek dosya · paylaşılabilir · internetsiz açılır</span>
      </span>
    </button>
  );
}

function NewDeptModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const data = await res.json();
    setSaving(false);
    if (data.department) onCreated(data.department.id);
  }
  return (
    <Modal title={<><Building2 className="w-4 h-4 text-sky-400" /> Yeni Departman</>} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Departman Adı">
          <TextInput autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="ör. Cerrahi Servisi" onKeyDown={e => e.key === "Enter" && save()} />
        </Field>
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>İptal</Btn>
          <Btn variant="primary" onClick={save} disabled={!name.trim() || saving}>Ekle</Btn>
        </div>
      </div>
    </Modal>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList, CalendarClock, LayoutTemplate, CalendarDays, Repeat, Users,
  Scale, ShieldAlert, Megaphone, DatabaseBackup, Menu, X, Building2, Plus,
  Fingerprint, HeartPulse, MonitorDown, TriangleAlert,
} from "lucide-react";
import type { Department, Personnel, Holiday, ShiftTemplate, BootstrapData } from "@/lib/shared";
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
import ErrorBoundary from "@/components/ErrorBoundary";
import ClientErrorBanner from "@/components/ClientErrorBanner";
import { BUILD_LABEL } from "@/lib/build-info";

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

export default function AppShell({ initialData = null, initialError = null }: {
  initialData?: BootstrapData | null;
  initialError?: string | null;
}) {
  // Sunucudan veri geldiyse EKRAN ANINDA AÇILIR — bekleme ekranı yok.
  const [departments, setDepartments] = useState<Department[]>(initialData?.departments ?? []);
  const [personnel, setPersonnel] = useState<Personnel[]>(initialData?.personnel ?? []);
  const [holidays, setHolidays] = useState<Holiday[]>(initialData?.holidays ?? []);
  const [templates, setTemplates] = useState<ShiftTemplate[]>(initialData?.templates ?? []);
  const [selectedDept, setSelectedDept] = useState(initialData?.departments?.[0]?.id ?? "");
  const [booted, setBooted] = useState(Boolean(initialData));
  const [bootError, setBootError] = useState(initialError ?? "");
  const [bootSlow, setBootSlow] = useState(false);
  const [pending, setPending] = useState(false);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [page, setPage] = useState<PageKey>("puantaj");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const hasData = departments.length > 0;

  const loadBootstrap = useCallback(async (opts?: { background?: boolean; retry?: number }) => {
    const background = opts?.background ?? false;
    const attempt = opts?.retry ?? 0;
    if (background) {
      // Arka plan yenilemesi ASLA ekranda bekleme ekranı göstermez.
      setPending(true);
    } else {
      setBootError("");
      setBootSlow(false);
      if (!hasData) setBooted(false);
    }
    const ctrl = new AbortController();
    const slowTimer = setTimeout(() => setBootSlow(true), 8000);
    const timeout = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store", signal: ctrl.signal });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) throw new Error((data as { error?: string }).error || `Bağlantı hatası (${res.status})`);
      const depts = Array.isArray((data as { departments?: unknown }).departments)
        ? (data as { departments: Department[] }).departments : null;
      if (!depts) throw new Error("Sunucudan geçersiz yanıt alındı.");
      setDepartments(depts);
      setPersonnel((data as { personnel?: Personnel[] }).personnel ?? []);
      setHolidays((data as { holidays?: Holiday[] }).holidays ?? []);
      setTemplates((data as { templates?: ShiftTemplate[] }).templates ?? []);
      setSelectedDept(prev => (prev && depts.some(d => d.id === prev)) ? prev : depts[0]?.id ?? "");
      setBootError("");
      // Veri varsa ilk tercih önümüzdeki kısa bir arka plan yenilemesi.
      // (Sayfanın kendi içeriği bozulmasın diye gönüllü.)
      setBooted(true);
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      const msg = isAbort
        ? "Sunucu yanıt vermiyor (zaman aşımı)."
        : e instanceof Error ? e.message : "Yüklenemedi";
      // Veri yoksa ve deneme hakkı varsa otomatik tekrar dene (8 sn arayla).
      if (!hasData && attempt < 2 && !isAbort) {
        clearTimeout(slowTimer); clearTimeout(timeout);
        setPending(false);
        setTimeout(() => loadBootstrap({ retry: attempt + 1 }), 4000 * (attempt + 1));
        return;
      }
      setBootError(msg);
      setBooted(true);
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(timeout);
      setPending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData]);

  // Yalnızca başlangıçta çalışır (initialData yoksa fetch gerekir).
  useEffect(() => { if (!initialData) loadBootstrap(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sayfa değişiminde başa dön (özellikle mobilde içerik değişimi hissedilir).
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, [page]);

  const deptName = departments.find(d => d.id === selectedDept)?.name ?? "";
  const navItem = NAV.find(n => n.key === page)!;

  if (!booted) {
    return (
      <>
        <ClientErrorBanner />
        <div className="screen-root min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500/30 to-violet-500/30 border border-white/15 flex items-center justify-center">
            <HeartPulse className="w-7 h-7 text-sky-400" />
          </div>
          {bootError ? (
            <>
              <div className="text-rose-300 text-sm font-semibold text-center max-w-xs">{bootError}</div>
              <Btn small onClick={() => loadBootstrap()}>Tekrar Dene</Btn>
              <button onClick={() => window.location.reload()} className="text-white/35 hover:text-white text-[11px] transition">
                Sayfayı yenile
              </button>
            </>
          ) : (
            <>
              <div className="w-7 h-7 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              <div className="text-white/40 text-xs tracking-widest uppercase">Puantaj yükleniyor</div>
              {bootSlow && (
                <div className="text-amber-300/80 text-[11px] text-center max-w-[240px] animate-pulse">
                  Bağlantı yavaş görünüyor, bekleniyor… Uzun sürerse sayfayı yenileyin.
                </div>
              )}
            </>
          )}
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <ClientErrorBanner />
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
              onClick={() => { setPage(n.key); setSidebarOpen(false); }}
              className={cx(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition group",
                page === n.key
                  ? "bg-gradient-to-r from-sky-500/20 to-sky-500/5 border border-sky-400/30 text-white shadow-[inset_2px_0_0_0_#38bdf8]"
                  : "text-white/55 hover:text-white hover:bg-white/[.05] border border-transparent"
              )}
            >
              <span className={cx(page === n.key ? "text-sky-400" : "text-white/35 group-hover:text-white/70")}>{n.icon}</span>
              <span className="flex-1 min-w-0">
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
          <p className="text-white/15 text-[8.5px] px-1">Derleme: {BUILD_LABEL}</p>
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* İçerik */}
      <main className="flex-1 min-w-0">
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
                onClick={() => setSelectedDept(d.id)}
                className={cx(
                  "px-3 py-1.5 rounded-lg border text-xs font-bold transition",
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

        {/* Durum şeridi: arka plan yenileme / bağlantı sorunu */}
        {pending && (
          <div className="px-4 py-2 mx-4 sm:mx-6 mt-3 flex items-center gap-2 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-200 text-xs">
            <span className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            Veriler güncelleniyor…
          </div>
        )}
        {bootError && hasData && (
          <div className="px-4 py-2 mx-4 sm:mx-6 mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs">
            <TriangleAlert className="w-4 h-4 shrink-0" />
            <span className="flex-1">Veri yenilenemedi: {bootError} — ekran güncel olmayabilir.</span>
            <button onClick={() => loadBootstrap({ background: true })} className="font-bold underline hover:text-white">Tekrar Dene</button>
            <button onClick={() => setBootError("")} className="opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="px-3 sm:px-5 lg:px-6 py-4 max-w-[1600px]">
          {departments.length === 0 ? (
            <div className="panel p-8 text-center max-w-xl mx-auto anim-slide">
              <div className="text-white font-bold">Henüz departman yok</div>
              <div className="text-white/40 text-xs mt-1.5">
                {selectedDept === "" ? "Veriler yüklenemedi veya sistemde kayıt bulunmuyor." : ""}
                Önce bir departman oluşturun, ardından personel ekleyin.
              </div>
              <div className="flex justify-center gap-2 mt-4">
                <Btn small variant="primary" onClick={() => setShowDeptModal(true)}>
                  <Plus className="w-3.5 h-3.5" /> Departman Oluştur
                </Btn>
                <Btn small onClick={() => loadBootstrap()}>Tekrar Yükle</Btn>
              </div>
            </div>
          ) : (
            <ErrorBoundary key={page} pageName={navItem.label}>
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
            </ErrorBoundary>
          )}
        </div>
      </main>

      {showDeptModal && (
        <NewDeptModal onClose={() => setShowDeptModal(false)} onCreated={async (id) => { await loadBootstrap(); setSelectedDept(id); setShowDeptModal(false); }} />
      )}
    </div>
    </>
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

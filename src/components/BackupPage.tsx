"use client";
import { useEffect, useState } from "react";
import {
  HardDriveDownload, RefreshCw, Download, RotateCcw, DatabaseBackup, CheckCircle2,
  AlertTriangle, FileJson,
} from "lucide-react";
import { Btn, Spinner, EmptyState, Badge, cx } from "@/components/ui-kit";
import { downloadFromApi } from "@/lib/api-client";

type BackupRow = {
  id: string; filename: string; kind: string; recordCounts: Record<string, number> | null; createdAt: string;
};

const KIND_LABEL: Record<string, { label: string; cls: string }> = {
  AUTO: { label: "Otomatik", cls: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
  MANUAL: { label: "Manuel", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  SAFETY: { label: "Güvenlik", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
};

export default function BackupPage() {
  const [items, setItems] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/backup");
    const data = await res.json();
    setItems(data.backups ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function createNow() {
    setBusy(true); setMsg(""); setErr("");
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(`Yedek alındı: ${data.filename}`);
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Yedek alınamadı"); }
    finally { setBusy(false); }
  }

  async function restore(b: BackupRow) {
    if (!confirm(`"${b.filename}" geri yüklenecek. Mevcut tüm veriler bu yedekle değiştirilecek (önce otomatik güvenlik yedeği alınır). Devam?`)) return;
    setBusy(true); setMsg(""); setErr("");
    try {
      const res = await fetch(`/api/backup/${b.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg("Geri yükleme tamamlandı. Sayfa yenileniyor…");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) { setErr(e instanceof Error ? e.message : "Geri yükleme başarısız"); setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-grotesk)" }}>
          <DatabaseBackup className="w-5 h-5 text-emerald-400" /> Yedekleme
        </h2>
        <span className="text-white/35 text-xs">Günlük otomatik yedek · son 30 yedek saklanır</span>
        <div className="flex-1" />
        <Btn small onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Btn>
        <Btn small variant="primary" onClick={createNow} disabled={busy}>
          <HardDriveDownload className="w-3.5 h-3.5" /> Şimdi Yedek Al
        </Btn>
      </div>

      {msg && <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 text-sm rounded-xl px-4 py-2.5 anim-slide"><CheckCircle2 className="w-4 h-4" />{msg}</div>}
      {err && <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/40 text-rose-200 text-sm rounded-xl px-4 py-2.5 anim-slide"><AlertTriangle className="w-4 h-4" />{err}</div>}

      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<DatabaseBackup className="w-8 h-8" />} title="Henüz yedek yok" desc="Uygulama her gün otomatik yedek alır; ayrıca manuel yedek oluşturabilirsiniz." />
      ) : (
        <div className="grid gap-2">
          {items.map((b, i) => {
            const kl = KIND_LABEL[b.kind] ?? KIND_LABEL.MANUAL;
            const total = Object.values(b.recordCounts ?? {}).reduce((s, n) => s + (n || 0), 0);
            return (
              <div key={b.id} className="panel px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2 anim-slide" style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}>
                <FileJson className="w-4 h-4 text-white/30 shrink-0" />
                <div className="min-w-0">
                  <div className="text-white font-bold text-sm truncate">{b.filename}</div>
                  <div className="text-white/35 text-[11px]">
                    {new Date(b.createdAt).toLocaleString("tr-TR")} · {total.toLocaleString("tr-TR")} kayıt
                    {b.recordCounts ? ` · ${b.recordCounts.personnel ?? 0} personel, ${b.recordCounts.shift_schedules ?? 0} vardiya, ${b.recordCounts.timesheet_entries ?? 0} puantaj` : ""}
                  </div>
                </div>
                <Badge className={kl.cls}>{kl.label}</Badge>
                <div className="flex-1" />
                <Btn small onClick={() => downloadFromApi(`/api/backup/${b.id}`, b.filename)}><Download className="w-3.5 h-3.5" /> İndir</Btn>
                <Btn small variant="amber" onClick={() => restore(b)} disabled={busy}>
                  <RotateCcw className="w-3.5 h-3.5" /> Geri Yükle
                </Btn>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

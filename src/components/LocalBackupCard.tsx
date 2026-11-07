"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Copy, FolderOpen, HardDriveDownload, Loader2, RefreshCw, RotateCcw, ShieldCheck,
} from "lucide-react";
import { BROWSER_ONLY } from "@/lib/app-info";
import { formatBytes } from "@/lib/version-utils";

type BackupFile = { name: string; size: number; modifiedAt: string };
type FolderInfo = {
  supported: boolean;
  reason: string | null;
  folder: string | null;
  files: BackupFile[];
  retentionDays: number;
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Windows kurulumunda yedeklerin toplandığı `backups` klasörü.
 *
 * Elle yedek alma, klasör yolunu kopyalama, klasörü açma ve kapanışta otomatik
 * yedek isteme bu karttan yönetilir. GitHub Pages sürümünde dosya sistemi
 * olmadığı için yalnızca bilgilendirme gösterilir.
 */
export default function LocalBackupCard({ notify }: { notify: (message: string, error?: boolean) => void }) {
  const [info, setInfo] = useState<FolderInfo | null>(null);
  const [loading, setLoading] = useState(!BROWSER_ONLY);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // notify her render'da yeni bir fonksiyon olabilir; yükleme döngüsünü önlemek
  // için güncel referansı tutulur, yükleme yalnızca bir kez çalışır.
  const notifyRef = useRef(notify);
  useEffect(() => { notifyRef.current = notify; }, [notify]);

  const load = useCallback(async () => {
    if (BROWSER_ONLY) return;
    try {
      const response = await fetch("/api/backup/folder", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Yedek klasörü okunamadı.");
      setInfo(data as FolderInfo);
    } catch (error) {
      notifyRef.current(error instanceof Error ? error.message : "Yedek klasörü okunamadı.", true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    setBusy(true);
    try {
      const response = await fetch("/api/backup/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Yedek alınamadı.");
      notify(data.file ? `Yedek alındı: ${data.file}` : "Yedek alındı.");
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Yedek alınamadı.", true);
    } finally {
      setBusy(false);
    }
  }

  async function restore(fileName: string) {
    const ok = window.confirm(
      `"${fileName}" yedeği geri yüklenecek.\n\n` +
      "Mevcut veriler bu yedekteki hâline dönecek. Önce otomatik güvenlik yedeği alınır. Devam edilsin mi?",
    );
    if (!ok) return;
    setRestoring(fileName);
    try {
      const response = await fetch("/api/backup/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", fileName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Yedek geri yüklenemedi.");
      notify(`Geri yükleme tamamlandı: ${fileName}. Sayfayı yenileyin.`);
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Yedek geri yüklenemedi.", true);
    } finally {
      setRestoring(null);
    }
  }

  async function openFolder() {
    try {
      const response = await fetch("/api/backup/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Klasör açılamadı.");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Klasör açılamadı.", true);
    }
  }

  async function copyPath() {
    if (!info?.folder) return;
    try {
      await navigator.clipboard.writeText(info.folder);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      notify("Yol kopyalanamadı. Yolu seçip elle kopyalayabilirsiniz.", true);
    }
  }

  if (BROWSER_ONLY) {
    return <div className="settings-card local-backup">
      <div className="section-heading">
        <span className="settings-icon blue"><HardDriveDownload size={19} /></span>
        <div><h3>Yedekler nerede?</h3><p>Tarayıcı sürümünde dosya sistemi kullanılmaz.</p></div>
      </div>
      <div className="settings-note">
        <ShieldCheck size={16} />
        <p>Web sürümünde veriler tarayıcınızda saklanır. Yedekleri JSON olarak indirip güvenli bir yerde tutabilirsiniz; Windows kurulumunda yedekler kurulum klasöründeki <code>backups</code> dizinine yazılır.</p>
      </div>
    </div>;
  }

  return <div className="settings-card local-backup">
    <div className="section-heading">
      <span className="settings-icon green"><HardDriveDownload size={19} /></span>
      <div>
        <h3>Kurulum klasöründeki yedekler</h3>
        <p>Elle ve kapanışta alınan SQL yedekleri bu klasörde toplanır.</p>
      </div>
      <span className="row-status valid">{info?.retentionDays ?? 7} gün saklanır</span>
    </div>

    {info?.folder && <div className="backup-path">
      <code title={info.folder}>{info.folder}</code>
      <button className="settings-btn small" onClick={copyPath}>
        {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />} {copied ? "Kopyalandı" : "Yolu kopyala"}
      </button>
      <button className="settings-btn small" onClick={openFolder}><FolderOpen size={13} /> Klasörü aç</button>
    </div>}

    {!info?.supported && <div className="settings-note">
      <AlertTriangle size={16} />
      <p>{loading ? "Yedek klasörü denetleniyor…" : info?.reason ?? "Yedek klasörü bu çalışma biçiminde kullanılamıyor."}</p>
    </div>}

    {info?.supported && <>
      <div className="backup-folder-actions">
        <button className="settings-btn primary" disabled={busy || !!restoring} onClick={create}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <HardDriveDownload size={15} />} Şimdi yedek al
        </button>
        <button className="settings-btn" disabled={busy || !!restoring} onClick={load}><RefreshCw size={15} /> Yenile</button>
        <span className="settings-muted">Program kapatılırken de otomatik yedek alınır (en fazla 15 dakikada bir).</span>
      </div>

      <div className="backup-folder-files">
        {info.files.slice(0, 6).map(file => <div className="backup-file-row" key={file.name}>
          <HardDriveDownload size={14} />
          <span className="backup-file-name" title={file.name}>{file.name}</span>
          <span className="backup-file-meta">{formatBytes(file.size)} · {formatDate(file.modifiedAt)}</span>
          <button
            className="backup-file-restore"
            disabled={!!restoring || busy}
            onClick={() => void restore(file.name)}
            title={`${file.name} yedeğini geri yükle`}
          >
            {restoring === file.name ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            {restoring === file.name ? "Yükleniyor" : "Geri yükle"}
          </button>
        </div>)}
        {!info.files.length && <div className="backup-file-empty">
          <HardDriveDownload size={18} />
          <span>{loading ? "Yedekler yükleniyor…" : "Bu klasörde henüz yedek yok. İlk yedeği Şimdi yedek al ile oluşturun."}</span>
        </div>}
      </div>
    </>}
  </div>;
}

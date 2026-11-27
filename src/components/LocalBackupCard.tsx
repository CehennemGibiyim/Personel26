"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Copy, FolderCog, FolderOpen, HardDriveDownload, Loader2, RefreshCw, RotateCcw, Save, ShieldCheck, Undo2,
} from "lucide-react";
import { BROWSER_ONLY } from "@/lib/app-info";
import { formatBytes } from "@/lib/version-utils";

type BackupFile = { name: string; size: number; modifiedAt: string };
type FolderInfo = {
  supported: boolean;
  reason: string | null;
  folder: string | null;
  custom: boolean;
  defaultFolder: string | null;
  /** Klasör değişmeden önce kullanılan ve hâlâ yedek içeren klasör. */
  previousFolder: string | null;
  previousFiles: number;
  files: BackupFile[];
  retentionDays: number;
};

type DesktopBridge = {
  isDesktop?: boolean;
  pickBackupFolder?: (current?: string | null) => Promise<string | null>;
};

declare global {
  interface Window {
    personel26Desktop?: DesktopBridge;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Windows kurulumunda yedeklerin toplandığı klasör.
 *
 * Elle yedek alma, klasör yolunu kopyalama, klasörü açma, yedek klasörünü
 * değiştirme ve kapanışta otomatik yedek isteme bu karttan yönetilir.
 * GitHub Pages sürümünde dosya sistemi olmadığı için yalnızca bilgilendirme
 * gösterilir.
 */
export default function LocalBackupCard({ notify }: { notify: (message: string, error?: boolean) => void }) {
  const [info, setInfo] = useState<FolderInfo | null>(null);
  const [loading, setLoading] = useState(!BROWSER_ONLY);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [savingPath, setSavingPath] = useState(false);
  const [picking, setPicking] = useState(false);
  const [hasPicker, setHasPicker] = useState(false);
  // notify her render'da yeni bir fonksiyon olabilir; yükleme döngüsünü önlemek
  // için güncel referansı tutulur, yükleme yalnızca bir kez çalışır.
  const notifyRef = useRef(notify);
  useEffect(() => { notifyRef.current = notify; }, [notify]);
  useEffect(() => { setHasPicker(Boolean(window.personel26Desktop?.pickBackupFolder)); }, []);

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

  function startEdit() {
    setDraft(info?.folder ?? "");
    setEditing(true);
  }

  async function pick() {
    const bridge = window.personel26Desktop;
    if (!bridge?.pickBackupFolder) {
      notify("Klasör seçme penceresi yalnızca Personel26 masaüstü uygulamasında açılır. Yolu elle yazabilirsiniz.", true);
      return;
    }
    setPicking(true);
    try {
      const chosen = await bridge.pickBackupFolder(draft || info?.folder || null);
      if (chosen) setDraft(chosen);
    } catch {
      notify("Klasör seçilemedi. Yolu elle yazabilirsiniz.", true);
    } finally {
      setPicking(false);
    }
  }

  async function saveFolder(reset = false) {
    setSavingPath(true);
    try {
      const response = await fetch("/api/backup/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reset ? { action: "reset-folder" } : { action: "set-folder", folder: draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Yedek klasörü değiştirilemedi.");
      const next = data as FolderInfo;
      setInfo(next);
      setEditing(false);
      // Yedekler taşınmıyor: eski klasörde kalan dosyaların yeri açıkça söylenir.
      const leftover = next.previousFolder && next.previousFiles > 0
        ? ` Önceki klasördeki ${next.previousFiles} yedek ${next.previousFolder} konumunda duruyor; yeni listeye taşınmadı.`
        : "";
      notify((reset
        ? "Yedek klasörü kurulum klasöründeki backups dizinine döndürüldü."
        : `Yedek klasörü değiştirildi: ${next.folder}.`) + leftover);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Yedek klasörü değiştirilemedi.", true);
    } finally {
      setSavingPath(false);
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
        <h3>SQL yedek klasörü</h3>
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

    {info?.previousFolder && info.previousFiles > 0 && <div className="settings-note backup-folder-previous">
      <AlertTriangle size={16} />
      <p>
        Önceki yedek klasörü: <code>{info.previousFolder}</code>. Oradaki <b>{info.previousFiles}</b> yedek dosyası
        yeni klasöre taşınmadı ve aşağıdaki listede görünmez. Gerekirse o klasörden elle kopyalayabilirsiniz.
      </p>
    </div>}

    {info?.supported && <div className="backup-folder-setting">
      {!editing ? <div className="backup-folder-setting-row">
        <div>
          <b>Yedek klasörünü değiştir{info.custom && <span className="tiny-tag">ÖZEL</span>}</b>
          <p>{info.custom
            ? "Yedekler seçtiğiniz klasöre yazılır. Kurulum klasöründen bağımsızdır."
            : "Varsayılan olarak kurulum klasöründeki backups dizini kullanılır."}</p>
        </div>
        <div className="backup-folder-setting-actions">
          <button className="settings-btn small" onClick={startEdit}><FolderCog size={13} /> Klasörü değiştir</button>
          {info.custom && <button className="settings-btn small" onClick={() => void saveFolder(true)} disabled={savingPath}>
            {savingPath ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Varsayılana döndür
          </button>}
        </div>
      </div> : <>
        <label className="backup-folder-input">Yedek klasörü
          <input
            className="settings-input"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder="D:\\Personel26 Yedek"
            spellCheck={false}
            autoFocus
          />
        </label>
        <div className="backup-folder-setting-actions">
          {hasPicker && <button className="settings-btn small" onClick={() => void pick()} disabled={picking || savingPath}>
            {picking ? <Loader2 size={13} className="animate-spin" /> : <FolderOpen size={13} />} Gözat…
          </button>}
          <button className="settings-btn small primary" onClick={() => void saveFolder(false)} disabled={savingPath || !draft.trim()}>
            {savingPath ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Kaydet
          </button>
          <button className="settings-btn small" onClick={() => setEditing(false)} disabled={savingPath}>Vazgeç</button>
        </div>
        <p className="backup-folder-hint">
          Tam yol girin (ör. <code>D:\Personel26 Yedek</code>). Klasör yoksa oluşturulur ve yazma izni hemen denenir.
          Klasör değiştirildiğinde eski klasördeki yedekler taşınmaz. Varsayılana dönmek için <b>Varsayılana döndür</b> düğmesini kullanın.
        </p>
      </>}
    </div>}

    {!info?.supported && <div className="settings-note">
      <AlertTriangle size={16} />
      <p>{loading ? "Yedek klasörü denetleniyor…" : info?.reason ?? "Yedek klasörü bu çalışma biçiminde kullanılamıyor."}</p>
    </div>}

    {info?.supported && <>
      <div className="backup-folder-actions">
        <button className="settings-btn primary" disabled={busy || !!restoring || editing} onClick={create}>
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
          <span>{loading
            ? "Yedekler yükleniyor…"
            : info.previousFolder && info.previousFiles > 0
              ? `Bu klasörde henüz yedek yok. Önceki klasördeki ${info.previousFiles} yedek ${info.previousFolder} konumunda duruyor.`
              : "Bu klasörde henüz yedek yok. İlk yedeği Şimdi yedek al ile oluşturun."}</span>
        </div>}
      </div>
    </>}
  </div>;
}

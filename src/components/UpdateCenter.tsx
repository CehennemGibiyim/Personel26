"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowUpRight, CheckCircle2, Clock3, Download, ExternalLink, Loader2, RefreshCw, ShieldCheck, Sparkles, Wrench,
} from "lucide-react";
import { APP_NAME, APP_VERSION, BROWSER_ONLY, RELEASES_URL } from "@/lib/app-info";
import type { UpdateCheckResult, UpdateInfo, UpdateState, UpdateStatus } from "@/lib/update-types";
import { fetchUpdateCheck } from "@/lib/update-client";
import { formatBytes, releaseKindLabel, type UpdateRelease } from "@/lib/version-utils";
import { cx } from "@/components/ui-kit";

const RUNNING_STATES: UpdateState[] = ["downloading", "verifying", "extracting", "stopping", "backing-up", "installing", "restarting"];

const STATE_LABEL: Record<UpdateState, string> = {
  idle: "Hazır",
  downloading: "Paket indiriliyor",
  verifying: "Paket doğrulanıyor",
  extracting: "Paket açılıyor",
  stopping: "Uygulama kapatılıyor",
  "backing-up": "Güvenlik yedeği alınıyor",
  installing: "Yeni sürüm kuruluyor",
  restarting: "Uygulama yeniden başlatılıyor",
  done: "Güncelleme tamamlandı",
  error: "Güncelleme tamamlanamadı",
};

function isRunning(state: UpdateState | undefined): boolean {
  return !!state && RUNNING_STATES.includes(state);
}

function formatDate(value: string | undefined | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

export default function UpdateCenter({ checkRequest = 0 }: { checkRequest?: number }) {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [check, setCheck] = useState<UpdateCheckResult | null>(null);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [loading, setLoading] = useState(!BROWSER_ONLY);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);
  const checkedOnce = useRef(false);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bileşen kaldırılırsa bekleyen sayfa yenilemesini iptal et.
  useEffect(() => () => { if (reloadTimer.current) clearTimeout(reloadTimer.current); }, []);

  const checkForUpdates = useCallback(async (silent = false) => {
    checkedOnce.current = true;
    setChecking(true);
    setError(null);
    try {
      const data: UpdateCheckResult = await fetchUpdateCheck(!silent);
      setCheck(data);
      setConfirming(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Güncelleme denetlenemedi.");
    } finally {
      setChecking(false);
      if (!silent) setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (BROWSER_ONLY) return;
    try {
      const response = await fetch("/api/update", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Güncelleme bilgisi okunamadı.");
      const parsed = data as UpdateInfo;
      setInfo(parsed);
      setCheck(parsed.lastCheck);
      setStatus(parsed.status);
      if (parsed.status && isRunning(parsed.status.state)) setApplying(true);
      if (parsed.status?.state === "error") {
        setError(parsed.status.message);
        setLog(parsed.status.logTail ?? null);
      }
      // İlk açılışta ve hiç denetim yapılmamışsa sessizce denetle.
      if (parsed.autoUpdate.supported && !parsed.lastCheck && !checkedOnce.current) {
        checkedOnce.current = true;
        await checkForUpdates(true);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Güncelleme bilgisi okunamadı.");
    } finally {
      setLoading(false);
    }
  }, [checkForUpdates]);

  useEffect(() => { void load(); }, [load]);

  // Yardım penceresinden gelindiğinde denetimi hemen başlat.
  useEffect(() => {
    if (checkRequest > 0) void checkForUpdates();
  }, [checkRequest, checkForUpdates]);

  // Güncelleme sürerken durum dosyasını izle; uygulama yeniden başlarken istek
  // birkaç saniye başarısız olur, bu yüzden sessizce yeniden denenir.
  useEffect(() => {
    if (!applying) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const response = await fetch("/api/update/status", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json() as { status: UpdateStatus | null; logTail: string | null };
          setStatus(data.status);
          if (data.status?.state === "done") {
            setApplying(false);
            setReloading(true);
            // Ayrı ref: effect temizliği bu zamanlayıcıyı iptal etmemeli.
            reloadTimer.current = setTimeout(() => window.location.reload(), 1600);
            return;
          }
          if (data.status?.state === "error") {
            setApplying(false);
            setError(data.status.message);
            setLog(data.status.logTail ?? data.logTail ?? null);
            setInfo(current => current ? { ...current, currentVersion: APP_VERSION } : current);
          }
        } else {
          setStatus({ state: "restarting", message: "Uygulama yeniden başlatılıyor…" });
        }
      } catch {
        setStatus({ state: "restarting", message: "Uygulama yeniden başlatılıyor…" });
      }
      if (!stopped) timer = setTimeout(tick, 2000);
    };
    timer = setTimeout(tick, 1200);
    return () => { stopped = true; clearTimeout(timer); };
  }, [applying]);

  const startUpdate = async () => {
    if (!check?.updateAvailable) return;
    setError(null);
    setLog(null);
    setConfirming(false);
    setApplying(true);
    setStatus({ state: "downloading", message: "Güncelleme başlatılıyor…" });
    try {
      const response = await fetch("/api/update/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ version: check.latestVersion, confirm: "GÜNCELLE" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Güncelleme başlatılamadı.");
      setStatus({ state: "downloading", message: data?.message ?? "Paket indiriliyor…" });
    } catch (reason) {
      setApplying(false);
      setError(reason instanceof Error ? reason.message : "Güncelleme başlatılamadı.");
    }
  };

  const supported = info?.autoUpdate.supported ?? false;
  const busy = checking || applying || reloading;
  const runningStatus = status && isRunning(status.state) ? status : null;
  const lastError = status?.state === "error" && !applying ? status : null;
  const skipped = check?.skippedVersions ?? [];
  const feedHost = (() => {
    try { return new URL(info?.feed || "https://github.com").host; } catch { return "GitHub"; }
  })();

  return <section className="settings-card update-card">
    <div className="section-heading">
      <span className="settings-icon green"><Download size={20} /></span>
      <div>
        <h2>Güncellemeler</h2>
        <p>Yeni sürümleri ve hata düzeltmelerini buradan denetleyip kurabilirsiniz.</p>
      </div>
      <span className={cx("row-status", reloading || (status?.state === "done") ? "valid" : check?.updateAvailable ? "warning" : "")}>
        {check?.updateAvailable ? "Yeni sürüm" : reloading || status?.state === "done" ? "Güncel" : supported || loading ? "Denetlenebilir" : "Elle"}
      </span>
    </div>

    <div className="update-version-strip">
      <div><span>KURULU SÜRÜM</span><b>v{APP_VERSION}</b></div>
      <div><span>SON DENETİM</span><b>{check ? formatDate(check.checkedAt) : "Henüz denetlenmedi"}</b></div>
      <div><span>KAYNAK</span><b>{feedHost}</b></div>
      <div className="update-strip-actions">
        <button className="settings-btn" disabled={busy || BROWSER_ONLY} onClick={() => void checkForUpdates()}>
          {checking ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} {checking ? "Denetleniyor…" : "Güncellemeleri denetle"}
        </button>
        {check?.updateAvailable && supported && !applying && !reloading && <button className="settings-btn primary" onClick={() => setConfirming(true)}><Download size={15} /> Şimdi güncelle</button>}
      </div>
    </div>

    {loading && <div className="settings-note"><Loader2 size={16} className="animate-spin" /><p>Güncelleme bilgileri okunuyor…</p></div>}

    {(BROWSER_ONLY || (info && !supported)) && <div className="settings-note">
      <ShieldCheck size={16} />
      <p>
        {BROWSER_ONLY
          ? "Bu tarayıcı sürümünde uygulama dosyaları güncellenemez. Yeni sürümü GitHub sürümler sayfasından indirebilirsiniz."
          : info?.autoUpdate.reason ?? "Otomatik güncelleme bu ortamda kullanılamıyor."}
        {" "}
        <a className="settings-text-link" href={RELEASES_URL} target="_blank" rel="noreferrer">Sürümleri aç <ExternalLink size={12} /></a>
      </p>
    </div>}

    {runningStatus && <div className="update-progress" role="status" aria-live="polite">
      <div className="update-progress-head">
        <Loader2 size={17} className="animate-spin" />
        <div><b>{STATE_LABEL[runningStatus.state]}</b><small>{runningStatus.message}</small></div>
        {typeof runningStatus.percent === "number" && <span>{runningStatus.percent}%</span>}
      </div>
      <div className="update-bar"><i style={runningStatus.percent && runningStatus.percent > 0 ? { width: `${runningStatus.percent}%` } : undefined} /></div>
      <p>Uygulama bu sırada kapanıp yeniden açılır; bu pencereyi kapatmayın. Verileriniz korunur ve önce otomatik SQL güvenlik yedeği alınır.</p>
    </div>}

    {reloading && <div className="settings-note success">
      <CheckCircle2 size={16} />
      <p>Güncelleme tamamlandı. Yeni sürüm açılıyor; sayfa birkaç saniye içinde kendini yenileyecek.</p>
    </div>}

    {error && !applying && <div className="update-error" role="alert">
      <AlertCircle size={17} />
      <div>
        <b>İşlem tamamlanamadı</b>
        <p>{error}</p>
        {(log || lastError?.logTail) && <details><summary>Güncelleme günlüğü</summary><pre>{log ?? lastError?.logTail}</pre></details>}
        <button className="settings-btn small" onClick={() => { setError(null); setLog(null); void checkForUpdates(); }}><RefreshCw size={13} /> Yeniden dene</button>
      </div>
    </div>}

    {check && !check.updateAvailable && !applying && !reloading && <div className="settings-note success">
      <CheckCircle2 size={16} />
      <p>En son sürümü kullanıyorsunuz (v{check.currentVersion}). Yeni bir sürüm veya hata düzeltmesi yayınlandığında burada görünecek.</p>
    </div>}

    {check?.blocked && <div className="update-error" role="alert"><AlertCircle size={17} /><div><b>Doğrudan güncelleme yapılamıyor</b><p>{check.blocked}</p></div></div>}

    {check?.updateAvailable && !applying && !reloading && <div className="update-release">
      <div className="update-release-head">
        <span className="update-release-icon"><Sparkles size={18} /></span>
        <div>
          <h3>v{check.latestVersion} hazır</h3>
          <p>
            {check.releases[0]?.title ?? releaseKindLabel(check.latestKind ?? undefined)}
            {check.package.size ? ` · ${formatBytes(check.package.size)}` : ""}
          </p>
        </div>
        {check.latestKind && <span className={cx("release-kind", check.latestKind)}>{releaseKindLabel(check.latestKind)}</span>}
      </div>

      {skipped.length > 0 && <div className="update-skip">
        <Clock3 size={15} />
        <p>
          {skipped.length} ara sürüm atlanarak doğrudan v{check.latestVersion} sürümüne geçilecek:
          <b> {skipped.map(version => `v${version}`).join(", ")}</b>. Ara sürümlerin düzeltmeleri de bu güncellemeye dahildir.
        </p>
      </div>}

      <div className="release-list">
        {check.releases.length === 0 && <p className="settings-muted">Bu sürüm için ayrıntılı not yayınlanmadı.</p>}
        {check.releases.map((release: UpdateRelease) => <article className="release-item" key={release.version}>
          <header>
            <b>v{release.version}</b>
            {release.kind && <span className={cx("release-kind", release.kind)}>{releaseKindLabel(release.kind)}</span>}
            {release.date && <small>{release.date}</small>}
          </header>
          {release.title && <h4>{release.title}</h4>}
          {release.notes && release.notes.length > 0 && <ul>{release.notes.map(note => <li key={note}>{note}</li>)}</ul>}
        </article>)}
      </div>

      {confirming ? <div className="update-confirm">
        <div><Wrench size={18} /><p><b>Güncelleme başlatılsın mı?</b> Uygulama kısa süreliğine kapanır, otomatik SQL güvenlik yedeği alınır ve verileriniz korunur. Sorun çıkarsa önceki sürüme dönülür.</p></div>
        <div className="update-confirm-actions">
          <button className="settings-btn" disabled={applying} onClick={() => setConfirming(false)}>Vazgeç</button>
          <button className="settings-btn primary" disabled={applying || !supported} onClick={() => void startUpdate()}><Download size={15} /> Güncellemeyi başlat</button>
        </div>
      </div> : <div className="update-release-footer">
        <span className="settings-muted"><ShieldCheck size={13} /> SHA-256 doğrulaması · otomatik yedek · geri dönüş koruması</span>
        <button className="settings-btn primary" disabled={!supported || busy} onClick={() => setConfirming(true)}><Download size={15} /> v{check.latestVersion} sürümüne güncelle</button>
      </div>}
    </div>}

    {status?.state === "done" && !applying && !reloading && <div className="settings-note success">
      <CheckCircle2 size={16} />
      <p>Son güncelleme tamamlandı{status.from && status.to ? `: v${status.from} → v${status.to}` : ""} ({formatDate(status.finishedAt)}).{status.message ? ` ${status.message}` : ""}</p>
    </div>}

    <div className="update-footer">
      <span><ShieldCheck size={13} /> HTTPS kaynağından indirilir, SHA-256 ile doğrulanır.</span>
      <a className="settings-text-link" href={RELEASES_URL} target="_blank" rel="noreferrer"><ArrowUpRight size={13} /> Sürüm geçmişi</a>
    </div>
  </section>;
}

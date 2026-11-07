"use client";
import { Download, ExternalLink, Globe2, MonitorDown, Sparkles } from "lucide-react";
import { APP_NAME, APP_VERSION, INSTALLER_URL, REPOSITORY_URL, RELEASES_URL, WEB_APP_URL } from "@/lib/app-info";
import { currentReleaseNotes } from "@/lib/release-notes";

function formatReleaseDate(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Sürüm notları kartı.
 *
 * Yardım penceresinde (compact) ve Ayarlar → Hakkında sekmesinde gösterilir.
 * Notlar depodaki `updates/surum-notlari.json` dosyasından gelir; kurulum ve
 * web sürümü bağlantıları her zaman en son GitHub sürümüne gider.
 */
export default function ReleaseNotesCard({ compact = false }: { compact?: boolean }) {
  const release = currentReleaseNotes(APP_VERSION);
  const notes = (release?.notes ?? []).slice(0, compact ? 4 : 20);
  const version = release?.version ?? APP_VERSION;
  const date = formatReleaseDate(release?.date);

  return <section className={`settings-card release-notes${compact ? " compact" : ""}`}>
    <div className="release-notes-head">
      <span className="settings-icon blue"><Sparkles size={19} /></span>
      <div>
        <h2>Sürüm notları</h2>
        <p>Güncel kurulum paketi ve yenilikler.</p>
      </div>
      <span className="release-notes-badge">v{version}</span>
    </div>

    <ul className="release-notes-list">
      {notes.map((note, index) => <li key={index}><i /><span>{note}</span></li>)}
      {!notes.length && <li><i /><span>{APP_NAME} {version} sürümü için henüz not girilmedi.</span></li>}
    </ul>

    <div className="release-notes-actions">
      <a className="settings-btn primary" href={INSTALLER_URL}>
        <MonitorDown size={15} /> Windows kurulum paketi
      </a>
      <a className="settings-btn" href={WEB_APP_URL} target="_blank" rel="noreferrer">
        <Globe2 size={15} /> Web sürümü
      </a>
    </div>

    <div className="release-notes-foot">
      <span>
        Sürüm v{version}{date ? ` · ${date}` : ""} · Kurulum paketi GitHub Releases sayfasından indirilir. Verileriniz bilgisayarınızda kalır.
      </span>
      <a href={RELEASES_URL} target="_blank" rel="noreferrer">
        Tüm sürümler <ExternalLink size={12} />
      </a>
      <a href={`${REPOSITORY_URL}/releases/latest/download/Personel26-Portable.zip`} className="release-notes-portable">
        <Download size={12} /> Taşınabilir sürüm
      </a>
    </div>
  </section>;
}

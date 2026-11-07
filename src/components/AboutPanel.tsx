"use client";
import { Database, ExternalLink, GitBranch as Github, MonitorCog, ShieldCheck } from "lucide-react";
import { APP_NAME, APP_VERSION, BROWSER_ONLY, REPOSITORY_URL } from "@/lib/app-info";
import { cx } from "@/components/ui-kit";
import UpdateCenter from "@/components/UpdateCenter";
import ReleaseNotesCard from "@/components/ReleaseNotesCard";

/**
 * Ayarlar → Hakkında: uygulama kimliği ve güncelleme merkezi.
 * Yardım penceresindeki "Güncellemeleri denetle" düğmesi bu sekmeye yönlendirir.
 */
export default function AboutPanel({ schemaVersion, nodeVersion, checkRequest = 0 }: { schemaVersion?: string | null; nodeVersion?: string | null; checkRequest?: number }) {
  const rows: [string, string][] = [
    ["Uygulama", `${APP_NAME} · v${APP_VERSION}`],
    ["Kaynak depo", "CehennemGibiyim / Personel26"],
    ["Veritabanı", "PostgreSQL · yerel"],
    ["Şema sürümü", schemaVersion ?? "—"],
    ["Node.js", nodeVersion ?? "Sunucu çalışma ortamı"],
    ["Çalışma biçimi", BROWSER_ONLY ? "Tarayıcı (statik GitHub Pages)" : "Windows / yerel sunucu"],
  ];

  return <div className="about-layout">
    <ReleaseNotesCard />

    <section className="settings-card about-card">
      <div className="section-heading">
        <span className="settings-icon blue"><MonitorCog size={20} /></span>
        <div><h2>Hakkında</h2><p>Uygulama, veritabanı ve güncelleme bilgileri.</p></div>
        <span className={cx("row-status", "valid")}>v{APP_VERSION}</span>
      </div>
      <div className="system-info-list">
        {rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}
      </div>
      <a className="settings-text-link system-source" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
        <Github size={16} /> Kaynak depoyu aç <ExternalLink size={13} />
      </a>
    </section>

    <UpdateCenter checkRequest={checkRequest} />

    <section className="settings-card about-help">
      <div className="section-heading">
        <span className="settings-icon violet"><ShieldCheck size={20} /></span>
        <div><h2>Güncelleme nasıl çalışır?</h2><p>Kurulum, yedek ve geri dönüş adımları.</p></div>
      </div>
      <ol className="about-steps">
        <li><b>Denetim</b><span>Uygulama, GitHub sürümlerindeki <code>update.json</code> dosyasını okur ve kurulu sürümle karşılaştırır.</span></li>
        <li><b>Doğrulama</b><span>Yeni paket HTTPS üzerinden indirilir ve bildirilen SHA-256 özetiyle doğrulanır. Doğrulanmayan paket kurulmaz.</span></li>
        <li><b>Güvenlik yedeği</b><span>Dosyalar değişmeden önce veritabanınızın SQL yedeği kurulum klasöründeki <code>backups</code> dizinine alınır.</span></li>
        <li><b>Kurulum ve geri dönüş</b><span>Yeni sürüm başlatılır ve sağlık kontrolü yapılır. Başarısız olursa önceki sürüm ve veriler geri yüklenir.</span></li>
      </ol>
      <div className="settings-note">
        <Database size={16} />
        <p>
          Ara sürümler atlanarak doğrudan en son sürüme geçilir; atlanan sürümlerin notları güncelleme ekranında listelenir.
          {BROWSER_ONLY ? " Bu tarayıcı sürümünde otomatik kurulum yoktur." : " Güncelleme için internet bağlantısı gerekir; verileriniz ve data klasörünüz korunur."}
        </p>
      </div>
    </section>
  </div>;
}

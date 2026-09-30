"use client";
import { useState } from "react";
import { Check, LockKeyhole, Search, Moon, Sun, Palette, RotateCcw, ShieldCheck } from "lucide-react";
import { THEMES, applyTheme } from "@/lib/themes";
import type { AppSettings } from "@/lib/settings";
import { cx } from "@/components/ui-kit";
export default function ThemeSettings({ settings, setSettings, savedTheme }: { settings: AppSettings; setSettings: (value: AppSettings) => void; savedTheme: string }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  function choose(id: string) { setSettings({ ...settings, theme: id }); applyTheme(id, settings.compact, settings.reducedMotion); }
  const list = THEMES.filter(theme => (filter === "all" || theme.category === filter) && theme.name.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")));
  return <div className="theme-settings">
    <div className="theme-protection"><div className="theme-protection-icon"><ShieldCheck size={26} /></div><div><h3>Ana temanız her zaman güvende.</h3><p>Personel26’nın orijinal teması değiştirilemez. Diğer temaları deneyebilir, istediğiniz an ana temaya dönebilirsiniz.</p></div><span><LockKeyhole size={12} /> KORUMA ALTINDA</span></div>
    <div className="theme-toolbar"><div className="theme-filter">{[{ id: "all", label: "Tüm temalar", icon: Palette }, { id: "dark", label: "Koyu", icon: Moon }, { id: "light", label: "Açık", icon: Sun }].map(item => <button key={item.id} className={cx(filter === item.id && "active")} onClick={() => setFilter(item.id)}><item.icon size={14} />{item.label}</button>)}</div><div className="theme-search"><Search size={14} /><input aria-label="Tema ara" placeholder="Tema ara…" value={query} onChange={e => setQuery(e.target.value)} /></div><span className="settings-muted">1 ana tema + 20 alternatif</span></div>
    {settings.theme !== savedTheme && <div className="settings-alert info"><Palette size={16} /><span><b>Önizleme modu.</b> Bu temayı kalıcı kullanmak için değişiklikleri kaydedin.</span></div>}
    <div className="themes-grid">{list.map(theme => <button key={theme.id} className={cx("theme-card", settings.theme === theme.id && "selected")} onClick={() => choose(theme.id)} aria-pressed={settings.theme === theme.id}>
      <div className="theme-mini" style={{ background: theme.bg, color: theme.text }}><div className="mini-sidebar" style={{ background: theme.sidebar }}><span style={{ background: theme.accent }} /><i /><i /><i /><i /><i /></div><div className="mini-content"><div className="mini-top"><span /><i style={{ background: theme.accent }} /></div><div className="mini-title" /><div className="mini-stats">{[1, 2, 3].map(i => <div key={i} style={{ background: theme.panel }}><i style={{ background: theme.accent }} /><span /></div>)}</div><div className="mini-panel" style={{ background: theme.panel }}><span /><div className="mini-chart">{[32, 48, 29, 63, 44, 75, 55, 88, 67].map((height, index) => <i key={index} style={{ height: `${height}%`, background: theme.accent, opacity: .35 + index * .065 }} />)}</div></div></div>{settings.theme === theme.id && <span className="theme-check" style={{ background: theme.accent }}><Check size={13} /></span>}{theme.id === "original" && <span className="theme-original"><LockKeyhole size={9} /> ANA TEMA</span>}</div>
      <div className="theme-card-label"><b>{theme.name}</b><span>{theme.id === savedTheme ? "Etkin" : theme.category === "dark" ? "Koyu tema" : "Açık tema"}</span></div>
    </button>)}</div>
    {!list.length && <div className="settings-empty">Aramanıza uygun tema bulunamadı.</div>}
    <div className="theme-bottom"><p><Check size={14} /> Tema tercihi puantaj, nöbet ve personel verilerinizi etkilemez.</p><button className="settings-btn" onClick={() => choose("original")}><RotateCcw size={14} /> Ana temaya dön</button></div>
  </div>;
}

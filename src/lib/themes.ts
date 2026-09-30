export type Theme = { id: string; name: string; category: "dark" | "light"; bg: string; panel: string; sidebar: string; accent: string; text: string; muted: string };
export const THEMES: Theme[] = [
  { id: "original", name: "Personel26", category: "dark", bg: "#070b14", panel: "#0e1626", sidebar: "#090e1b", accent: "#38bdf8", text: "#e2e8f0", muted: "#8b98ad" },
  { id: "ocean", name: "Okyanus", category: "dark", bg: "#071622", panel: "#102534", sidebar: "#0b1b29", accent: "#22d3ee", text: "#e0f2fe", muted: "#82a1b3" },
  { id: "violet", name: "Gece Moru", category: "dark", bg: "#110c20", panel: "#201831", sidebar: "#171024", accent: "#a78bfa", text: "#ede9fe", muted: "#a498b8" },
  { id: "graphite", name: "Grafit", category: "dark", bg: "#111214", panel: "#1f2125", sidebar: "#16171a", accent: "#cbd5e1", text: "#f1f5f9", muted: "#979ba4" },
  { id: "forest", name: "Orman", category: "dark", bg: "#091811", panel: "#142b21", sidebar: "#0c1e16", accent: "#34d399", text: "#e2f7eb", muted: "#89a695" },
  { id: "sunset", name: "Gün Batımı", category: "dark", bg: "#211211", panel: "#34201c", sidebar: "#281714", accent: "#fb923c", text: "#fff1e5", muted: "#bb9b88" },
  { id: "wine", name: "Bordo", category: "dark", bg: "#1b0b15", panel: "#301626", sidebar: "#230e1d", accent: "#fb7185", text: "#fce7f3", muted: "#b88a9d" },
  { id: "petrol", name: "Petrol", category: "dark", bg: "#081a1d", panel: "#122b30", sidebar: "#0b2024", accent: "#2dd4bf", text: "#def7f4", muted: "#83aaa8" },
  { id: "cobalt", name: "Kobalt", category: "dark", bg: "#09132a", panel: "#132344", sidebar: "#0c1833", accent: "#60a5fa", text: "#e5edff", muted: "#8e9fc3" },
  { id: "lavender", name: "Lavanta", category: "light", bg: "#f3f0fa", panel: "#ffffff", sidebar: "#eae5f5", accent: "#7c3aed", text: "#2d2341", muted: "#80728e" },
  { id: "sapphire", name: "Safir", category: "dark", bg: "#0b1027", panel: "#19203c", sidebar: "#10162e", accent: "#818cf8", text: "#eef2ff", muted: "#939bbe" },
  { id: "olive", name: "Zeytin", category: "dark", bg: "#171b10", panel: "#282f1e", sidebar: "#1c2115", accent: "#a3e635", text: "#f0f5e5", muted: "#a2ad8b" },
  { id: "rose", name: "Gül Kurusu", category: "dark", bg: "#20131d", panel: "#342331", sidebar: "#271824", accent: "#f9a8d4", text: "#fce7f3", muted: "#b49aa9" },
  { id: "sand", name: "Kum", category: "light", bg: "#f4f0e8", panel: "#fffdf8", sidebar: "#eae4d8", accent: "#b77934", text: "#3c3428", muted: "#897d6a" },
  { id: "arctic", name: "Arktik", category: "light", bg: "#edf5fa", panel: "#ffffff", sidebar: "#e1eef5", accent: "#0284c7", text: "#183447", muted: "#708798" },
  { id: "cloud", name: "Bulut", category: "light", bg: "#f4f5f7", panel: "#ffffff", sidebar: "#eceef1", accent: "#475569", text: "#1e293b", muted: "#788496" },
  { id: "mint", name: "Nane", category: "light", bg: "#edf6f1", panel: "#ffffff", sidebar: "#e0eee5", accent: "#059669", text: "#1d3a2c", muted: "#739180" },
  { id: "cream", name: "Krem", category: "light", bg: "#faf5ed", panel: "#fffcf7", sidebar: "#f0e8dc", accent: "#ca8a04", text: "#413625", muted: "#998b74" },
  { id: "anthracite", name: "Antrasit", category: "dark", bg: "#10161b", panel: "#1c2730", sidebar: "#141c23", accent: "#94a3b8", text: "#e2e8f0", muted: "#8696a4" },
  { id: "copper", name: "Bakır", category: "dark", bg: "#1e1512", panel: "#32251f", sidebar: "#251b17", accent: "#d9a06f", text: "#faeee5", muted: "#b59e8e" },
  { id: "aurora", name: "Kuzey Işıkları", category: "dark", bg: "#0d1421", panel: "#192338", sidebar: "#111a2a", accent: "#6ee7b7", text: "#e4f5f2", muted: "#91a8b2" },
];
export function applyTheme(id: string, compact = false, reducedMotion = false) {
  if (typeof document === "undefined") return;
  const theme = THEMES.find(t => t.id === id) ?? THEMES[0];
  const root = document.documentElement;
  root.dataset.p26Theme = theme.id;
  root.dataset.p26Light = String(theme.category === "light");
  root.dataset.p26Compact = String(compact);
  root.dataset.p26Motion = String(reducedMotion);
  Object.entries({ bg: theme.bg, panel: theme.panel, sidebar: theme.sidebar, accent: theme.accent, text: theme.text, muted: theme.muted }).forEach(([key, value]) => root.style.setProperty(`--theme-${key}`, value));
}

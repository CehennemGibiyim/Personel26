import { THEMES } from "@/lib/themes";
export type AppSettings = {
  institution: string; shortName: string; email: string; phone: string; address: string; logo: string | null;
  theme: string; compact: boolean; reducedMotion: boolean; maskTc: boolean;
  autoBackup: boolean; backupRetention: number;
  notifyImports: boolean; notifySystem: boolean; notifyBackups: boolean;
};
export const DEFAULT_SETTINGS: AppSettings = {
  institution: "Personel26 Sağlık Kurumu", shortName: "Personel26", email: "", phone: "", address: "", logo: null,
  theme: "original", compact: false, reducedMotion: false, maskTc: true,
  autoBackup: true, backupRetention: 30,
  notifyImports: true, notifySystem: true, notifyBackups: true,
};
export function validateSettings(input: unknown): AppSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Geçersiz ayar verisi.");
  const value = input as Record<string, unknown>;
  const result = { ...DEFAULT_SETTINGS };
  for (const key of ["institution", "shortName", "email", "phone", "address"] as const) {
    if (typeof value[key] !== "string" || value[key].length > (key === "address" ? 1000 : 180)) throw new Error("Kurum bilgilerini kontrol edin.");
    result[key] = value[key].trim();
  }
  if (!result.institution || !result.shortName) throw new Error("Kurum adı ve kısa ad zorunludur.");
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error("Geçerli bir e-posta adresi girin.");
  if (value.logo !== null && value.logo !== undefined) {
    if (typeof value.logo !== "string" || value.logo.length > 400000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value.logo)) throw new Error("Geçersiz kurum logosu.");
    result.logo = value.logo;
  }
  if (!THEMES.some(t => t.id === value.theme)) throw new Error("Geçersiz tema seçimi.");
  result.theme = String(value.theme);
  for (const key of ["compact", "reducedMotion", "maskTc", "autoBackup", "notifyImports", "notifySystem", "notifyBackups"] as const) {
    if (typeof value[key] !== "boolean") throw new Error("Geçersiz tercih.");
    result[key] = value[key];
  }
  const retention = Number(value.backupRetention);
  if (!Number.isInteger(retention) || retention < 5 || retention > 365) throw new Error("Yedek saklama adedi 5–365 arasında olmalıdır.");
  result.backupRetention = retention;
  return result;
}
export function publishSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem("p26-settings", JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("p26-settings", { detail: settings }));
}

/**
 * Uygulama kimliği ve sürüm bilgisi.
 *
 * Sürümün tek kaynağı `package.json` içindeki `version` alanıdır. Derleme
 * sırasında `next.config.ts` bunu `NEXT_PUBLIC_P26_VERSION` olarak gömer; böylece
 * arayüz, API ve Windows paketleyici aynı numarayı kullanır.
 */

export const APP_NAME = "Personel26";

export const APP_VERSION = process.env.NEXT_PUBLIC_P26_VERSION ?? "0.0.0";

/** Varsayılan güncelleme beslemesi: deponun en son GitHub sürümündeki update.json. */
export const DEFAULT_UPDATE_FEED = "https://github.com/CehennemGibiyim/Personel26/releases/latest/download/update.json";

export const RELEASES_URL = "https://github.com/CehennemGibiyim/Personel26/releases";
export const REPOSITORY_URL = "https://github.com/CehennemGibiyim/Personel26";

/** Her GitHub sürümüne eklenen Windows kurulum dosyası. */
export const INSTALLER_URL = "https://github.com/CehennemGibiyim/Personel26/releases/latest/download/Personel26-Kurulum.exe";

/** Sunucusuz (tarayıcı veritabanlı) web sürümü. */
export const WEB_APP_URL = process.env.NEXT_PUBLIC_P26_WEB_URL ?? "https://cehennemgibiyim.github.io/Personel26/";

/** GitHub Pages (statik) derlemesi: sunucu yok, otomatik güncelleme de yok. */
export const BROWSER_ONLY = process.env.NEXT_PUBLIC_P26_BROWSER_DB === "1";

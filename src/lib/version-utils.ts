/**
 * Sürüm karşılaştırma ve güncelleme notu yardımcıları.
 *
 * Bu dosya bilerek yalnızca saf TypeScript içerir: hem tarayıcıda (Hakkında
 * ekranı) hem sunucuda (güncelleme denetimi) aynı kurallar kullanılır ve
 * Node.js'e özgü hiçbir modül içe aktarılmaz.
 */

export type ReleaseKind = "feature" | "fix" | "security" | "maintenance";

export type UpdateRelease = {
  /** "1.3.0" gibi, başında v olmadan. */
  version: string;
  kind?: ReleaseKind;
  title?: string;
  /** YYYY-AA-GG */
  date?: string;
  notes?: string[];
};

export type UpdatePackage = {
  /** Paket arşivinin HTTPS adresi (GitHub sürüm varlığı). */
  url: string;
  /** Arşivin küçük harfli SHA-256 özeti. */
  sha256: string;
  /** Bayt cinsinden boyut (isteğe bağlı, indirme göstergesi için). */
  size?: number;
  fileName?: string;
};

export type UpdateManifest = {
  schema: 1;
  app: "Personel26";
  version: string;
  releasedAt?: string;
  kind?: ReleaseKind;
  title?: string;
  notes?: string[];
  /** Paketin getirdiği veritabanı şema sürümü. */
  schemaVersion?: string;
  /** Bu sürümün altındaki kurulumların doğrudan atlayarak güncellenemeyeceği sınır. */
  minSupportedVersion?: string;
  /** Sürüm geçmişi (en yeniden eskiye). Atlanan ara sürümlerin notları buradan gelir. */
  releases?: UpdateRelease[];
  package: UpdatePackage;
};

export type Version = [number, number, number];

/** "v1.2.3" veya "1.2.3" biçimini sayı üçlüsüne çevirir; geçersizse null. */
export function parseVersion(value: string | null | undefined): Version | null {
  if (typeof value !== "string") return null;
  const match = /^v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Geçersiz sürümlerde 0 döner; geçerlilik ayrıca parseVersion ile denetlenmelidir. */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return 0;
}

/** candidate, current sürümünden kesin olarak yeniyse true. */
export function isNewerVersion(candidate: string, current: string): boolean {
  if (!parseVersion(candidate) || !parseVersion(current)) return false;
  return compareVersions(candidate, current) > 0;
}

/** Sürüm listesini en yeniden eskiye sıralar (geçersiz sürümler sona düşer). */
export function sortReleasesDescending(releases: UpdateRelease[]): UpdateRelease[] {
  return [...releases].sort((a, b) => {
    if (!parseVersion(a.version)) return 1;
    if (!parseVersion(b.version)) return -1;
    return compareVersions(b.version, a.version);
  });
}

/**
 * Mevcut sürümden yeni olan sürüm notlarını döndürür. Böylece kullanıcı
 * 1.1.0'dan 1.4.0'a geçerken ara sürümlerin düzeltmelerini de görür.
 */
export function newerReleases(releases: UpdateRelease[] | undefined, current: string): UpdateRelease[] {
  if (!Array.isArray(releases)) return [];
  return sortReleasesDescending(
    releases.filter(release => parseVersion(release.version) && isNewerVersion(release.version, current)),
  );
}

/** Atlanan sürüm numaraları (mevcut sürümden yeni, en son hariç). */
export function skippedVersions(releases: UpdateRelease[], latestVersion: string): string[] {
  return releases
    .map(release => release.version)
    .filter(version => version !== latestVersion);
}

export function releaseKindLabel(kind: ReleaseKind | undefined): string {
  switch (kind) {
    case "feature": return "Yeni özellik";
    case "fix": return "Hata düzeltmesi";
    case "security": return "Güvenlik";
    case "maintenance": return "Bakım";
    default: return "Güncelleme";
  }
}

/** İnsan okunur dosya boyutu. */
export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString("tr-TR", { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`;
}

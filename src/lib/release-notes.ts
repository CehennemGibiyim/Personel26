/**
 * Sürüm notları.
 *
 * `updates/surum-notlari.json` hem GitHub sürümünü üreten betiklerin hem de
 * panelin tek kaynağıdır. Dosya derlemeye gömüldüğü için sürüm notları
 * çevrimdışıyken ve GitHub Pages (sunucusuz) sürümünde de görüntülenebilir.
 */
import changelog from "../../updates/surum-notlari.json";
import type { UpdateRelease } from "@/lib/version-utils";

const RELEASES: UpdateRelease[] = Array.isArray(changelog.releases) ? (changelog.releases as UpdateRelease[]) : [];

/** Kurulu sürümün notları; yoksa en yeni kayıt. */
export function releaseNotesFor(version: string): UpdateRelease | null {
  return RELEASES.find(release => release.version === version) ?? null;
}

export function latestReleaseNotes(): UpdateRelease | null {
  return RELEASES[0] ?? null;
}

/** Kurulu sürüm için gösterilecek notlar (sürüm kaydı yoksa en yenisi). */
export function currentReleaseNotes(version: string): UpdateRelease | null {
  return releaseNotesFor(version) ?? latestReleaseNotes();
}

export function allReleaseNotes(): UpdateRelease[] {
  return RELEASES;
}

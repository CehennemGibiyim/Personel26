/**
 * Güncelleme API'sinin istemci ve sunucu arasında paylaşılan tipleri.
 * Saf TypeScript: Node.js modülü içermez.
 */
import type { ReleaseKind, UpdateRelease } from "@/lib/version-utils";

export type UpdateState =
  | "idle"
  | "downloading"
  | "verifying"
  | "extracting"
  | "stopping"
  | "backing-up"
  | "installing"
  | "restarting"
  | "done"
  | "error";

/** Windows güncelleme betiğinin `data/update-status.json` içine yazdığı durum. */
export type UpdateStatus = {
  state: UpdateState;
  message: string;
  percent?: number;
  from?: string;
  to?: string;
  startedAt?: string;
  updatedAt?: string;
  finishedAt?: string;
  /** Hata durumunda güncelleme günlüğünün son satırları. */
  logTail?: string;
};

export type UpdateCheckPackage = {
  url: string;
  size: number | null;
  fileName: string | null;
  sha256: string;
};

/** `POST /api/update/check` sonucu. */
export type UpdateCheckResult = {
  checkedAt: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  /** Mevcut sürümden yeni tüm sürümler (en yeni önce). */
  releases: UpdateRelease[];
  latestKind: ReleaseKind | null;
  /** Doğrudan atlanacak ara sürümler. */
  skippedVersions: string[];
  minSupportedVersion: string | null;
  /** Güncellemeyi engelleyen neden (çok eski sürüm vb.). */
  blocked: string | null;
  package: UpdateCheckPackage;
  feed: string;
};

export type UpdateAutoUpdateInfo = {
  supported: boolean;
  reason: string | null;
};

/** `GET /api/update` yanıtı. */
export type UpdateInfo = {
  currentVersion: string;
  platform: string;
  feed: string;
  autoUpdate: UpdateAutoUpdateInfo;
  lastCheck: UpdateCheckResult | null;
  status: UpdateStatus | null;
  /** Durum dosyası okunamıyorsa/yarıda kaldıysa true. */
  statusStale: boolean;
};

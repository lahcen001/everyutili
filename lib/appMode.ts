/** Pure helpers for "app mode": is the site running as an installed app, and is this a low-end phone? */

export type LitePref = "auto" | "on" | "off";

export interface DeviceSignals {
  /** navigator.deviceMemory in GB (Chrome / Android only) */
  deviceMemory?: number;
  hardwareConcurrency?: number;
  /** navigator.connection.saveData */
  saveData?: boolean;
  /** navigator.connection.effectiveType */
  effectiveType?: string;
}

/** True for phones that are likely to struggle: little memory, few cores, "data saver" on, or a very slow network. */
export function looksLowEnd(s: DeviceSignals): boolean {
  if (s.saveData) return true;
  if (typeof s.deviceMemory === "number" && s.deviceMemory <= 2) return true;
  if (typeof s.hardwareConcurrency === "number" && s.hardwareConcurrency > 0 && s.hardwareConcurrency <= 2) return true;
  if (s.effectiveType === "slow-2g" || s.effectiveType === "2g") return true;
  return false;
}

/** Lite mode (no blur, glow or animations) from the visitor's choice plus the device signals. */
export function resolveLite(pref: LitePref, signals: DeviceSignals): boolean {
  if (pref === "on") return true;
  if (pref === "off") return false;
  return looksLowEnd(signals);
}

export function parseLitePref(raw: string | null | undefined): LitePref {
  return raw === "on" || raw === "off" ? raw : "auto";
}

export interface DisplayEnv {
  matchesStandalone: boolean;
  matchesFullscreen: boolean;
  matchesMinimalUi: boolean;
  /** iOS Safari home-screen apps expose navigator.standalone */
  iosStandalone: boolean;
}

export const isInstalledApp = (e: DisplayEnv): boolean => e.matchesStandalone || e.matchesFullscreen || e.matchesMinimalUi || e.iosStandalone;

/** iPhone, iPad (including iPadOS that reports as a Mac with a touch screen). */
export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export const DISMISS_DAYS = 14;

/** Whether the install banner may be shown again after the visitor dismissed it at `dismissedAt` (epoch ms). */
export function canShowInstallBanner(dismissedAt: number | null, now: number): boolean {
  return dismissedAt === null || now - dismissedAt > DISMISS_DAYS * 86400000;
}

export type ShareKind = "image" | "video" | "text";

/** Picks what a shared item is, from the first file's MIME type (or text when nothing was a file). */
export function shareKindFor(mimeTypes: string[], hasText: boolean): ShareKind | null {
  for (const m of mimeTypes) {
    if (m.startsWith("image/")) return "image";
    if (m.startsWith("video/")) return "video";
  }
  return hasText ? "text" : null;
}

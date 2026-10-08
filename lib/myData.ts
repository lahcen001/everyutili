/** Everything the tools remember lives in this browser's localStorage (plus the result history in IndexedDB). */

export const APP_PREFIXES = ["everyutili", "onmitools", "omnitools"] as const;
export const BACKUP_FORMAT = "everyutili-backup";
export const BACKUP_VERSION = 1;
/** IndexedDB databases that hold saved results (files you made) — erased with "Erase everything". */
export const APP_DATABASES = ["omnitools-history", "everyutili-pipeline"] as const;

export const isAppKey = (key: string): boolean => APP_PREFIXES.some((p) => key.startsWith(p));

export type DataGroup = "tasks" | "habits" | "flashcards" | "exams" | "focus" | "games" | "qr" | "calc" | "random" | "tools" | "other";

/** Which friendly group a saved key belongs to. */
export function groupOf(key: string): DataGroup {
  const k = key.toLowerCase();
  if (/todos|eisenhower/.test(k)) return "tasks";
  if (/habits|journal|studylog|stretch/.test(k)) return "habits";
  if (/flashcards/.test(k)) return "flashcards";
  if (/countdowns|reminders/.test(k)) return "exams";
  if (/pomodoro|focus_sounds|focus-sounds/.test(k)) return "focus";
  if (/_best|schulte|nback|simon|stroop|numbermemory|aim|2048|snake|memory|reaction|typing|math_/.test(k)) return "games";
  if (/qr_|qr-/.test(k)) return "qr";
  if (/scicalc|stats_|calc/.test(k)) return "calc";
  if (/wheel|names|raffle|teams|bracket|shuffler/.test(k)) return "random";
  if (/recent|favorite|iptv|signatures|history/.test(k)) return "tools";
  return "other";
}

export interface DataEntry {
  key: string;
  value: string;
  bytes: number;
  group: DataGroup;
}

export interface StorageLike {
  length: number;
  key(i: number): string | null;
  getItem(key: string): string | null;
}

/** Reads every app key from a storage object. */
export function collect(storage: StorageLike): DataEntry[] {
  const out: DataEntry[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !isAppKey(key)) continue;
    const value = storage.getItem(key);
    if (value === null) continue;
    out.push({ key, value, bytes: new TextEncoder().encode(key + value).length, group: groupOf(key) });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

export interface GroupSummary {
  group: DataGroup;
  items: number;
  bytes: number;
}

export function summarize(entries: DataEntry[]): GroupSummary[] {
  const map = new Map<DataGroup, GroupSummary>();
  for (const e of entries) {
    const g = map.get(e.group) ?? { group: e.group, items: 0, bytes: 0 };
    g.items += 1;
    g.bytes += e.bytes;
    map.set(e.group, g);
  }
  return [...map.values()].sort((a, b) => b.bytes - a.bytes);
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Record<string, string>;
}

export function buildBackup(entries: DataEntry[], now: Date = new Date()): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: Object.fromEntries(entries.map((e) => [e.key, e.value])) };
}

/** Validates a backup file's text. Returns the keys to restore, or null when it is not one of our backups. */
export function parseBackup(text: string): Record<string, string> | null {
  try {
    const raw = JSON.parse(text) as Partial<Backup>;
    if (raw.format !== BACKUP_FORMAT || typeof raw.version !== "number" || raw.version > BACKUP_VERSION || !raw.data || typeof raw.data !== "object") return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw.data)) if (isAppKey(k) && typeof v === "string") out[k] = v;
    return out;
  } catch {
    return null;
  }
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

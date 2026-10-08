export interface LogEntry {
  id: string;
  subject: string;
  /** epoch ms when the session started */
  start: number;
  minutes: number;
  note?: string;
}

const DAY = 86400000;

export const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Minutes studied per subject within [from, to). */
export function totalsBySubject(entries: LogEntry[], from: number, to: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (e.start >= from && e.start < to) out[e.subject] = (out[e.subject] ?? 0) + e.minutes;
  }
  return out;
}

export const sumMinutes = (t: Record<string, number>): number => Object.values(t).reduce((a, b) => a + b, 0);

/** Last `days` days (oldest first) of total minutes, for the bar chart. */
export function dailyTotals(entries: LogEntry[], days: number, now = Date.now()): { day: number; minutes: number }[] {
  const today = startOfDay(now);
  return Array.from({ length: days }, (_, i) => {
    const day = today - (days - 1 - i) * DAY;
    return { day, minutes: sumMinutes(totalsBySubject(entries, day, day + DAY)) };
  });
}

export function formatMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 === 0 ? `${h}h` : `${h}h ${m % 60}m`;
}

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function toCsv(entries: LogEntry[]): string {
  const rows = [...entries].sort((a, b) => a.start - b.start).map((e) => [new Date(e.start).toISOString(), e.subject, String(e.minutes), e.note ?? ""].map(csvCell).join(","));
  return ["start,subject,minutes,note", ...rows].join("\n");
}

export type Phase = "focus" | "short" | "long";

export interface PomodoroSettings {
  focusMin: number;
  shortMin: number;
  longMin: number;
  /** A long break after this many focus sessions. */
  longEvery: number;
}

export const DEFAULT_SETTINGS: PomodoroSettings = { focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4 };

export function phaseSeconds(phase: Phase, s: PomodoroSettings): number {
  const min = phase === "focus" ? s.focusMin : phase === "short" ? s.shortMin : s.longMin;
  return Math.max(1, Math.round(min * 60));
}

/** The phase that follows `phase`, given how many focus sessions are finished (including this one). */
export function nextPhase(phase: Phase, completedFocus: number, s: PomodoroSettings): Phase {
  if (phase !== "focus") return "focus";
  return completedFocus > 0 && completedFocus % Math.max(1, s.longEvery) === 0 ? "long" : "short";
}

export function formatClock(totalSeconds: number): string {
  const t = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function dayKey(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export type StatsByDay = Record<string, { sessions: number; minutes: number }>;

export function addSession(stats: StatsByDay, minutes: number, date: Date = new Date()): StatsByDay {
  const key = dayKey(date);
  const cur = stats[key] ?? { sessions: 0, minutes: 0 };
  return { ...stats, [key]: { sessions: cur.sessions + 1, minutes: cur.minutes + minutes } };
}

/** Last `days` days (oldest first) with zero-filled gaps, for the weekly chart. */
export function lastDays(stats: StatsByDay, days: number, today: Date = new Date()): { key: string; sessions: number; minutes: number }[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    const key = dayKey(d);
    return { key, sessions: stats[key]?.sessions ?? 0, minutes: stats[key]?.minutes ?? 0 };
  });
}

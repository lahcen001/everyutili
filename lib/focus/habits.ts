import { dayKey } from "@/lib/focus/pomodoro";

export interface Habit {
  id: string;
  name: string;
  color: string;
  /** "YYYY-MM-DD" days it was done */
  done: string[];
}

export function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

/** Current streak: consecutive days ending today (or yesterday, if today isn't done yet). */
export function currentStreak(done: string[], today: string = dayKey()): number {
  const set = new Set(done);
  let day = set.has(today) ? today : shiftDay(today, -1);
  let n = 0;
  while (set.has(day)) {
    n += 1;
    day = shiftDay(day, -1);
  }
  return n;
}

export function bestStreak(done: string[]): number {
  const days = [...new Set(done)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && shiftDay(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function toggleDay(done: string[], key: string): string[] {
  return done.includes(key) ? done.filter((d) => d !== key) : [...done, key];
}

/** Share of the last `days` days (ending today) that were done, 0..100. */
export function completionRate(done: string[], days: number, today: string = dayKey()): number {
  const set = new Set(done);
  let hit = 0;
  for (let i = 0; i < days; i++) if (set.has(shiftDay(today, -i))) hit += 1;
  return Math.round((hit / days) * 100);
}

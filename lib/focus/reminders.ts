import { dayKey } from "@/lib/focus/pomodoro";

export type ReminderKind = "todos-overdue" | "todos-today" | "habits" | "exam" | "cards" | "timer";

export interface Reminder {
  id: string;
  kind: ReminderKind;
  count?: number;
  name?: string;
  days?: number;
  href: string;
  tone: "red" | "amber" | "blue" | "green";
}

export interface RemindersInput {
  todos?: { done?: boolean; due?: string }[];
  habits?: { done?: string[] }[];
  countdowns?: { name?: string; at?: number }[];
  decks?: { cards?: { due?: number }[] }[];
  running?: { subject?: string } | null;
}

const DAY = 86400000;

/** What deserves the visitor's attention today, from the data the focus tools keep in localStorage. */
export function buildReminders(input: RemindersInput, now: Date = new Date()): Reminder[] {
  const out: Reminder[] = [];
  const today = dayKey(now);

  const open = (input.todos ?? []).filter((t) => !t.done && t.due);
  const overdue = open.filter((t) => (t.due as string) < today).length;
  const dueToday = open.filter((t) => t.due === today).length;
  if (overdue > 0) out.push({ id: "todos-overdue", kind: "todos-overdue", count: overdue, href: "/tools/focus-study/todo-list", tone: "red" });
  if (dueToday > 0) out.push({ id: "todos-today", kind: "todos-today", count: dueToday, href: "/tools/focus-study/todo-list", tone: "amber" });

  const habits = input.habits ?? [];
  const left = habits.filter((h) => !(h.done ?? []).includes(today)).length;
  if (habits.length > 0 && left > 0) out.push({ id: "habits", kind: "habits", count: left, href: "/tools/focus-study/habit-tracker", tone: "blue" });

  const upcoming = (input.countdowns ?? [])
    .filter((c): c is { name: string; at: number } => typeof c.at === "number" && !!c.name && c.at >= now.getTime() && c.at - now.getTime() <= 14 * DAY)
    .sort((a, b) => a.at - b.at)[0];
  if (upcoming) {
    const days = Math.floor((upcoming.at - now.getTime()) / DAY);
    out.push({ id: `exam-${upcoming.at}`, kind: "exam", name: upcoming.name, days, href: "/tools/focus-study/exam-countdown", tone: days <= 3 ? "red" : "amber" });
  }

  let due = 0;
  for (const d of input.decks ?? []) for (const c of d.cards ?? []) if (typeof c.due === "number" && c.due <= now.getTime()) due += 1;
  if (due > 0) out.push({ id: "cards", kind: "cards", count: due, href: "/tools/focus-study/flashcards", tone: "green" });

  if (input.running?.subject) out.push({ id: "timer", kind: "timer", name: input.running.subject, href: "/tools/focus-study/study-time-tracker", tone: "blue" });
  return out;
}

function read<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

/** Reads the saved data of the focus tools (safe if nothing is saved or storage is unavailable). */
export function loadReminders(now: Date = new Date()): Reminder[] {
  const studylog = read<{ running?: { subject?: string } | null }>("everyutili_studylog");
  const flash = read<{ decks?: RemindersInput["decks"] }>("everyutili_flashcards");
  return buildReminders(
    {
      todos: read("everyutili_todos"),
      habits: read("everyutili_habits"),
      countdowns: read("everyutili_countdowns"),
      decks: flash?.decks,
      running: studylog?.running ?? null,
    },
    now
  );
}

export const REMINDER_KEYS = { notify: "everyutili_reminders_notify", hidden: "everyutili_reminders_hidden", last: "everyutili_reminders_last" } as const;

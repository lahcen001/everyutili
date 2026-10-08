"use client";

import * as React from "react";
import { AlarmClock, Bell, BellRing, CalendarClock, Flame, Layers, ListTodo, TimerReset, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { dayKey } from "@/lib/focus/pomodoro";
import { REMINDER_KEYS, loadReminders, type Reminder } from "@/lib/focus/reminders";
import { useReminderText } from "@/components/home/useReminderText";

const ICON: Record<Reminder["kind"], React.ReactNode> = {
  "todos-overdue": <AlarmClock className="h-5 w-5" />,
  "todos-today": <ListTodo className="h-5 w-5" />,
  habits: <Flame className="h-5 w-5" />,
  exam: <CalendarClock className="h-5 w-5" />,
  cards: <Layers className="h-5 w-5" />,
  timer: <TimerReset className="h-5 w-5" />,
};
const TONE: Record<Reminder["tone"], string> = {
  red: "border-rose-500/40 bg-rose-500/5 [&_.ico]:bg-rose-500/15 [&_.ico]:text-rose-600",
  amber: "border-amber-500/40 bg-amber-500/5 [&_.ico]:bg-amber-500/15 [&_.ico]:text-amber-600",
  blue: "border-sky-500/40 bg-sky-500/5 [&_.ico]:bg-sky-500/15 [&_.ico]:text-sky-600",
  green: "border-emerald-500/40 bg-emerald-500/5 [&_.ico]:bg-emerald-500/15 [&_.ico]:text-emerald-600",
};

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  window.addEventListener("everyutili-reminders", onChange);
  const id = window.setInterval(onChange, 60000);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
    window.removeEventListener("everyutili-reminders", onChange);
    window.clearInterval(id);
  };
}
/** A string snapshot, so React only re-renders when the reminders really change. */
function snapshot(): string {
  try {
    if (window.localStorage.getItem(REMINDER_KEYS.hidden) === dayKey()) return "hidden";
  } catch {
    /* storage unavailable */
  }
  return JSON.stringify(loadReminders());
}

/**
 * Home-page reminders: overdue and due tasks, habits left today, a close exam, flashcards to review
 * and a running study timer — all read from what the focus tools saved in this browser.
 */
export function RemindersShelf() {
  const t = useTranslations("reminders");
  const text = useReminderText();
  const raw = React.useSyncExternalStore(subscribe, snapshot, () => "[]");
  const notifyFlag = React.useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(REMINDER_KEYS.notify) === "1" ? "1" : "0";
      } catch {
        return "0";
      }
    },
    () => "0"
  );
  const permission = React.useSyncExternalStore(
    subscribe,
    () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
    () => "unsupported"
  );

  const reminders = React.useMemo<Reminder[]>(() => (raw === "hidden" ? [] : (JSON.parse(raw) as Reminder[])), [raw]);
  if (reminders.length === 0) return null;

  const notifying = notifyFlag === "1" && permission === "granted";
  const ping = () => window.dispatchEvent(new Event("everyutili-reminders"));

  const toggleNotify = async () => {
    try {
      if (notifying) {
        window.localStorage.setItem(REMINDER_KEYS.notify, "0");
      } else {
        const result = permission === "granted" ? "granted" : await Notification.requestPermission();
        if (result === "granted") window.localStorage.setItem(REMINDER_KEYS.notify, "1");
      }
    } catch {
      /* ignore */
    }
    ping();
  };
  const hideToday = () => {
    try {
      window.localStorage.setItem(REMINDER_KEYS.hidden, dayKey());
    } catch {
      /* ignore */
    }
    ping();
  };

  return (
    <section className="mx-auto max-w-5xl px-4 pb-8 pt-2" aria-label={t("heading")}>
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-fuchsia-500/10 p-4 shadow-lg shadow-primary/5 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BellRing className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-tight tracking-tight">{t("heading")}</h2>
            <p className="text-xs text-muted-foreground">{t("subheading")}</p>
          </div>
          {permission !== "unsupported" && (
            <button
              onClick={() => void toggleNotify()}
              disabled={permission === "denied"}
              title={permission === "denied" ? t("notifyBlocked") : undefined}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-50", notifying ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted")}
            >
              <Bell className="h-3.5 w-3.5" /> {notifying ? t("notifyEnabled") : t("notifyOn")}
            </button>
          )}
          <button onClick={hideToday} aria-label={t("hideToday")} title={t("hideToday")} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {permission === "denied" && <p className="mb-2 text-xs text-muted-foreground">{t("notifyBlocked")}</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {reminders.map((r) => (
            <li key={r.id}>
              <Link href={r.href} className={cn("group flex items-center gap-3 rounded-2xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md", TONE[r.tone])}>
                <span className="ico flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">{ICON[r.kind]}</span>
                <span className="min-w-0 flex-1 text-sm font-semibold">{text(r)}</span>
                <span className="shrink-0 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">{t("open")}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">{t("privacyNote")}</p>
      </div>
    </section>
  );
}

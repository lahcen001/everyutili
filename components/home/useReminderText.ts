"use client";

import { useTranslations } from "next-intl";

import type { Reminder } from "@/lib/focus/reminders";

/** Turns a reminder into a sentence in the visitor's language. */
export function useReminderText(): (r: Reminder) => string {
  const t = useTranslations("reminders");
  return (r) => {
    switch (r.kind) {
      case "todos-overdue":
        return t("todosOverdue", { count: r.count ?? 0 });
      case "todos-today":
        return t("todosToday", { count: r.count ?? 0 });
      case "habits":
        return t("habitsLeft", { count: r.count ?? 0 });
      case "exam":
        return t("examSoon", { name: r.name ?? "", days: r.days ?? 0 });
      case "cards":
        return t("cardsDue", { count: r.count ?? 0 });
      case "timer":
        return t("timerRunning", { subject: r.name ?? "" });
    }
  };
}

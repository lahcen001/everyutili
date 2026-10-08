"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { dayKey } from "@/lib/focus/pomodoro";
import { REMINDER_KEYS, loadReminders } from "@/lib/focus/reminders";
import { useReminderText } from "@/components/home/useReminderText";

const EVERY_MS = 15 * 60 * 1000;
const RENOTIFY_MS = 2 * 60 * 60 * 1000;

/**
 * Shows a desktop notification with the day's reminders — only if the visitor switched
 * "Notify me" on and allowed notifications. It runs while EveryUtili is open in a tab
 * (a website can't notify a closed browser without a server), and never more than once
 * every two hours unless the list changes on a new day.
 */
export function ReminderNotifier() {
  const t = useTranslations("reminders");
  const text = useReminderText();

  useEffect(() => {
    const check = () => {
      try {
        if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
        if (window.localStorage.getItem(REMINDER_KEYS.notify) !== "1") return;
        if (window.localStorage.getItem(REMINDER_KEYS.hidden) === dayKey()) return;
        const list = loadReminders().filter((r) => r.kind !== "timer");
        if (list.length === 0) return;
        const sig = list.map((r) => `${r.id}:${r.count ?? ""}:${r.days ?? ""}`).join("|");
        const last = JSON.parse(window.localStorage.getItem(REMINDER_KEYS.last) ?? "null") as { day: string; sig: string; at: number } | null;
        const now = Date.now();
        const fresh = !last || last.day !== dayKey() || (last.sig !== sig && now - last.at > RENOTIFY_MS);
        if (!fresh) return;
        window.localStorage.setItem(REMINDER_KEYS.last, JSON.stringify({ day: dayKey(), sig, at: now }));
        const n = new Notification(t("notificationTitle"), { body: list.map(text).join("\n"), tag: "everyutili-reminders" });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {
        /* notifications unavailable */
      }
    };
    const first = window.setTimeout(check, 4000);
    const id = window.setInterval(check, EVERY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [t, text]);

  return null;
}

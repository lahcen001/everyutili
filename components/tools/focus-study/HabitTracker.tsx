"use client";

import * as React from "react";
import { Check, Flame, Plus, Trash2, Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { bestStreak, completionRate, currentStreak, shiftDay, toggleDay, type Habit } from "@/lib/focus/habits";
import { dayKey } from "@/lib/focus/pomodoro";

const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6", "#ec4899"];
const SUGGESTIONS = ["Study 1 hour", "Read 20 pages", "Exercise", "Drink water", "Review flashcards", "Sleep before 11pm"];
const uid = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function HabitTracker() {
  useTrackTool("habit-tracker");
  const [habits, setHabits] = usePersisted<Habit[]>("everyutili_habits", []);
  const [name, setName] = React.useState("");
  const today = dayKey();
  const week = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6));
  const heat = Array.from({ length: 35 }, (_, i) => shiftDay(today, i - 34));

  const add = (n = name) => {
    const text = n.trim();
    if (!text) return;
    setHabits((prev) => [...prev, { id: uid(), name: text, color: COLORS[prev.length % COLORS.length], done: [] }]);
    setName("");
  };
  const doneToday = habits.filter((h) => h.done.includes(today)).length;

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="New habit, e.g. Review notes for 20 minutes" maxLength={60} aria-label="New habit" className="h-10 min-w-48 flex-1 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <Button onClick={() => add()} disabled={!name.trim()}>
            <Plus className="h-4 w-4" /> Add habit
          </Button>
        </div>
        {habits.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => add(s)} className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary">
                + {s}
              </button>
            ))}
          </div>
        )}
      </Card>

      {habits.length > 0 && (
        <>
          <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary/10 to-fuchsia-500/10 p-4">
            <div className="relative h-14 w-14 shrink-0">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray={94.2} strokeDashoffset={94.2 * (1 - doneToday / habits.length)} className="transition-all" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold">{doneToday}/{habits.length}</span>
            </div>
            <div>
              <p className="font-bold">{doneToday === habits.length ? "All done today — great job!" : "Today's habits"}</p>
              <p className="text-sm text-muted-foreground">{habits.length - doneToday} left to check off</p>
            </div>
          </div>

          <div className="space-y-3">
            {habits.map((h) => {
              const streak = currentStreak(h.done, today);
              const best = bestStreak(h.done);
              const rate = completionRate(h.done, 30, today);
              return (
                <Card key={h.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: h.color }} />
                    <h3 className="min-w-0 flex-1 truncate font-semibold">{h.name}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-bold text-orange-600">
                      <Flame className="h-3.5 w-3.5" /> {streak} day{streak === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600" title="Best streak">
                      <Trophy className="h-3.5 w-3.5" /> {best}
                    </span>
                    <span className="text-xs text-muted-foreground">{rate}% (30 days)</span>
                    <button onClick={() => { if (window.confirm(`Delete “${h.name}”?`)) setHabits((p) => p.filter((x) => x.id !== h.id)); }} aria-label={`Delete ${h.name}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {week.map((d) => {
                      const on = h.done.includes(d);
                      const label = new Date(d + "T00:00").toLocaleDateString(undefined, { weekday: "short" });
                      return (
                        <button key={d} onClick={() => setHabits((p) => p.map((x) => (x.id === h.id ? { ...x, done: toggleDay(x.done, d) } : x)))} aria-pressed={on} aria-label={`${h.name} on ${d}`} className={cn("flex flex-col items-center gap-1 rounded-xl border-2 py-2 text-[11px] font-medium transition-all", on ? "border-transparent text-white shadow-md" : "border-border text-muted-foreground hover:border-primary/50", d === today && !on && "border-dashed border-primary/60")} style={on ? { backgroundColor: h.color } : undefined}>
                          {label}
                          <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", on ? "bg-white/25" : "bg-muted")}>{on && <Check className="h-4 w-4" />}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1" aria-label="Last 5 weeks">
                    <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}>
                      {heat.map((d) => (
                        <span key={d} title={d} className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: h.done.includes(d) ? h.color : "color-mix(in oklab, var(--muted) 100%, transparent)" }} />
                      ))}
                    </div>
                    <span className="ml-2 text-[11px] text-muted-foreground">last 5 weeks</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">Saved only in this browser. A streak counts consecutive days ending today — or yesterday, if you haven&apos;t checked today off yet.</p>
    </div>
  );
}

"use client";

import * as React from "react";
import { BookHeart, Download, Search, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { dayKey } from "@/lib/focus/pomodoro";
import { currentStreak, shiftDay } from "@/lib/focus/habits";

interface Entry {
  mood: number;
  grateful: string;
  wins: string;
  notes: string;
  updated: number;
}
type Journal = Record<string, Entry>;

const MOODS = [
  { v: 1, emoji: "😞", label: "Rough" },
  { v: 2, emoji: "😕", label: "Low" },
  { v: 3, emoji: "😐", label: "Okay" },
  { v: 4, emoji: "🙂", label: "Good" },
  { v: 5, emoji: "😄", label: "Great" },
];
const EMPTY: Entry = { mood: 0, grateful: "", wins: "", notes: "", updated: 0 };
const isEmpty = (e: Entry) => !e.mood && !e.grateful.trim() && !e.wins.trim() && !e.notes.trim();

export default function DailyJournal() {
  useTrackTool("daily-journal");
  const [journal, setJournal] = usePersisted<Journal>("everyutili_journal", {});
  const today = dayKey();
  const [day, setDay] = React.useState(today);
  const [query, setQuery] = React.useState("");
  const entry = journal[day] ?? EMPTY;

  const save = (patch: Partial<Entry>) =>
    setJournal((j) => {
      const next = { ...(j[day] ?? EMPTY), ...patch, updated: Date.now() };
      if (isEmpty(next)) {
        const rest = { ...j };
        delete rest[day];
        return rest;
      }
      return { ...j, [day]: next };
    });

  const days = Object.keys(journal).sort().reverse();
  const q = query.trim().toLowerCase();
  const list = days.filter((d) => !q || [journal[d].grateful, journal[d].wins, journal[d].notes, d].some((t) => t.toLowerCase().includes(q)));
  const streak = currentStreak(days, today);
  const week = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6));
  const moods = days.map((d) => journal[d].mood).filter(Boolean);
  const avg = moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : "–";

  const exportText = () =>
    days
      .slice()
      .reverse()
      .map((d) => `${d}  ${MOODS.find((m) => m.v === journal[d].mood)?.emoji ?? ""}\nGrateful for: ${journal[d].grateful}\nWins: ${journal[d].wins}\nNotes: ${journal[d].notes}`)
      .join("\n\n---\n\n");

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {week.map((d) => {
              const has = !!journal[d];
              return (
                <button key={d} onClick={() => setDay(d)} aria-pressed={day === d} className={cn("flex min-w-12 flex-1 flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-1.5 text-xs", day === d ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
                  <span className="text-muted-foreground">{new Date(d + "T00:00").toLocaleDateString(undefined, { weekday: "short" })}</span>
                  <span className="text-base font-bold">{Number(d.slice(8))}</span>
                  <span className="text-sm">{has ? (MOODS.find((m) => m.v === journal[d].mood)?.emoji ?? "•") : "·"}</span>
                </button>
              );
            })}
            <input type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Pick a date" className="h-9 shrink-0 rounded-lg border border-border bg-background px-2 text-xs" />
          </div>
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <BookHeart className="h-5 w-5 text-primary" />
            {day === today ? "Today" : new Date(day + "T00:00").toLocaleDateString(undefined, { dateStyle: "full" })}
          </h3>
          <div>
            <p className="mb-1.5 text-sm font-medium">How are you feeling?</p>
            <div className="flex gap-2" role="radiogroup" aria-label="Mood">
              {MOODS.map((m) => (
                <button key={m.v} role="radio" aria-checked={entry.mood === m.v} onClick={() => save({ mood: entry.mood === m.v ? 0 : m.v })} title={m.label} className={cn("flex flex-1 flex-col items-center gap-0.5 rounded-xl border-2 py-2 transition-all", entry.mood === m.v ? "scale-105 border-primary bg-primary/10" : "border-border hover:bg-muted")}>
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-[10px] text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          {([
            ["grateful", "I'm grateful for…", "Three small things that went well or that you appreciate"],
            ["wins", "Today's wins", "What did you finish or learn?"],
            ["notes", "Notes & thoughts", "Anything else on your mind"],
          ] as const).map(([key, label, ph]) => (
            <label key={key} className="block space-y-1">
              <span className="text-sm font-medium">{label}</span>
              <textarea value={entry[key]} onChange={(e) => save({ [key]: e.target.value })} rows={key === "notes" ? 5 : 3} placeholder={ph} className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </label>
          ))}
          <p className="text-xs text-muted-foreground">{entry.updated ? `Saved automatically · ${new Date(entry.updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Start writing — it saves automatically in this browser."}</p>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="grid grid-cols-3 gap-2 p-4 text-center">
          <div><p className="text-2xl font-extrabold">{streak}</p><p className="text-xs text-muted-foreground">day streak</p></div>
          <div><p className="text-2xl font-extrabold">{days.length}</p><p className="text-xs text-muted-foreground">entries</p></div>
          <div><p className="text-2xl font-extrabold">{avg}</p><p className="text-xs text-muted-foreground">avg mood</p></div>
        </Card>
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2 rounded-lg border border-border px-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search entries" aria-label="Search entries" className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>
          <ul className="max-h-96 space-y-1 overflow-auto">
            {list.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{days.length ? "No matches." : "Your entries will appear here."}</li>}
            {list.map((d) => (
              <li key={d}>
                <button onClick={() => setDay(d)} className={cn("flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted", d === day && "bg-primary/10")}>
                  <span className="text-lg">{MOODS.find((m) => m.v === journal[d].mood)?.emoji ?? "📝"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold">{d}</span>
                    <span className="block truncate text-xs text-muted-foreground">{journal[d].wins || journal[d].grateful || journal[d].notes}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={days.length === 0} onClick={() => downloadBlob(new Blob([exportText()], { type: "text/plain" }), "journal.txt")}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" variant="ghost" disabled={!journal[day]} onClick={() => { if (window.confirm("Delete this day's entry?")) setJournal((j) => { const r = { ...j }; delete r[day]; return r; }); }}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" /> Delete day
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

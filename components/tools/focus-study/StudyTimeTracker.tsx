"use client";

import * as React from "react";
import { Download, Pause, Play, Plus, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { dailyTotals, formatMinutes, startOfDay, sumMinutes, toCsv, totalsBySubject, type LogEntry } from "@/lib/focus/studylog";
import { formatClock } from "@/lib/focus/pomodoro";

interface Store {
  subjects: { name: string; color: string }[];
  entries: LogEntry[];
  running: { subject: string; startedAt: number } | null;
}
const COLORS = ["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#0ea5e9", "#ec4899", "#8b5cf6"];
const uid = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function StudyTimeTracker() {
  useTrackTool("study-time-tracker");
  const [store, setStore] = usePersisted<Store>("everyutili_studylog", { subjects: [{ name: "Maths", color: COLORS[0] }, { name: "Reading", color: COLORS[1] }], entries: [], running: null });
  const [selected, setSelected] = React.useState<string>(() => store.running?.subject ?? store.subjects[0]?.name ?? "");
  const [newSubject, setNewSubject] = React.useState("");
  const [manual, setManual] = React.useState(30);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!store.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [store.running]);

  const colorOf = (name: string) => store.subjects.find((s) => s.name === name)?.color ?? "#94a3b8";
  const elapsed = store.running ? Math.max(0, (now - store.running.startedAt) / 1000) : 0;

  const stop = () => {
    const r = store.running;
    if (!r) return;
    const minutes = Math.max(1, Math.round((Date.now() - r.startedAt) / 60000));
    setStore((s) => ({ ...s, running: null, entries: [...s.entries, { id: uid(), subject: r.subject, start: r.startedAt, minutes }] }));
  };
  const start = () => {
    if (!selected) return;
    setNow(Date.now());
    setStore((s) => ({ ...s, running: { subject: selected, startedAt: Date.now() } }));
  };
  const addManual = () => {
    if (!selected || manual <= 0) return;
    setStore((s) => ({ ...s, entries: [...s.entries, { id: uid(), subject: selected, start: Date.now(), minutes: manual }] }));
  };
  const addSubject = () => {
    const name = newSubject.trim();
    if (!name || store.subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
    setStore((s) => ({ ...s, subjects: [...s.subjects, { name, color: COLORS[s.subjects.length % COLORS.length] }] }));
    setSelected(name);
    setNewSubject("");
  };

  const today0 = startOfDay(now);
  const day = 86400000;
  const todayT = totalsBySubject(store.entries, today0, today0 + day);
  const weekT = totalsBySubject(store.entries, today0 - 6 * day, today0 + day);
  const allT = totalsBySubject(store.entries, 0, Infinity);
  const week = dailyTotals(store.entries, 7, now);
  const weekMax = Math.max(30, ...week.map((d) => d.minutes));
  const weekTotal = sumMinutes(weekT);
  const recent = [...store.entries].sort((a, b) => b.start - a.start).slice(0, 12);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <Card className="space-y-4 bg-gradient-to-br from-primary/5 to-fuchsia-500/5 p-5">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Subject">
            {store.subjects.map((s) => (
              <button key={s.name} onClick={() => !store.running && setSelected(s.name)} disabled={!!store.running && store.running.subject !== s.name} aria-pressed={selected === s.name} className={cn("flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40", selected === s.name ? "bg-background" : "border-border hover:bg-muted")} style={selected === s.name ? { borderColor: s.color } : undefined}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} /> {s.name}
              </button>
            ))}
            <span className="flex items-center gap-1">
              <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubject()} placeholder="New subject" maxLength={30} aria-label="New subject" className="h-9 w-32 rounded-full border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <Button size="sm" variant="outline" onClick={addSubject} disabled={!newSubject.trim()} aria-label="Add subject">
                <Plus className="h-4 w-4" />
              </Button>
            </span>
          </div>
          <div className="flex flex-col items-center gap-3 py-2">
            <p className="font-mono text-6xl font-black tabular-nums sm:text-7xl" role="timer">{formatClock(elapsed)}</p>
            <p className="text-sm text-muted-foreground">{store.running ? `Studying ${store.running.subject}…` : selected ? `Ready to study ${selected}` : "Add a subject to begin"}</p>
            <Button size="lg" className="h-14 min-w-44 rounded-full text-base" onClick={() => (store.running ? stop() : start())} disabled={!selected}>
              {store.running ? <><Pause className="h-5 w-5" /> Stop & save</> : <><Play className="h-5 w-5" /> Start studying</>}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Forgot to start? Add</span>
            <input type="number" min={1} max={600} value={manual} onChange={(e) => setManual(Math.min(600, Math.max(1, Number(e.target.value) || 1)))} aria-label="Minutes" className="h-8 w-16 rounded-lg border border-border bg-background px-2 text-center" />
            <span className="text-muted-foreground">minutes to {selected || "…"}</span>
            <Button size="sm" variant="outline" onClick={addManual} disabled={!selected}>Add</Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Last 7 days</h3>
            <span className="text-sm text-muted-foreground">{formatMinutes(weekTotal)} total</span>
          </div>
          <div className="flex h-32 items-end gap-2">
            {week.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${new Date(d.day).toLocaleDateString()}: ${formatMinutes(d.minutes)}`}>
                <div className="flex w-full flex-1 items-end">
                  <div className={cn("w-full rounded-t-lg", d.day === today0 ? "bg-primary" : "bg-primary/35")} style={{ height: `${Math.max(3, (d.minutes / weekMax) * 100)}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(d.day).toLocaleDateString(undefined, { weekday: "narrow" })}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="space-y-3 p-4">
          <h3 className="text-sm font-semibold">By subject</h3>
          {store.subjects.map((s) => (
            <div key={s.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} /> {s.name}</span>
                <span className="text-xs text-muted-foreground">today {formatMinutes(todayT[s.name] ?? 0)} · week {formatMinutes(weekT[s.name] ?? 0)} · all {formatMinutes(allT[s.name] ?? 0)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${weekTotal ? ((weekT[s.name] ?? 0) / weekTotal) * 100 : 0}%`, backgroundColor: s.color }} />
              </div>
            </div>
          ))}
        </Card>
        <Card className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent sessions</h3>
            <Button size="sm" variant="outline" disabled={store.entries.length === 0} onClick={() => downloadBlob(new Blob([toCsv(store.entries)], { type: "text/csv" }), "study-log.csv")}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
          {recent.length === 0 && <p className="text-sm text-muted-foreground">No sessions yet.</p>}
          <ul className="space-y-1.5">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(e.subject) }} />
                <span className="min-w-0 flex-1 truncate">{e.subject}</span>
                <span className="text-xs text-muted-foreground">{new Date(e.start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                <span className="w-14 text-right font-semibold tabular-nums">{formatMinutes(e.minutes)}</span>
                <button onClick={() => setStore((s) => ({ ...s, entries: s.entries.filter((x) => x.id !== e.id) }))} aria-label="Delete session" className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

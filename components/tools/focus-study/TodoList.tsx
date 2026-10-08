"use client";

import * as React from "react";
import { AlarmClock, Check, Flag, Plus, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { dayKey } from "@/lib/focus/pomodoro";

type Priority = "high" | "medium" | "low";
interface Todo {
  id: string;
  text: string;
  done: boolean;
  priority: Priority;
  due: string;
  created: number;
}
type Filter = "all" | "active" | "done";

const PRIORITY: Record<Priority, { label: string; dot: string; rank: number }> = {
  high: { label: "High", dot: "bg-rose-500", rank: 0 },
  medium: { label: "Medium", dot: "bg-amber-500", rank: 1 },
  low: { label: "Low", dot: "bg-sky-500", rank: 2 },
};
const uid = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function TodoList() {
  useTrackTool("todo-list");
  const [todos, setTodos] = usePersisted<Todo[]>("everyutili_todos", []);
  const [text, setText] = React.useState("");
  const [priority, setPriority] = React.useState<Priority>("medium");
  const [due, setDue] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [editing, setEditing] = React.useState<string | null>(null);
  const today = dayKey();

  const add = () => {
    if (!text.trim()) return;
    setTodos((p) => [...p, { id: uid(), text: text.trim(), done: false, priority, due, created: Date.now() }]);
    setText("");
  };
  const patch = (id: string, change: Partial<Todo>) => setTodos((p) => p.map((t) => (t.id === id ? { ...t, ...change } : t)));

  const shown = todos
    .filter((t) => (filter === "all" ? true : filter === "active" ? !t.done : t.done))
    .sort((a, b) => Number(a.done) - Number(b.done) || PRIORITY[a.priority].rank - PRIORITY[b.priority].rank || (a.due || "9999").localeCompare(b.due || "9999") || a.created - b.created);
  const doneCount = todos.filter((t) => t.done).length;
  const pct = todos.length ? Math.round((doneCount / todos.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a task and press Enter…" maxLength={140} aria-label="New task" className="h-11 min-w-48 flex-1 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <Button size="lg" onClick={add} disabled={!text.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-1" role="group" aria-label="Priority">
            <Flag className="h-4 w-4 text-muted-foreground" />
            {(Object.keys(PRIORITY) as Priority[]).map((p) => (
              <button key={p} onClick={() => setPriority(p)} aria-pressed={priority === p} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", priority === p ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
                <span className={cn("h-2 w-2 rounded-full", PRIORITY[p].dot)} /> {PRIORITY[p].label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlarmClock className="h-4 w-4" /> Due
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground" />
          </label>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-muted p-1" role="tablist">
          {(["all", "active", "done"] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1 text-sm font-medium capitalize", filter === f ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {f === "done" ? "Completed" : f}
            </button>
          ))}
        </div>
        <div className="flex min-w-40 flex-1 items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{doneCount}/{todos.length} done</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setTodos((p) => p.filter((t) => !t.done))} disabled={doneCount === 0}>
          <Trash2 className="h-3.5 w-3.5" /> Clear completed
        </Button>
      </div>

      <Card className="divide-y divide-border overflow-hidden">
        {shown.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">{todos.length === 0 ? "Nothing to do yet — add your first task above." : "No tasks in this view."}</p>}
        {shown.map((t) => {
          const overdue = !t.done && t.due && t.due < today;
          return (
            <div key={t.id} className="group flex items-center gap-3 p-3">
              <button onClick={() => patch(t.id, { done: !t.done })} aria-pressed={t.done} aria-label={t.done ? "Mark as not done" : "Mark as done"} className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors", t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 hover:border-primary")}>
                {t.done && <Check className="h-3.5 w-3.5" />}
              </button>
              <span className={cn("h-2 w-2 shrink-0 rounded-full", PRIORITY[t.priority].dot)} title={`${PRIORITY[t.priority].label} priority`} />
              {editing === t.id ? (
                <input autoFocus defaultValue={t.text} onBlur={(e) => { if (e.target.value.trim()) patch(t.id, { text: e.target.value.trim() }); setEditing(null); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }} className="h-8 min-w-0 flex-1 rounded-lg border border-primary bg-background px-2 text-sm focus:outline-none" />
              ) : (
                <button onDoubleClick={() => setEditing(t.id)} onClick={() => setEditing(t.id)} title="Click to edit" className={cn("min-w-0 flex-1 truncate text-left text-sm", t.done && "text-muted-foreground line-through")}>
                  {t.text}
                </button>
              )}
              {t.due && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", overdue ? "bg-rose-500/10 text-rose-600" : t.due === today ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground")}>{t.due === today ? "Today" : overdue ? `Overdue · ${t.due}` : t.due}</span>}
              <button onClick={() => setTodos((p) => p.filter((x) => x.id !== t.id))} aria-label="Delete task" className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </Card>
      <p className="text-xs text-muted-foreground">Saved automatically in this browser. Click a task to rename it.</p>
    </div>
  );
}

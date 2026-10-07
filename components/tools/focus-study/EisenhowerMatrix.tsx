"use client";

import * as React from "react";
import { Check, Clock, Copy, Plus, Trash2, UserRound, X, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";

type Quadrant = "do" | "plan" | "delegate" | "drop";

interface Task {
  id: string;
  text: string;
  q: Quadrant;
  done: boolean;
}

const QUADRANTS: { id: Quadrant; title: string; sub: string; icon: React.ReactNode; tone: string; chip: string }[] = [
  { id: "do", title: "Do first", sub: "Urgent · Important", icon: <Zap className="h-4 w-4" />, tone: "border-rose-500/40 bg-rose-500/5", chip: "bg-rose-500 text-white" },
  { id: "plan", title: "Schedule", sub: "Not urgent · Important", icon: <Clock className="h-4 w-4" />, tone: "border-emerald-500/40 bg-emerald-500/5", chip: "bg-emerald-500 text-white" },
  { id: "delegate", title: "Delegate", sub: "Urgent · Not important", icon: <UserRound className="h-4 w-4" />, tone: "border-amber-500/40 bg-amber-500/5", chip: "bg-amber-500 text-white" },
  { id: "drop", title: "Eliminate", sub: "Not urgent · Not important", icon: <X className="h-4 w-4" />, tone: "border-slate-500/40 bg-slate-500/5", chip: "bg-slate-500 text-white" },
];

const uid = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function EisenhowerMatrix() {
  useTrackTool("eisenhower-matrix");
  const [tasks, setTasks] = usePersisted<Task[]>("everyutili_eisenhower", []);
  const [drafts, setDrafts] = React.useState<Record<Quadrant, string>>({ do: "", plan: "", delegate: "", drop: "" });
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<Quadrant | null>(null);
  const [copied, setCopied] = React.useState(false);

  const add = (q: Quadrant) => {
    const text = drafts[q].trim();
    if (!text) return;
    setTasks((prev) => [...prev, { id: uid(), text, q, done: false }]);
    setDrafts((d) => ({ ...d, [q]: "" }));
  };
  const move = (id: string, q: Quadrant) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, q } : t)));
  const toggle = (id: string) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const remove = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const open = tasks.filter((t) => !t.done).length;
  const doneCount = tasks.length - open;

  const exportText = () =>
    QUADRANTS.map((q) => `${q.title} (${q.sub})\n${tasks.filter((t) => t.q === q.id).map((t) => `  [${t.done ? "x" : " "}] ${t.text}`).join("\n") || "  —"}`).join("\n\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{open}</span> open · <span className="font-semibold text-foreground">{doneCount}</span> done. Drag tasks between boxes.
        </p>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void copy()} disabled={tasks.length === 0}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy as text"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTasks((p) => p.filter((t) => !t.done))} disabled={doneCount === 0}>
            <Trash2 className="h-3.5 w-3.5" /> Clear done
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {QUADRANTS.map((q) => {
          const list = tasks.filter((t) => t.q === q.id);
          return (
            <Card
              key={q.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(q.id);
              }}
              onDragLeave={() => setOver((o) => (o === q.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, q.id);
                setDragId(null);
                setOver(null);
              }}
              className={cn("flex min-h-64 flex-col gap-3 border-2 p-4 transition-all", q.tone, over === q.id && "scale-[1.01] ring-4 ring-primary/20")}
            >
              <div className="flex items-center gap-2">
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", q.chip)}>{q.icon}</span>
                <div>
                  <h3 className="font-bold leading-tight">{q.title}</h3>
                  <p className="text-xs text-muted-foreground">{q.sub}</p>
                </div>
                <span className="ml-auto rounded-full bg-background/70 px-2 py-0.5 text-xs font-semibold tabular-nums">{list.length}</span>
              </div>

              <ul className="flex-1 space-y-1.5">
                {list.map((t) => (
                  <li
                    key={t.id}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                    className={cn("group flex cursor-grab items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-sm shadow-sm active:cursor-grabbing", dragId === t.id && "opacity-40")}
                  >
                    <button onClick={() => toggle(t.id)} aria-label={t.done ? "Mark as not done" : "Mark as done"} aria-pressed={t.done} className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors", t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 hover:border-primary")}>
                      {t.done && <Check className="h-3 w-3" />}
                    </button>
                    <span className={cn("min-w-0 flex-1 break-words", t.done && "text-muted-foreground line-through")}>{t.text}</span>
                    <select value={t.q} onChange={(e) => move(t.id, e.target.value as Quadrant)} aria-label="Move to" className="h-7 w-7 shrink-0 cursor-pointer appearance-none rounded-md border border-border bg-muted/50 text-center text-xs text-muted-foreground opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100">
                      {QUADRANTS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.title}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => remove(t.id)} aria-label="Delete task" className="shrink-0 rounded-md p-1 text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
                {list.length === 0 && <li className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">Drop a task here</li>}
              </ul>

              <div className="flex gap-2">
                <input value={drafts[q.id]} onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && add(q.id)} placeholder="Add a task…" maxLength={120} aria-label={`Add a task to ${q.title}`} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <Button size="sm" onClick={() => add(q.id)} disabled={!drafts[q.id].trim()} aria-label={`Add to ${q.title}`}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Saved only in this browser. Hover a task to move it with the small menu on touch screens.</p>
    </div>
  );
}

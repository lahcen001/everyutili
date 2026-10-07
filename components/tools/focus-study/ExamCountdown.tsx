"use client";

import * as React from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { breakdown, urgency } from "@/lib/focus/countdown";

interface EventItem {
  id: string;
  name: string;
  /** epoch ms */
  at: number;
}

const TONE = {
  soon: "border-rose-500/50 bg-gradient-to-br from-rose-500/10 to-transparent",
  near: "border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-transparent",
  far: "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-transparent",
  past: "border-border bg-muted/30 opacity-70",
} as const;
const BADGE = { soon: "bg-rose-500 text-white", near: "bg-amber-500 text-white", far: "bg-emerald-500 text-white", past: "bg-muted text-muted-foreground" } as const;

const uid = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Local "YYYY-MM-DDTHH:mm" for a <input type="datetime-local">. */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ExamCountdown() {
  useTrackTool("exam-countdown");
  const [events, setEvents] = usePersisted<EventItem[]>("everyutili_countdowns", []);
  const [name, setName] = React.useState("");
  const [when, setWhen] = React.useState(() => toLocalInput(Date.now() + 14 * 86400000));
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const add = () => {
    const at = new Date(when).getTime();
    if (!name.trim() || Number.isNaN(at)) return;
    setEvents((prev) => [...prev, { id: uid(), name: name.trim(), at }]);
    setName("");
  };

  const sorted = [...events].sort((a, b) => a.at - b.at);
  const upcoming = sorted.filter((e) => e.at >= now);
  const past = sorted.filter((e) => e.at < now).reverse();

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" /> Add an exam or deadline
        </h3>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="e.g. Chemistry final" maxLength={80} aria-label="Name" className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Date and time" className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <Button onClick={add} disabled={!name.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[
            ["Tomorrow", 1],
            ["In a week", 7],
            ["In a month", 30],
            ["In 100 days", 100],
          ].map(([label, days]) => (
            <button key={label as string} onClick={() => setWhen(toLocalInput(Date.now() + (days as number) * 86400000))} className="rounded-full border border-border px-2.5 py-1 font-medium hover:border-primary hover:text-primary">
              {label as string}
            </button>
          ))}
        </div>
      </Card>

      {events.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center text-sm text-muted-foreground">Nothing counting down yet. Add your next exam, deadline or trip above.</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {upcoming.map((e, i) => (
          <CountCard key={e.id} event={e} now={now} first={i === 0} onDelete={() => setEvents((p) => p.filter((x) => x.id !== e.id))} />
        ))}
      </div>

      {past.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Past ({past.length})</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {past.map((e) => (
              <CountCard key={e.id} event={e} now={now} onDelete={() => setEvents((p) => p.filter((x) => x.id !== e.id))} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function CountCard({ event, now, first, onDelete }: { event: EventItem; now: number; first?: boolean; onDelete: () => void }) {
  const b = breakdown(event.at, now);
  const u = urgency(event.at, now);
  const parts: [number, string][] = [
    [b.days, "days"],
    [b.hours, "hours"],
    [b.minutes, "min"],
    [b.seconds, "sec"],
  ];
  return (
    <Card className={cn("space-y-3 border-2 p-4", TONE[u], first && "md:col-span-2")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className={cn("truncate font-bold", first ? "text-xl" : "text-lg")}>{event.name}</h3>
          <p className="text-xs text-muted-foreground">{new Date(event.at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", BADGE[u])}>{u === "past" ? `${Math.abs(b.totalDays)}d ago` : b.totalDays === 1 ? "Tomorrow" : `${b.totalDays} days`}</span>
        <button onClick={onDelete} aria-label={`Delete ${event.name}`} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {u !== "past" ? (
        <div className="grid grid-cols-4 gap-2 text-center" role="timer">
          {parts.map(([n, label]) => (
            <div key={label} className="rounded-xl bg-background/80 py-2 shadow-sm">
              <p className={cn("font-mono font-extrabold tabular-nums", first ? "text-3xl sm:text-4xl" : "text-2xl")}>{String(n).padStart(2, "0")}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This date has passed.</p>
      )}
    </Card>
  );
}

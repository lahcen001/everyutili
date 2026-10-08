"use client";

import * as React from "react";
import { Check, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { playChime } from "@/lib/focus/chime";
import { dayKey, formatClock } from "@/lib/focus/pomodoro";
import { ROUTINES, routineSeconds, type Routine } from "@/lib/focus/stretches";

export default function StretchBreak() {
  useTrackTool("stretch-break");
  const [log, setLog] = usePersisted<Record<string, number>>("everyutili_stretch_log", {});
  const [sound, setSound] = React.useState(true);
  const [routine, setRoutine] = React.useState<Routine | null>(null);

  const finish = () => {
    setLog((l) => ({ ...l, [dayKey()]: (l[dayKey()] ?? 0) + 1 }));
    if (sound) playChime();
  };
  const today = log[dayKey()] ?? 0;

  if (routine) return <Player routine={routine} sound={sound} onFinish={finish} onExit={() => setRoutine(null)} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-sky-500/10 p-4">
        <span className="text-4xl" aria-hidden>
          🧘
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Time to move!</p>
          <p className="text-sm text-muted-foreground">Pick a routine. Each step tells you what to do and times it for you.</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-extrabold tabular-nums text-emerald-600">{today}</p>
          <p className="text-xs text-muted-foreground">breaks today</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setSound((s) => !s)} aria-pressed={sound}>
          {sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} Chime
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {ROUTINES.map((r) => (
          <button key={r.id} onClick={() => setRoutine(r)} className="group text-left">
            <Card className="h-full space-y-3 p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-primary group-hover:shadow-lg group-hover:shadow-primary/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{r.name}</h3>
                  <p className="text-sm text-muted-foreground">{r.blurb}</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{formatClock(routineSeconds(r))}</span>
              </div>
              <div className="flex gap-1 text-xl" aria-hidden>
                {r.steps.slice(0, 7).map((s, i) => (
                  <span key={i}>{s.icon}</span>
                ))}
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                <Play className="h-4 w-4 fill-current" /> Start · {r.steps.length} steps
              </span>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

function Player({ routine, sound, onFinish, onExit }: { routine: Routine; sound: boolean; onFinish: () => void; onExit: () => void }) {
  const [index, setIndex] = React.useState(0);
  const [left, setLeft] = React.useState(routine.steps[0].seconds);
  const [running, setRunning] = React.useState(true);
  const [done, setDone] = React.useState(false);
  const endAt = React.useRef(0);
  const step = routine.steps[index];

  const go = React.useCallback(
    (i: number) => {
      if (i >= routine.steps.length) {
        setDone(true);
        setRunning(false);
        onFinish();
        return;
      }
      const next = Math.max(0, i);
      setIndex(next);
      setLeft(routine.steps[next].seconds);
      endAt.current = Date.now() + routine.steps[next].seconds * 1000;
      if (sound && i > 0) playChime();
    },
    [routine, sound, onFinish]
  );

  React.useEffect(() => {
    if (!running) return;
    if (endAt.current === 0) endAt.current = Date.now() + left * 1000;
    const id = window.setInterval(() => {
      const remaining = (endAt.current - Date.now()) / 1000;
      if (remaining <= 0) go(index + 1);
      else setLeft(remaining);
    }, 200);
    return () => window.clearInterval(id);
  }, [running, index, go, left]);

  const toggle = () => {
    if (running) setRunning(false);
    else {
      endAt.current = Date.now() + left * 1000;
      setRunning(true);
    }
  };

  const R = 90;
  const C = 2 * Math.PI * R;

  return (
    <FullscreenStage className="rounded-2xl border border-border bg-gradient-to-br from-emerald-500/5 via-background to-sky-500/5 p-4 sm:p-8">
      {(isFs) => (
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 py-6 text-center">
          <div className="flex w-full items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onExit}>
              <ChevronLeft className="h-4 w-4" /> {routine.name}
            </Button>
          </div>
          {done ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <span className="text-7xl">🎉</span>
              <p className="text-2xl font-extrabold">Nice work — you&apos;re loosened up!</p>
              <p className="text-muted-foreground">Drink some water, then back to it.</p>
              <div className="flex gap-2">
                <Button onClick={onExit}>Choose another routine</Button>
                <Button variant="outline" onClick={() => { setDone(false); setRunning(true); go(0); }}>
                  <RotateCcw className="h-4 w-4" /> Repeat
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-1.5" aria-label={`Step ${index + 1} of ${routine.steps.length}`}>
                {routine.steps.map((_, i) => (
                  <span key={i} className={cn("h-2 rounded-full transition-all", i === index ? "w-8 bg-primary" : i < index ? "w-2 bg-primary/60" : "w-2 bg-muted")} />
                ))}
              </div>
              <div className="relative" style={{ width: isFs ? 320 : 220, height: isFs ? 320 : 220 }}>
                <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                  <circle cx="100" cy="100" r={R} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                  <circle cx="100" cy="100" r={R} fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - left / step.seconds)} style={{ transition: "stroke-dashoffset .25s linear" }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn("transition-transform", isFs ? "text-7xl" : "text-5xl")} aria-hidden>
                    {step.icon}
                  </span>
                  <span className="mt-1 font-mono text-3xl font-black tabular-nums">{Math.ceil(left)}</span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-extrabold">{step.title}</h3>
                <p className="mx-auto max-w-md text-muted-foreground">{step.how}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous step">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="lg" onClick={toggle} className="min-w-36 rounded-full">
                  {running ? <><Pause className="h-5 w-5" /> Pause</> : <><Play className="h-5 w-5" /> Resume</>}
                </Button>
                <Button variant="outline" size="icon" onClick={() => go(index + 1)} aria-label={index === routine.steps.length - 1 ? "Finish" : "Next step"}>
                  {index === routine.steps.length - 1 ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </FullscreenStage>
  );
}

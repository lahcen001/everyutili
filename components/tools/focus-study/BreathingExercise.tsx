"use client";

import * as React from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { playChime } from "@/lib/focus/chime";
import { PATTERNS, PHASE_LABEL, cycleSeconds, phaseAt } from "@/lib/focus/breathing";
import { formatClock } from "@/lib/focus/pomodoro";

const DURATIONS = [1, 3, 5, 10];

const PHASE_COLOR = { inhale: "from-sky-400 to-cyan-500", hold: "from-violet-400 to-fuchsia-500", exhale: "from-emerald-400 to-teal-500", rest: "from-slate-300 to-slate-400" } as const;

export default function BreathingExercise() {
  useTrackTool("breathing-exercise");
  const [patternId, setPatternId] = React.useState(PATTERNS[0].id);
  const [minutes, setMinutes] = React.useState(3);
  const [running, setRunning] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [finished, setFinished] = React.useState(false);
  const startedAt = React.useRef(0);
  const pattern = PATTERNS.find((p) => p.id === patternId)!;
  const total = minutes * 60;

  React.useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const t = (Date.now() - startedAt.current) / 1000;
      if (t >= total) {
        setElapsed(total);
        setRunning(false);
        setFinished(true);
        playChime();
      } else setElapsed(t);
    }, 50);
    return () => window.clearInterval(id);
  }, [running, total]);

  const start = () => {
    startedAt.current = Date.now() - elapsed * 1000;
    setFinished(false);
    setRunning(true);
  };
  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setFinished(false);
  };
  const choose = (id: string) => {
    setPatternId(id);
    reset();
  };

  const now = phaseAt(elapsed, pattern);
  const idle = !running && elapsed === 0;
  const size = idle || finished ? 0.35 : 0.35 + now.size * 0.65;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <FullscreenStage className="overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-sky-500/5 via-background to-emerald-500/5 p-6">
        {(isFs) => {
          const box = isFs ? "min(60vh, 70vw)" : "min(22rem, 80vw)";
          return (
            <div className="flex flex-col items-center gap-6 py-6">
              <div className="relative flex items-center justify-center" style={{ width: box, height: box }}>
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-muted-foreground/20" />
                <div
                  className={cn("flex items-center justify-center rounded-full bg-gradient-to-br shadow-2xl transition-[width,height] ease-linear", PHASE_COLOR[idle ? "rest" : now.phase])}
                  style={{ width: `${size * 100}%`, height: `${size * 100}%`, transitionDuration: "60ms", boxShadow: "0 0 80px rgba(56,189,248,0.35)" }}
                >
                  <div className="text-center text-white drop-shadow">
                    <p className={cn("font-extrabold", isFs ? "text-4xl" : "text-2xl")}>{finished ? "Well done" : idle ? "Ready" : PHASE_LABEL[now.phase]}</p>
                    {!idle && !finished && <p className="font-mono text-3xl font-black tabular-nums">{Math.ceil(now.remaining)}</p>}
                  </div>
                </div>
              </div>
              <div className="text-center text-sm text-muted-foreground" aria-live="off">
                {finished ? `${Math.floor(total / cycleSeconds(pattern))} cycles · ${minutes} min` : running || elapsed > 0 ? `Cycle ${now.cycle + 1} · ${formatClock(total - elapsed)} left` : `${pattern.name} · ${minutes} min`}
              </div>
              <div className="flex gap-3">
                <Button size="lg" className="min-w-40 rounded-full" onClick={() => (running ? setRunning(false) : start())}>
                  {running ? <><Pause className="h-5 w-5" /> Pause</> : <><Play className="h-5 w-5" /> {elapsed > 0 && !finished ? "Resume" : "Start"}</>}
                </Button>
                <Button size="lg" variant="outline" onClick={reset} disabled={idle && !finished} aria-label="Reset">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        }}
      </FullscreenStage>

      <div className="space-y-4">
        <Card className="space-y-2 p-4">
          <h3 className="text-sm font-semibold">Breathing pattern</h3>
          {PATTERNS.map((p) => (
            <button key={p.id} onClick={() => choose(p.id)} aria-pressed={patternId === p.id} className={cn("w-full rounded-xl border-2 px-3 py-2.5 text-left transition-colors", patternId === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
              <span className="block font-semibold">{p.name}</span>
              <span className="block text-xs text-muted-foreground">{p.hint}</span>
            </button>
          ))}
        </Card>
        <Card className="space-y-2 p-4">
          <h3 className="text-sm font-semibold">Session length</h3>
          <div className="grid grid-cols-4 gap-1.5">
            {DURATIONS.map((m) => (
              <button key={m} onClick={() => { setMinutes(m); reset(); }} aria-pressed={minutes === m} className={cn("rounded-lg border px-2 py-2 text-sm font-semibold", minutes === m ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                {m} min
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Follow the circle: it grows as you breathe in and shrinks as you breathe out. Breathe through your nose if you can, and let your shoulders drop.</p>
        </Card>
      </div>
    </div>
  );
}

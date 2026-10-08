"use client";

import * as React from "react";
import { Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";

type State = "idle" | "waiting" | "go" | "early" | "done";
const ROUNDS = 5;

function rating(ms: number): string {
  if (ms < 200) return "Lightning fast ⚡";
  if (ms < 250) return "Excellent";
  if (ms < 320) return "Good — about average";
  if (ms < 450) return "A little slow — you may be tired";
  return "Time for a proper rest 😴";
}

export default function ReactionTime() {
  useTrackTool("reaction-time-test");
  const [state, setState] = React.useState<State>("idle");
  const [times, setTimes] = React.useState<number[]>([]);
  const [best, setBest] = usePersisted<{ ms: number | null }>("everyutili_reaction_best", { ms: null });
  const startAt = React.useRef(0);
  const timer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const arm = () => {
    setState("waiting");
    timer.current = window.setTimeout(() => {
      startAt.current = performance.now();
      setState("go");
    }, 1200 + Math.random() * 2800);
  };

  const press = () => {
    if (state === "idle" || state === "early") {
      arm();
    } else if (state === "waiting") {
      if (timer.current) window.clearTimeout(timer.current);
      setState("early");
    } else if (state === "go") {
      const ms = Math.round(performance.now() - startAt.current);
      const next = [...times, ms];
      setTimes(next);
      if (next.length >= ROUNDS) {
        const avg = Math.round(next.reduce((a, b) => a + b, 0) / next.length);
        setBest((b) => (b.ms === null || avg < b.ms ? { ms: avg } : b));
        setState("done");
      } else setState("idle");
    } else if (state === "done") {
      setTimes([]);
      setState("idle");
    }
  };

  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const last = times[times.length - 1];

  const view = {
    idle: { bg: "bg-primary", title: times.length ? `${last} ms` : "Reaction time test", sub: times.length ? `Round ${times.length} of ${ROUNDS} done — click to continue` : `Click to start. When the screen turns green, click as fast as you can. ${ROUNDS} rounds.` },
    waiting: { bg: "bg-rose-500", title: "Wait for green…", sub: "Don't click yet!" },
    go: { bg: "bg-emerald-500", title: "CLICK!", sub: "" },
    early: { bg: "bg-amber-500", title: "Too soon!", sub: "You clicked before it turned green. Click to try again." },
    done: { bg: "bg-primary", title: `${avg} ms average`, sub: `${rating(avg ?? 0)} — click to play again` },
  }[state];

  return (
    <div className="space-y-4">
      <FullscreenStage className="overflow-hidden rounded-2xl">
        {(isFs) => (
          <button onPointerDown={(e) => { e.preventDefault(); press(); }} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); press(); } }} className={cn("flex w-full select-none flex-col items-center justify-center gap-3 px-6 text-center text-white transition-colors duration-150", view.bg, isFs ? "h-screen" : "h-[22rem] sm:h-[26rem]")} aria-live="polite">
            <Zap className="h-12 w-12 opacity-90" />
            <span className="text-4xl font-black sm:text-6xl">{view.title}</span>
            {view.sub && <span className="max-w-md text-base text-white/85 sm:text-lg">{view.sub}</span>}
          </button>
        )}
      </FullscreenStage>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">This run</p>
          <p className="mt-1 flex flex-wrap justify-center gap-1.5">
            {Array.from({ length: ROUNDS }, (_, i) => (
              <span key={i} className={cn("rounded-md px-2 py-0.5 text-sm font-bold tabular-nums", times[i] ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{times[i] ?? "–"}</span>
            ))}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Average</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{avg ? `${avg} ms` : "–"}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Best average</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-600">{best.ms ? `${best.ms} ms` : "–"}</p>
          {best.ms && <Button size="sm" variant="ghost" onClick={() => setBest({ ms: null })}>Reset</Button>}
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">Most people react in 200–300 ms. Results depend on your screen and mouse, so use it to compare yourself over time rather than with others.</p>
    </div>
  );
}

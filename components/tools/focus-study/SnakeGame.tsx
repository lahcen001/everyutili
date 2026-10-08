"use client";

import * as React from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { initialState, step, type Dir, type SnakeState } from "@/lib/focus/snake";

const SPEEDS = [
  { id: "chill", label: "Chill", ms: 160 },
  { id: "normal", label: "Normal", ms: 110 },
  { id: "fast", label: "Fast", ms: 75 },
] as const;

export default function SnakeGame() {
  useTrackTool("snake-game");
  const [state, setState] = React.useState<SnakeState>(() => initialState());
  const [speed, setSpeed] = React.useState<(typeof SPEEDS)[number]["id"]>("normal");
  const [running, setRunning] = React.useState(false);
  const [best, setBest] = usePersisted<{ score: number }>("everyutili_snake_best", { score: 0 });
  const dir = React.useRef<Dir>("right");
  const touch = React.useRef<{ x: number; y: number } | null>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const ms = SPEEDS.find((s) => s.id === speed)!.ms;

  const restart = () => {
    dir.current = "right";
    setState(initialState());
    setRunning(true);
  };

  React.useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setState((s) => {
        const n = step(s, dir.current);
        if (n.over) setRunning(false);
        return n;
      });
    }, ms);
    return () => window.clearInterval(id);
  }, [running, ms]);

  React.useEffect(() => {
    if (state.over && state.score > best.score) setBest({ score: state.score });
  }, [state.over, state.score, best.score, setBest]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
      if (e.key === " ") {
        e.preventDefault();
        if (!state.over) setRunning((r) => !r);
        return;
      }
      const d = map[e.key];
      if (!d || (e.target as HTMLElement).tagName === "INPUT") return;
      e.preventDefault();
      dir.current = d;
      if (!state.over) setRunning(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.over]);

  React.useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const cell = c.width / state.size;
    const dark = document.documentElement.classList.contains("dark");
    ctx.fillStyle = dark ? "#0f172a" : "#ecfdf5";
    ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < state.size; y++) for (let x = 0; x < state.size; x++) if ((x + y) % 2 === 0) {
      ctx.fillStyle = dark ? "#111c33" : "#d1fae5";
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc((state.food.x + 0.5) * cell, (state.food.y + 0.5) * cell, cell * 0.38, 0, Math.PI * 2);
    ctx.fill();
    state.snake.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? "#047857" : i % 2 ? "#10b981" : "#34d399";
      const r = cell * 0.18;
      ctx.beginPath();
      ctx.roundRect(p.x * cell + 1, p.y * cell + 1, cell - 2, cell - 2, r);
      ctx.fill();
    });
  }, [state]);

  const swipe = (dx: number, dy: number) => {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    dir.current = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    if (!state.over) setRunning(true);
  };

  return (
    <FullscreenStage className="rounded-2xl border border-border bg-gradient-to-br from-emerald-500/5 via-background to-sky-500/5 p-4 sm:p-6" label="Fullscreen">
      {(isFs) => (
        <div className="mx-auto flex w-full flex-col gap-4 py-4" style={{ maxWidth: isFs ? "min(80vh, 90vw)" : 30 * 16 }}>
          <div className="flex flex-wrap items-center gap-2 pe-28">
            <span className="rounded-xl bg-muted px-4 py-1.5 text-sm">Score <b className="text-lg tabular-nums">{state.score}</b></span>
            <span className="rounded-xl bg-muted px-4 py-1.5 text-sm">Best <b className="text-lg tabular-nums">{best.score}</b></span>
            <div className="flex rounded-full bg-muted p-1" role="tablist">
              {SPEEDS.map((s) => (
                <button key={s.id} role="tab" aria-selected={speed === s.id} onClick={() => setSpeed(s.id)} className={cn("rounded-full px-3 py-1 text-xs font-semibold", speed === s.id ? "bg-background shadow-sm" : "text-muted-foreground")}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div
            className="relative touch-none"
            onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
            onTouchEnd={(e) => {
              const t = touch.current;
              touch.current = null;
              if (t) swipe(e.changedTouches[0].clientX - t.x, e.changedTouches[0].clientY - t.y);
            }}
          >
            <canvas ref={canvas} width={640} height={640} className="aspect-square w-full rounded-2xl border border-border shadow-lg" aria-label="Snake game board" />
            {(!running || state.over) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/80 text-center backdrop-blur-sm">
                <p className="text-3xl font-black">{state.over ? "Game over" : state.score > 0 ? "Paused" : "Snake"}</p>
                {state.over && <p className="text-muted-foreground">You scored {state.score}</p>}
                <Button size="lg" onClick={() => (state.over || state.score === 0 ? restart() : setRunning(true))}>
                  {state.over ? <><RotateCcw className="h-4 w-4" /> Play again</> : <><Play className="h-4 w-4" /> {state.score > 0 ? "Resume" : "Start"}</>}
                </Button>
                <p className="px-6 text-xs text-muted-foreground">Arrow keys, WASD or swipe · Space pauses</p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRunning((r) => !r)} disabled={state.over}>
              {running ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}
            </Button>
            <Button variant="outline" size="sm" onClick={restart}><RotateCcw className="h-3.5 w-3.5" /> Restart</Button>
          </div>
        </div>
      )}
    </FullscreenStage>
  );
}

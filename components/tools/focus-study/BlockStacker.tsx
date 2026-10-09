"use client";

import * as React from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ChevronsDown, Pause, Play, RotateCcw, RotateCw, Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import {
  COLS, ROWS, SHAPES, createGame, dropInterval, ghostY, hardDrop, holdPiece, pieceCells, rotate, softDrop, tick, tryMove,
  type BlockState, type PieceType,
} from "@/lib/focus/blockStacker";

const COLORS = ["", "#06b6d4", "#eab308", "#a855f7", "#22c55e", "#ef4444", "#3b82f6", "#f97316"];
const TYPE_COLOR: Record<PieceType, string> = { I: COLORS[1], O: COLORS[2], T: COLORS[3], S: COLORS[4], Z: COLORS[5], J: COLORS[6], L: COLORS[7] };
const CELL = 30;

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  ctx.globalAlpha = 1;
}

function MiniPiece({ type, label }: { type: PieceType | null; label: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!type) return;
    const cells = SHAPES[type][0];
    const minX = Math.min(...cells.map(([x]) => x));
    const maxX = Math.max(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([, y]) => y));
    const maxY = Math.max(...cells.map(([, y]) => y));
    const s = 20;
    const ox = (c.width / s - (maxX - minX + 1)) / 2 - minX;
    const oy = (c.height / s - (maxY - minY + 1)) / 2 - minY;
    for (const [x, y] of cells) drawCell(ctx, x + ox, y + oy, s, TYPE_COLOR[type]);
  }, [type]);
  return <canvas ref={ref} width={80} height={60} role="img" aria-label={label} className="h-12 w-16 sm:h-14 sm:w-20" />;
}

function PadButton({
  label, children, onPress, repeat, className,
}: { label: string; children: React.ReactNode; onPress: () => void; repeat?: boolean; className?: string }) {
  const timer = React.useRef<number | null>(null);
  const stop = React.useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  React.useEffect(() => stop, [stop]);
  return (
    <button
      type="button"
      aria-label={label}
      className={cn("flex h-14 min-w-0 flex-1 touch-manipulation select-none items-center justify-center rounded-xl border border-border bg-muted text-foreground active:bg-primary active:text-primary-foreground", className)}
      onPointerDown={(e) => {
        e.preventDefault();
        stop();
        onPress();
        if (repeat) {
          timer.current = window.setTimeout(() => {
            timer.current = window.setInterval(onPress, 70);
          }, 220);
        }
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export default function BlockStacker() {
  useTrackTool("block-stacker");
  const [state, setState] = React.useState<BlockState>(() => createGame());
  const ref = React.useRef<BlockState>(state);
  const [running, setRunning] = React.useState(false);
  const [best, setBest] = usePersisted<{ score: number }>("everyutili_blockStacker_best", { score: 0 });
  const canvas = React.useRef<HTMLCanvasElement>(null);

  const act = React.useCallback((fn: (s: BlockState) => BlockState) => {
    const n = fn(ref.current);
    if (n !== ref.current) {
      ref.current = n;
      setState(n);
      if (n.over) setRunning(false);
    }
  }, []);

  const restart = () => {
    const n = createGame();
    ref.current = n;
    setState(n);
    setRunning(true);
  };

  // Gravity: one timer that restarts only when the level or running state changes.
  const interval = dropInterval(state.level);
  React.useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => act((s) => tick(s)), interval);
    return () => window.clearInterval(id);
  }, [running, interval, act]);

  React.useEffect(() => {
    if (state.over && state.score > best.score) setBest({ score: state.score });
  }, [state.over, state.score, best.score, setBest]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "p") {
        e.preventDefault();
        if (!ref.current.over) setRunning((r) => !r);
        return;
      }
      const keys = ["arrowleft", "arrowright", "arrowdown", "arrowup", "z", "x", " ", "c"];
      if (!keys.includes(k)) return;
      if (k === " " && t.tagName === "BUTTON") return; // let Space activate focused buttons
      e.preventDefault();
      if (!running) return;
      if (k === "arrowleft") act((s) => tryMove(s, -1, 0));
      else if (k === "arrowright") act((s) => tryMove(s, 1, 0));
      else if (k === "arrowdown") act((s) => softDrop(s));
      else if (k === "arrowup" || k === "x") act((s) => rotate(s, 1));
      else if (k === "z") act((s) => rotate(s, -1));
      else if (k === " ") act((s) => hardDrop(s));
      else if (k === "c") act((s) => holdPiece(s));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, act]);

  React.useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dark = document.documentElement.classList.contains("dark");
    ctx.fillStyle = dark ? "#0f172a" : "#f1f5f9";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = dark ? "#1e293b" : "#e2e8f0";
    for (let x = 1; x < COLS; x++) ctx.fillRect(x * CELL, 0, 1, c.height);
    for (let y = 1; y < ROWS; y++) ctx.fillRect(0, y * CELL, c.width, 1);
    state.board.forEach((row, y) => row.forEach((v, x) => v && drawCell(ctx, x, y, CELL, COLORS[v])));
    if (!state.over) {
      const gy = ghostY(state);
      const color = TYPE_COLOR[state.piece.type];
      for (const [x, y] of pieceCells({ ...state.piece, y: gy })) if (y >= 0) drawCell(ctx, x, y, CELL, color, 0.28);
      for (const [x, y] of pieceCells(state.piece)) if (y >= 0) drawCell(ctx, x, y, CELL, color);
    }
  }, [state]);

  const started = state.score > 0 || state.lines > 0 || running || state.board.some((r) => r.some(Boolean));

  return (
    <FullscreenStage className="rounded-2xl border border-border bg-gradient-to-br from-violet-500/5 via-background to-cyan-500/5 p-4 sm:p-6">
      {(isFs) => (
        <div className="mx-auto flex w-full flex-col gap-3 py-4" style={{ maxWidth: isFs ? "min(60vh, 92vw)" : 26 * 16 }}>
          <div className="flex flex-wrap items-center gap-2 pe-28 text-sm">
            <span className="rounded-xl bg-muted px-3 py-1.5">Score <b className="text-lg tabular-nums">{state.score}</b></span>
            <span className="rounded-xl bg-muted px-3 py-1.5">Best <b className="text-lg tabular-nums">{best.score}</b></span>
            <span className="rounded-xl bg-muted px-3 py-1.5">Level <b className="tabular-nums">{state.level}</b></span>
            <span className="rounded-xl bg-muted px-3 py-1.5">Lines <b className="tabular-nums">{state.lines}</b></span>
          </div>
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="relative min-w-0 flex-1">
              <canvas
                ref={canvas}
                width={COLS * CELL}
                height={ROWS * CELL}
                role="img"
                aria-label="Block Stacker board"
                className="w-full rounded-xl border border-border shadow-lg"
                style={{ aspectRatio: `${COLS} / ${ROWS}` }}
              />
              {(!running || state.over) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/80 text-center backdrop-blur-sm">
                  <p className="text-2xl font-black">{state.over ? "Game over" : started ? "Paused" : "Block Stacker"}</p>
                  {state.over && <p className="text-muted-foreground">You scored {state.score}</p>}
                  <Button size="lg" onClick={() => (state.over || !started ? restart() : setRunning(true))}>
                    {state.over ? <><RotateCcw className="h-4 w-4" /> Play again</> : <><Play className="h-4 w-4" /> {started ? "Resume" : "Start"}</>}
                  </Button>
                  <p className="px-4 text-xs text-muted-foreground">Arrows move, Up/X rotate, Z rotate back, Space drops, C holds, P pauses</p>
                </div>
              )}
            </div>
            <div className="flex w-16 shrink-0 flex-col items-center gap-3 sm:w-20">
              <div className="w-full text-center text-xs text-muted-foreground">Next<MiniPiece type={state.next} label={`Next piece ${state.next}`} /></div>
              <div className="w-full text-center text-xs text-muted-foreground">Hold<MiniPiece type={state.hold} label={state.hold ? `Held piece ${state.hold}` : "Hold slot empty"} /></div>
            </div>
          </div>
          <div className="flex gap-2">
            <PadButton label="Move left" repeat onPress={() => running && act((s) => tryMove(s, -1, 0))}><ArrowLeft className="h-6 w-6" /></PadButton>
            <PadButton label="Move right" repeat onPress={() => running && act((s) => tryMove(s, 1, 0))}><ArrowRight className="h-6 w-6" /></PadButton>
            <PadButton label="Soft drop" repeat onPress={() => running && act((s) => softDrop(s))}><ArrowDown className="h-6 w-6" /></PadButton>
          </div>
          <div className="flex gap-2">
            <PadButton label="Rotate" onPress={() => running && act((s) => rotate(s, 1))}><RotateCw className="h-6 w-6" /></PadButton>
            <PadButton label="Hard drop" onPress={() => running && act((s) => hardDrop(s))}><ChevronsDown className="h-6 w-6" /></PadButton>
            <PadButton label="Hold piece" onPress={() => running && act((s) => holdPiece(s))}><Archive className="h-6 w-6" /></PadButton>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRunning((r) => !r)} disabled={state.over}>
              {running ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> {started ? "Resume" : "Start"}</>}
            </Button>
            <Button variant="outline" size="sm" onClick={restart}><RotateCcw className="h-3.5 w-3.5" /> Restart</Button>
          </div>
        </div>
      )}
    </FullscreenStage>
  );
}

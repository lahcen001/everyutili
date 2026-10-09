"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import {
  SIZES,
  formatTime,
  isSolved,
  shuffled,
  slideTile,
  tileForDirection,
  updateBest,
  type Board,
  type BestRecord,
  type Direction,
} from "@/lib/focus/slidingPuzzle";

interface Stats {
  [size: string]: BestRecord | undefined;
}

export default function SlidingPuzzle() {
  useTrackTool("sliding-puzzle");
  const [size, setSize] = React.useState<number>(4);
  const [board, setBoard] = React.useState<Board>(() => shuffled(4));
  const [moves, setMoves] = React.useState(0);
  const [seconds, setSeconds] = React.useState(0);
  const [started, setStarted] = React.useState(false);
  const [stats, setStats] = usePersisted<Stats>("everyutili_slidingpuzzle_best", {});
  const [newBest, setNewBest] = React.useState(false);
  const won = started && isSolved(board);

  React.useEffect(() => {
    if (!started || won) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [started, won]);

  const reset = (n: number) => {
    setSize(n);
    setBoard(shuffled(n));
    setMoves(0);
    setSeconds(0);
    setStarted(false);
    setNewBest(false);
  };

  const apply = React.useCallback(
    (index: number) => {
      if (won) return;
      const r = slideTile(board, size, index);
      if (!r.moved) return;
      const total = moves + 1;
      setBoard(r.board);
      setMoves(total);
      setStarted(true);
      if (isSolved(r.board)) {
        const prev = stats[String(size)];
        const next = updateBest(prev, total, seconds);
        setNewBest(!prev || total < prev.moves || seconds < prev.time);
        setStats({ ...stats, [String(size)]: next });
      }
    },
    [board, size, moves, seconds, stats, setStats, won]
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
      const dir = map[e.key];
      const tag = (e.target as HTMLElement).tagName;
      if (!dir || tag === "INPUT" || tag === "SELECT") return;
      e.preventDefault();
      const idx = tileForDirection(board, size, dir);
      if (idx >= 0) apply(idx);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [board, size, apply]);

  const best = stats[String(size)];

  return (
    <FullscreenStage className="rounded-2xl border border-border bg-gradient-to-br from-sky-500/5 via-background to-indigo-500/5 p-4 sm:p-6">
      {(isFs) => (
        <div className="mx-auto flex w-full flex-col gap-4 py-4" style={{ maxWidth: isFs ? "min(80vh, 90vw)" : 28 * 16 }}>
          <div className="flex flex-wrap items-center gap-2 pe-28">
            <div className="rounded-xl bg-muted px-4 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Moves</p>
              <p className="text-xl font-extrabold tabular-nums">{moves}</p>
            </div>
            <div className="rounded-xl bg-muted px-4 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Time</p>
              <p className="text-xl font-extrabold tabular-nums">{formatTime(seconds)}</p>
            </div>
            <div className="rounded-xl bg-muted px-4 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Best</p>
              <p className="text-sm font-extrabold tabular-nums">{best ? `${best.moves} moves` : "-"}</p>
              <p className="text-[10px] tabular-nums text-muted-foreground">{best ? formatTime(best.time) : ""}</p>
            </div>
          </div>

          <div className="flex items-center gap-2" role="group" aria-label="Board size">
            {SIZES.map((n) => (
              <Button key={n} size="sm" variant={size === n ? "default" : "outline"} onClick={() => reset(n)} aria-pressed={size === n}>
                {n}x{n}
              </Button>
            ))}
          </div>

          <div className="relative select-none rounded-2xl bg-sky-900/10 p-2 sm:p-3">
            <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
              {board.map((v, i) =>
                v === 0 ? (
                  <div key="gap" className="aspect-square rounded-xl bg-muted/30" aria-hidden />
                ) : (
                  <button
                    key={v}
                    type="button"
                    onClick={() => apply(i)}
                    aria-label={`Tile ${v}`}
                    className={cn(
                      "flex aspect-square touch-manipulation items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 font-black text-white shadow-sm transition-transform active:scale-95",
                      size === 3 ? "text-3xl sm:text-4xl" : size === 4 ? "text-2xl sm:text-3xl" : "text-lg sm:text-2xl",
                      v === (i + 1) % board.length && "from-emerald-500 to-teal-600"
                    )}
                  >
                    {v}
                  </button>
                )
              )}
            </div>
            {won && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/85 text-center backdrop-blur-sm" role="status">
                <p className="text-3xl font-black">Solved! 🎉</p>
                <p className="text-muted-foreground">
                  {moves} moves in {formatTime(seconds)}
                  {newBest ? " - new best!" : ""}
                </p>
                <Button onClick={() => reset(size)}>Play again</Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => reset(size)}>
              <RotateCcw className="h-3.5 w-3.5" /> New game
            </Button>
            <p className="ms-auto text-xs text-muted-foreground">Tap a tile (or a row of tiles) to slide it into the gap. Arrow keys work too.</p>
          </div>
        </div>
      )}
    </FullscreenStage>
  );
}

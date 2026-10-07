"use client";

import * as React from "react";
import { RotateCcw, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { canMove, maxTile, move, newGame, spawn, type Direction, type Grid } from "@/lib/focus/game2048";

const TILE: Record<number, string> = {
  0: "bg-muted/60",
  2: "bg-amber-100 text-amber-900",
  4: "bg-amber-200 text-amber-900",
  8: "bg-orange-300 text-white",
  16: "bg-orange-400 text-white",
  32: "bg-orange-500 text-white",
  64: "bg-red-500 text-white",
  128: "bg-yellow-400 text-white",
  256: "bg-yellow-500 text-white",
  512: "bg-lime-500 text-white",
  1024: "bg-emerald-500 text-white",
  2048: "bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white",
};

interface Snapshot {
  grid: Grid;
  score: number;
}

export default function Game2048() {
  useTrackTool("game-2048");
  const [grid, setGrid] = React.useState<Grid>(() => newGame());
  const [score, setScore] = React.useState(0);
  const [prev, setPrev] = React.useState<Snapshot | null>(null);
  const [best, setBest] = usePersisted<{ score: number }>("everyutili_2048_best", { score: 0 });
  const touch = React.useRef<{ x: number; y: number } | null>(null);
  const over = !canMove(grid);
  const won = maxTile(grid) >= 2048;

  const play = React.useCallback(
    (dir: Direction) => {
      if (!canMove(grid)) return;
      const res = move(grid, dir);
      if (!res.moved) return;
      setPrev({ grid, score });
      const total = score + res.score;
      setGrid(spawn(res.grid));
      setScore(total);
      if (total > best.score) setBest({ score: total });
    },
    [grid, score, best.score, setBest]
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" };
      const dir = map[e.key];
      if (!dir || (e.target as HTMLElement).tagName === "INPUT") return;
      e.preventDefault();
      play(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play]);

  const restart = () => {
    setGrid(newGame());
    setScore(0);
    setPrev(null);
  };

  return (
    <FullscreenStage className="rounded-2xl border border-border bg-gradient-to-br from-amber-500/5 via-background to-fuchsia-500/5 p-4 sm:p-6" label="Fullscreen">
      {(isFs) => (
        <div className="mx-auto flex w-full flex-col gap-4 py-4" style={{ maxWidth: isFs ? "min(80vh, 90vw)" : 28 * 16 }}>
          <div className="flex items-center gap-2 pe-28">
            <div className="rounded-xl bg-muted px-4 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Score</p>
              <p className="text-xl font-extrabold tabular-nums">{score}</p>
            </div>
            <div className="rounded-xl bg-muted px-4 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Best</p>
              <p className="text-xl font-extrabold tabular-nums">{best.score}</p>
            </div>
          </div>
          <div
            className="relative touch-none select-none rounded-2xl bg-amber-900/10 p-2 sm:p-3"
            onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
            onTouchEnd={(e) => {
              const t = touch.current;
              touch.current = null;
              if (!t) return;
              const dx = e.changedTouches[0].clientX - t.x;
              const dy = e.changedTouches[0].clientY - t.y;
              if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
              play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
            }}
          >
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {grid.flat().map((v, i) => (
                <div key={i} className={cn("flex aspect-square items-center justify-center rounded-xl font-black shadow-sm transition-colors duration-100", TILE[v] ?? "bg-gradient-to-br from-fuchsia-600 to-violet-700 text-white", v >= 1024 ? "text-xl sm:text-2xl" : v >= 128 ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl")}>
                  {v || ""}
                </div>
              ))}
            </div>
            {(over || won) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/85 text-center backdrop-blur-sm">
                <p className="text-3xl font-black">{won && !over ? "You reached 2048! 🎉" : won ? "2048 — great game! 🎉" : "No more moves"}</p>
                <p className="text-muted-foreground">Score {score}</p>
                <Button onClick={restart}>Play again</Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { if (prev) { setGrid(prev.grid); setScore(prev.score); setPrev(null); } }} disabled={!prev}>
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </Button>
            <Button variant="outline" size="sm" onClick={restart}>
              <RotateCcw className="h-3.5 w-3.5" /> New game
            </Button>
            <p className="ms-auto text-xs text-muted-foreground">Arrow keys, WASD or swipe. Join equal tiles to reach 2048.</p>
          </div>
        </div>
      )}
    </FullscreenStage>
  );
}

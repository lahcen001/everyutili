"use client";

import * as React from "react";
import { Bomb, Flag, RotateCcw, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { LEVELS, chord, flagsLeft, newBoard, reveal, toggleFlag, type Board, type Cell, type LevelId } from "@/lib/focus/minesweeper";

const NUM: Record<number, string> = {
  1: "text-blue-600 dark:text-blue-400",
  2: "text-green-600 dark:text-green-400",
  3: "text-red-600 dark:text-red-400",
  4: "text-indigo-700 dark:text-indigo-300",
  5: "text-amber-700 dark:text-amber-400",
  6: "text-teal-600 dark:text-teal-400",
  7: "text-foreground",
  8: "text-muted-foreground",
};
const MAX_W: Record<LevelId, number> = { easy: 24 * 16, medium: 28 * 16, hard: 32 * 16 };
const LONG_PRESS_MS = 420;
const clock = (): number => Date.now();

function label(cell: Cell, r: number, c: number): string {
  const pos = `Row ${r + 1}, column ${c + 1}`;
  if (cell.state === "flag") return `${pos}, flagged`;
  if (cell.state === "hidden") return `${pos}, hidden`;
  if (cell.mine) return `${pos}, mine`;
  return `${pos}, ${cell.adjacent || "no"} adjacent mines`;
}

export default function Minesweeper() {
  useTrackTool("minesweeper");
  const [level, setLevel] = React.useState<LevelId>("easy");
  const [board, setBoard] = React.useState<Board>(() => newBoard(LEVELS.easy));
  const [seconds, setSeconds] = React.useState(0);
  const [flagMode, setFlagMode] = React.useState(false);
  const [best, setBest] = usePersisted<Record<LevelId, number>>("everyutili_minesweeper_best", { easy: 0, medium: 0, hard: 0 });
  const [newRecord, setNewRecord] = React.useState(false);
  const startedAt = React.useRef(0);
  const pressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = React.useRef(false);
  const pointerType = React.useRef("mouse");

  const playing = board.status === "playing";
  const over = board.status === "won" || board.status === "lost";

  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setSeconds(Math.min(999, Math.floor((clock() - startedAt.current) / 1000))), 250);
    return () => clearInterval(id);
  }, [playing]);

  const apply = (next: Board) => {
    if (board.status === "ready" && next.status !== "ready") {
      startedAt.current = clock();
      setSeconds(0);
    }
    if (next.status === "won" && board.status !== "won") {
      const t = Math.max(1, Math.min(999, Math.floor((clock() - startedAt.current) / 1000)));
      setSeconds(t);
      if (!best[level] || t < best[level]) {
        setBest((b) => ({ ...b, [level]: t }));
        setNewRecord(true);
      }
    }
    setBoard(next);
  };

  const start = (id: LevelId) => {
    setLevel(id);
    setBoard(newBoard(LEVELS[id]));
    setSeconds(0);
    setNewRecord(false);
    setFlagMode(false);
  };

  const tap = (i: number) => {
    if (over) return;
    const cell = board.cells[i];
    if (cell.state === "open") apply(chord(board, i));
    else if (flagMode) apply(toggleFlag(board, i));
    else apply(reveal(board, i));
  };

  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const cols = board.cols;
  const cellText = level === "hard" ? "text-[11px] sm:text-sm" : level === "medium" ? "text-xs sm:text-base" : "text-sm sm:text-lg";

  return (
    <FullscreenStage className="rounded-2xl border border-border bg-gradient-to-br from-slate-500/5 via-background to-red-500/5 p-4 sm:p-6">
      {(isFs) => (
        <div className="mx-auto flex w-full flex-col gap-3 py-4" style={{ maxWidth: isFs ? "min(80vh, 90vw)" : MAX_W[level] }}>
          <div className="flex flex-wrap items-center gap-1.5 pe-28">
            {(Object.keys(LEVELS) as LevelId[]).map((id) => (
              <Button key={id} size="sm" variant={level === id ? "default" : "outline"} onClick={() => start(id)} aria-pressed={level === id}>
                {LEVELS[id].label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2" aria-label={`${flagsLeft(board)} mines left`}>
              <Bomb className="h-4 w-4 text-red-500" />
              <span className="text-xl font-extrabold tabular-nums">{flagsLeft(board)}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2" aria-label={`${seconds} seconds`}>
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className="text-xl font-extrabold tabular-nums">{seconds}</span>
            </div>
            <div className="rounded-xl bg-muted px-3 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Best</p>
              <p className="text-sm font-extrabold tabular-nums">{best[level] ? `${best[level]}s` : "-"}</p>
            </div>
            <Button size="sm" variant={flagMode ? "default" : "outline"} className="ms-auto h-11 min-w-11" onClick={() => setFlagMode((f) => !f)} aria-pressed={flagMode} aria-label="Flag mode">
              <Flag className="h-4 w-4" /> <span className="hidden sm:inline">Flag mode</span>
            </Button>
          </div>
          <div className="relative select-none rounded-2xl bg-muted/50 p-1.5 sm:p-2">
            <div role="grid" aria-label="Minesweeper board" className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {board.cells.map((cell, i) => {
                const r = Math.floor(i / cols);
                const c = i % cols;
                const open = cell.state === "open";
                const boom = board.exploded === i;
                const wrongFlag = board.status === "lost" && cell.state === "flag" && !cell.mine;
                return (
                  <button
                    key={i}
                    type="button"
                    role="gridcell"
                    aria-label={label(cell, r, c)}
                    className={cn(
                      "flex aspect-square touch-manipulation items-center justify-center rounded-[4px] font-black leading-none transition-colors [-webkit-touch-callout:none]",
                      cellText,
                      open ? "bg-background" : "bg-slate-300 hover:bg-slate-200 active:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600",
                      boom && "bg-red-500 dark:bg-red-600",
                      wrongFlag && "bg-red-200 dark:bg-red-900",
                      over && "cursor-default"
                    )}
                    onPointerDown={(e) => {
                      pointerType.current = e.pointerType;
                      longPressed.current = false;
                      if (e.pointerType === "mouse" || over) return;
                      clearPress();
                      pressTimer.current = setTimeout(() => {
                        longPressed.current = true;
                        if (cell.state !== "open") apply(toggleFlag(board, i));
                        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(20);
                      }, LONG_PRESS_MS);
                    }}
                    onPointerUp={clearPress}
                    onPointerLeave={clearPress}
                    onPointerCancel={clearPress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (pointerType.current === "mouse") apply(toggleFlag(board, i));
                    }}
                    onClick={() => {
                      if (longPressed.current) {
                        longPressed.current = false;
                        return;
                      }
                      tap(i);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "f" || e.key === "F") {
                        e.preventDefault();
                        apply(toggleFlag(board, i));
                      }
                    }}
                  >
                    {cell.state === "flag" ? (
                      <Flag className={cn("h-[60%] w-[60%]", wrongFlag ? "text-red-700" : "text-red-500")} fill="currentColor" />
                    ) : open && cell.mine ? (
                      <Bomb className="h-[65%] w-[65%]" />
                    ) : open && cell.adjacent > 0 ? (
                      <span className={NUM[cell.adjacent]}>{cell.adjacent}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {over && (
              <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-xl border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm" role="status">
                <p className="text-sm font-bold">
                  {board.status === "won" ? `Cleared in ${seconds}s${newRecord ? " - new best!" : ""}` : "Boom! You hit a mine"}
                </p>
                <Button size="sm" onClick={() => start(level)}>Play again</Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => start(level)}>
              <RotateCcw className="h-3.5 w-3.5" /> New game
            </Button>
            <p className="ms-auto text-xs text-muted-foreground">Tap to open, long-press or Flag mode to flag. Tap a number to open around it. First tap is always safe.</p>
          </div>
        </div>
      )}
    </FullscreenStage>
  );
}

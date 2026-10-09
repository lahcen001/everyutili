"use client";

import * as React from "react";
import { Eraser, Lightbulb, Pencil, RotateCcw, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import {
  LEVELS,
  boxOf,
  colOf,
  digitCounts,
  findConflicts,
  formatTime,
  generatePuzzle,
  hasNote,
  isSolved,
  place,
  rowOf,
  toggleNote,
  type Board,
  type Level,
} from "@/lib/focus/sudoku";

interface Game {
  level: Level;
  puzzle: Board;
  solution: Board;
  board: Board;
  notes: number[];
  hints: number;
  elapsed: number;
  done: boolean;
}

interface Saved {
  game: Game | null;
}

type Best = Record<Level, number>;

interface Snapshot {
  board: Board;
  notes: number[];
  hints: number;
}

const LEVEL_KEYS = Object.keys(LEVELS) as Level[];

export default function Sudoku() {
  useTrackTool("sudoku");
  const [saved, setSaved] = usePersisted<Saved>("everyutili_sudoku_game", { game: null });
  const [best, setBest] = usePersisted<Best>("everyutili_sudoku_best", { easy: 0, medium: 0, hard: 0 });
  const [sel, setSel] = React.useState<number | null>(null);
  const [pencil, setPencil] = React.useState(false);
  const [history, setHistory] = React.useState<Snapshot[]>([]);
  const [newRecord, setNewRecord] = React.useState(false);
  const [level, setLevel] = React.useState<Level>("easy");
  const game = saved.game;
  const running = !!game && !game.done;

  // timer: ticks only while a game is in progress
  React.useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setSaved((s) => (s.game && !s.game.done ? { game: { ...s.game, elapsed: s.game.elapsed + 1 } } : s));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, setSaved]);

  const conflicts = React.useMemo(() => (game ? findConflicts(game.board) : new Set<number>()), [game]);
  const counts = React.useMemo(() => (game ? digitCounts(game.board) : new Array<number>(10).fill(0)), [game]);

  const start = (lv: Level) => {
    const { puzzle, solution } = generatePuzzle(lv);
    setSaved({ game: { level: lv, puzzle, solution, board: puzzle.slice(), notes: new Array<number>(81).fill(0), hints: 0, elapsed: 0, done: false } });
    setHistory([]);
    setSel(null);
    setNewRecord(false);
    setLevel(lv);
  };

  const finish = (g: Game) => {
    const done = { ...g, done: true };
    setSaved({ game: done });
    const prev = best[g.level];
    if (g.hints === 0 && (prev === 0 || g.elapsed < prev)) {
      setBest({ ...best, [g.level]: g.elapsed });
      setNewRecord(true);
    }
  };

  const enter = (digit: number) => {
    if (!game || game.done || sel === null || game.puzzle[sel]) return;
    if (pencil && digit) {
      if (game.board[sel]) return;
      setHistory((h) => [...h, { board: game.board, notes: game.notes, hints: game.hints }]);
      const notes = game.notes.slice();
      notes[sel] = toggleNote(notes[sel], digit);
      setSaved({ game: { ...game, notes } });
      return;
    }
    if (game.board[sel] === digit && !digit) return;
    setHistory((h) => [...h, { board: game.board, notes: game.notes, hints: game.hints }]);
    const r = place(game.board, game.notes, sel, digit);
    const next = { ...game, board: r.board, notes: r.notes };
    if (isSolved(r.board)) finish(next);
    else setSaved({ game: next });
  };

  const undo = () => {
    if (!game || game.done || history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setSaved({ game: { ...game, board: last.board, notes: last.notes } });
  };

  const hint = () => {
    if (!game || game.done) return;
    let idx = sel !== null && game.board[sel] !== game.solution[sel] && !game.puzzle[sel] ? sel : -1;
    if (idx < 0) {
      const wrong = game.board.map((v, i) => (v !== game.solution[i] ? i : -1)).filter((i) => i >= 0);
      if (wrong.length === 0) return;
      idx = wrong[Math.floor(Math.random() * wrong.length)];
    }
    setHistory((h) => [...h, { board: game.board, notes: game.notes, hints: game.hints }]);
    const r = place(game.board, game.notes, idx, game.solution[idx]);
    const next = { ...game, board: r.board, notes: r.notes, hints: game.hints + 1 };
    setSel(idx);
    if (isSolved(r.board)) finish(next);
    else setSaved({ game: next });
  };

  // keyboard
  const keyRef = React.useRef<(e: KeyboardEvent) => void>(() => {});
  React.useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) {
        enter(Number(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        e.preventDefault();
        enter(0);
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const cur = sel ?? 40;
        const r = rowOf(cur) + (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0);
        const c = colOf(cur) + (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0);
        setSel(Math.max(0, Math.min(8, r)) * 9 + Math.max(0, Math.min(8, c)));
      } else if (e.key === "n" || e.key === "N") {
        setPencil((p) => !p);
      }
    };
  });
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const selVal = game && sel !== null ? game.board[sel] : 0;

  return (
    <FullscreenStage className="rounded-2xl border border-border bg-gradient-to-br from-sky-500/5 via-background to-indigo-500/5 p-4 sm:p-6">
      {(isFs) => (
        <div className="mx-auto flex w-full flex-col gap-3 py-4" style={{ maxWidth: isFs ? "min(80vh, 92vw)" : 32 * 16 }}>
          <div className="flex flex-wrap items-center gap-2 pe-28">
            {LEVEL_KEYS.map((lv) => (
              <Button key={lv} size="sm" variant={(game ? game.level : level) === lv ? "default" : "outline"} onClick={() => start(lv)} aria-label={`New ${LEVELS[lv].label} game`}>
                {LEVELS[lv].label}
              </Button>
            ))}
          </div>

          {!game ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted/50 p-8 text-center">
              <p className="text-lg font-bold">Pick a level to start</p>
              <p className="text-sm text-muted-foreground">Fill every row, column and 3x3 box with the digits 1 to 9.</p>
              <Button onClick={() => start(level)}>Start {LEVELS[level].label}</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <div className="rounded-xl bg-muted px-3 py-1.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Time</p>
                  <p className="font-extrabold tabular-nums">{formatTime(game.elapsed)}</p>
                </div>
                <div className="rounded-xl bg-muted px-3 py-1.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Best</p>
                  <p className="font-extrabold tabular-nums">{best[game.level] ? formatTime(best[game.level]) : "-"}</p>
                </div>
                <div className="rounded-xl bg-muted px-3 py-1.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hints</p>
                  <p className="font-extrabold tabular-nums">{game.hints}</p>
                </div>
              </div>

              <div className="relative">
                <div className="grid aspect-square w-full grid-cols-9 overflow-hidden rounded-xl border-2 border-foreground/70 bg-background" role="grid" aria-label="Sudoku board">
                  {game.board.map((v, i) => {
                    const given = game.puzzle[i] !== 0;
                    const isSel = sel === i;
                    const related = sel !== null && !isSel && (rowOf(i) === rowOf(sel) || colOf(i) === colOf(sel) || boxOf(i) === boxOf(sel));
                    const same = selVal !== 0 && v === selVal && !isSel;
                    const bad = conflicts.has(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        role="gridcell"
                        onClick={() => setSel(i)}
                        aria-label={`Row ${rowOf(i) + 1}, column ${colOf(i) + 1}, ${v ? `${given ? "given " : ""}${v}${bad ? ", conflict" : ""}` : "empty"}`}
                        aria-selected={isSel}
                        className={cn(
                          "relative flex aspect-square items-center justify-center border-[0.5px] border-border p-0 text-lg font-semibold leading-none sm:text-2xl",
                          colOf(i) % 3 === 2 && colOf(i) !== 8 && "border-e-2 border-e-foreground/70",
                          rowOf(i) % 3 === 2 && rowOf(i) !== 8 && "border-b-2 border-b-foreground/70",
                          related && "bg-sky-500/10",
                          same && "bg-sky-500/25",
                          isSel && "bg-sky-500/40 ring-2 ring-inset ring-sky-600",
                          given ? "text-foreground" : "text-sky-700 dark:text-sky-300",
                          bad && "bg-red-500/20 text-red-600 dark:text-red-400"
                        )}
                      >
                        {v ? (
                          v
                        ) : game.notes[i] ? (
                          <span className="grid h-full w-full grid-cols-3 p-px text-[7px] font-medium leading-none text-muted-foreground sm:text-[10px]">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                              <span key={d} className="flex items-center justify-center">
                                {hasNote(game.notes[i], d) ? d : ""}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {game.done && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/85 p-4 text-center backdrop-blur-sm">
                    <p className="text-3xl font-black">Solved!</p>
                    <p className="text-muted-foreground">
                      {LEVELS[game.level].label} in {formatTime(game.elapsed)}
                      {game.hints ? ` with ${game.hints} hint${game.hints === 1 ? "" : "s"}` : ""}
                    </p>
                    {newRecord && <p className="font-bold text-emerald-600">New best time!</p>}
                    {game.hints > 0 && <p className="text-xs text-muted-foreground">Best times only count games without hints.</p>}
                    <Button onClick={() => start(game.level)}>Play again</Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <Button
                    key={d}
                    variant="outline"
                    className="h-12 px-0 text-lg font-bold sm:h-14 sm:text-xl"
                    disabled={game.done || counts[d] >= 9}
                    onClick={() => enter(d)}
                    aria-label={`${pencil ? "Note" : "Enter"} ${d}`}
                  >
                    {d}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant={pencil ? "default" : "outline"} size="sm" onClick={() => setPencil(!pencil)} aria-pressed={pencil} aria-label="Toggle pencil notes">
                  <Pencil className="h-3.5 w-3.5" /> Notes {pencil ? "on" : "off"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => enter(0)} disabled={game.done} aria-label="Erase cell">
                  <Eraser className="h-3.5 w-3.5" /> Erase
                </Button>
                <Button variant="outline" size="sm" onClick={undo} disabled={game.done || history.length === 0} aria-label="Undo">
                  <Undo2 className="h-3.5 w-3.5" /> Undo
                </Button>
                <Button variant="outline" size="sm" onClick={hint} disabled={game.done} aria-label="Hint: reveal one cell">
                  <Lightbulb className="h-3.5 w-3.5" /> Hint
                </Button>
                <Button variant="outline" size="sm" onClick={() => start(game.level)} aria-label="New game">
                  <RotateCcw className="h-3.5 w-3.5" /> New game
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Tap a cell, then a number. Keyboard: 1-9, arrows, Backspace, N for notes. Your game is saved automatically.</p>
            </>
          )}
        </div>
      )}
    </FullscreenStage>
  );
}

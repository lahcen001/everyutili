"use client";

import * as React from "react";
import { RotateCcw, Undo2, Users, Bot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import {
  COLS,
  ROWS,
  chooseMove,
  drop,
  dropRow,
  findWinner,
  isFull,
  newBoard,
  other,
  type Board,
  type Difficulty,
  type Player,
} from "@/lib/focus/connectFour";

type Mode = "cpu" | "two";

interface Score {
  you: number;
  cpu: number;
  p1: number;
  p2: number;
  draws: number;
}

const EMPTY_SCORE: Score = { you: 0, cpu: 0, p1: 0, p2: 0, draws: 0 };
const DIFFS: Difficulty[] = ["easy", "medium", "hard"];

export default function ConnectFour() {
  useTrackTool("connect-four");
  const [mode, setMode] = React.useState<Mode>("cpu");
  const [difficulty, setDifficulty] = React.useState<Difficulty>("medium");
  const [board, setBoard] = React.useState<Board>(() => newBoard());
  const [turn, setTurn] = React.useState<Player>(1);
  const [history, setHistory] = React.useState<number[]>([]);
  const [score, setScore] = usePersisted<Score>("everyutili_connectfour_score", EMPTY_SCORE);

  const winner = findWinner(board);
  const draw = !winner && isFull(board);
  const over = !!winner || draw;
  const cpuTurn = mode === "cpu" && turn === 2 && !over;
  const winSet = new Set(winner?.cells ?? []);

  const finish = React.useCallback(
    (b: Board) => {
      const w = findWinner(b);
      if (!w && !isFull(b)) return;
      const s = { ...EMPTY_SCORE, ...score };
      if (!w) s.draws++;
      else if (mode === "cpu") w.player === 1 ? s.you++ : s.cpu++;
      else w.player === 1 ? s.p1++ : s.p2++;
      setScore(s);
    },
    [score, mode, setScore]
  );

  const place = React.useCallback(
    (col: number, player: Player) => {
      const next = drop(board, col, player);
      if (next === board) return;
      setBoard(next);
      setHistory((h) => [...h, col]);
      setTurn(other(player));
      finish(next);
    },
    [board, finish]
  );

  // Computer reply, scheduled so the UI never blocks.
  React.useEffect(() => {
    if (!cpuTurn) return;
    const id = setTimeout(() => {
      const col = chooseMove(board, 2, difficulty);
      if (col >= 0) place(col, 2);
    }, 350);
    return () => clearTimeout(id);
  }, [cpuTurn, board, difficulty, place]);

  const onColumn = (col: number) => {
    if (over || cpuTurn || dropRow(board, col) < 0) return;
    place(col, turn);
  };

  const reset = (m: Mode = mode) => {
    setMode(m);
    setBoard(newBoard());
    setTurn(1);
    setHistory([]);
  };

  const undo = () => {
    if (cpuTurn || history.length === 0) return;
    // vs computer: take back the computer's reply and your own move.
    const n = mode === "cpu" ? (history.length >= 2 && turn === 1 ? 2 : 1) : 1;
    const keep = history.slice(0, history.length - n);
    let b = newBoard();
    let p: Player = 1;
    for (const c of keep) {
      b = drop(b, c, p);
      p = other(p);
    }
    setBoard(b);
    setHistory(keep);
    setTurn(p);
  };

  const status = winner
    ? mode === "cpu"
      ? winner.player === 1
        ? "You win! 🎉"
        : "Computer wins"
      : `Player ${winner.player} (${winner.player === 1 ? "red" : "yellow"}) wins! 🎉`
    : draw
      ? "It's a draw"
      : cpuTurn
        ? "Computer is thinking…"
        : mode === "cpu"
          ? "Your turn (red)"
          : `Player ${turn}'s turn (${turn === 1 ? "red" : "yellow"})`;

  const s = { ...EMPTY_SCORE, ...score };
  const names = mode === "cpu" ? ["You", "Computer"] : ["Player 1", "Player 2"];
  const wins = mode === "cpu" ? [s.you, s.cpu] : [s.p1, s.p2];

  return (
    <FullscreenStage className="rounded-2xl border border-border bg-gradient-to-br from-blue-500/5 via-background to-yellow-500/5 p-4 sm:p-6">
      {(isFs) => (
        <div className="mx-auto flex w-full flex-col gap-4 py-4" style={{ maxWidth: isFs ? "min(70vh, 90vw)" : 30 * 16 }}>
          <div className="flex flex-wrap items-center gap-2 pe-28">
            <Button variant={mode === "cpu" ? "default" : "outline"} size="sm" onClick={() => reset("cpu")} aria-pressed={mode === "cpu"}>
              <Bot className="h-3.5 w-3.5" /> vs Computer
            </Button>
            <Button variant={mode === "two" ? "default" : "outline"} size="sm" onClick={() => reset("two")} aria-pressed={mode === "two"}>
              <Users className="h-3.5 w-3.5" /> 2 players
            </Button>
          </div>
          {mode === "cpu" && (
            <div className="flex items-center gap-2" role="group" aria-label="Difficulty">
              {DIFFS.map((d) => (
                <Button key={d} variant={difficulty === d ? "default" : "outline"} size="sm" className="capitalize" aria-pressed={difficulty === d} onClick={() => { setDifficulty(d); reset("cpu"); }}>
                  {d}
                </Button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-1 items-center gap-2 rounded-xl bg-muted px-3 py-2">
                <span className={cn("h-4 w-4 shrink-0 rounded-full", i === 0 ? "bg-red-500" : "bg-yellow-400")} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{names[i]}</p>
                  <p className="text-lg font-extrabold leading-none tabular-nums">{wins[i]}</p>
                </div>
              </div>
            ))}
            <div className="rounded-xl bg-muted px-3 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Draws</p>
              <p className="text-lg font-extrabold leading-none tabular-nums">{s.draws}</p>
            </div>
          </div>
          <p className="text-center text-lg font-bold" role="status" aria-live="polite">{status}</p>
          <div className="select-none rounded-2xl bg-blue-600 p-2 shadow-lg sm:p-3">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {Array.from({ length: COLS }, (_, c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Drop disc in column ${c + 1}`}
                  disabled={over || cpuTurn || dropRow(board, c) < 0}
                  onClick={() => onColumn(c)}
                  className="flex touch-manipulation flex-col gap-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed sm:gap-2"
                >
                  {Array.from({ length: ROWS }, (_, r) => {
                    const v = board[r * COLS + c];
                    const win = winSet.has(r * COLS + c);
                    return (
                      <span
                        key={r}
                        className={cn(
                          "block aspect-square w-full rounded-full shadow-inner transition-colors duration-150",
                          v === 0 ? "bg-blue-950/60" : v === 1 ? "bg-red-500" : "bg-yellow-400",
                          win && "ring-4 ring-white animate-pulse"
                        )}
                      />
                    );
                  })}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={undo} disabled={cpuTurn || history.length === 0}>
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </Button>
            <Button variant="outline" size="sm" onClick={() => reset()}>
              <RotateCcw className="h-3.5 w-3.5" /> New game
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setScore(EMPTY_SCORE)}>
              Reset scores
            </Button>
            <p className="w-full text-xs text-muted-foreground">Tap a column to drop a disc. Connect four in a row to win.</p>
          </div>
        </div>
      )}
    </FullscreenStage>
  );
}

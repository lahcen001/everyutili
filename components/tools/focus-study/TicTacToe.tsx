"use client";

import * as React from "react";
import { RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { computerMove, emptyBoard, opponent, outcome, place, type Board, type Difficulty, type Mark } from "@/lib/focus/ticTacToe";

type Mode = "cpu" | "pvp";
interface Settings {
  mode: Mode;
  level: Difficulty;
  human: Mark;
}
interface Tally {
  wins: number;
  draws: number;
  losses: number;
}
interface Stats {
  easy: Tally;
  medium: Tally;
  impossible: Tally;
  pvp: { x: number; o: number; draws: number };
}
interface Game {
  board: Board;
  turn: Mark;
  first: Mark;
}

const DEFAULT_SETTINGS: Settings = { mode: "cpu", level: "medium", human: "X" };
const ZERO: Tally = { wins: 0, draws: 0, losses: 0 };
const DEFAULT_STATS: Stats = { easy: ZERO, medium: ZERO, impossible: ZERO, pvp: { x: 0, o: 0, draws: 0 } };
const LEVELS: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "impossible", label: "Impossible" },
];

const fresh = (first: Mark): Game => ({ board: emptyBoard(), turn: first, first });

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn("min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors", value === o.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function TicTacToe() {
  useTrackTool("tic-tac-toe");
  const [settings, setSettings] = usePersisted<Settings>("everyutili_tictactoe_settings", DEFAULT_SETTINGS);
  const [stats, setStats] = usePersisted<Stats>("everyutili_tictactoe_stats", DEFAULT_STATS);
  const [game, setGame] = React.useState<Game>(() => fresh("X"));

  const { board, turn } = game;
  const res = outcome(board);
  const finished = res.winner !== null || res.draw;
  const cpu = settings.mode === "cpu";
  const cpuMark = opponent(settings.human);
  const cpuTurn = cpu && !finished && turn === cpuMark;

  const commit = React.useCallback(
    (index: number) => {
      const next = place(game.board, index, game.turn);
      if (next === game.board) return;
      const o = outcome(next);
      setGame({ ...game, board: next, turn: opponent(game.turn) });
      if (o.winner === null && !o.draw) return;
      setStats((s) => {
        if (!cpu) {
          return { ...s, pvp: { x: s.pvp.x + (o.winner === "X" ? 1 : 0), o: s.pvp.o + (o.winner === "O" ? 1 : 0), draws: s.pvp.draws + (o.draw ? 1 : 0) } };
        }
        const t = s[settings.level];
        return {
          ...s,
          [settings.level]: {
            wins: t.wins + (o.winner === settings.human ? 1 : 0),
            losses: t.losses + (o.winner && o.winner !== settings.human ? 1 : 0),
            draws: t.draws + (o.draw ? 1 : 0),
          },
        };
      });
    },
    [game, cpu, settings.level, settings.human, setStats]
  );

  React.useEffect(() => {
    if (!cpuTurn) return;
    const id = window.setTimeout(() => commit(computerMove(game.board, cpuMark, settings.level)), 450);
    return () => window.clearTimeout(id);
  }, [cpuTurn, commit, game.board, cpuMark, settings.level]);

  const nextRound = () => setGame((g) => fresh(opponent(g.first)));
  const change = (patch: Partial<Settings>) => {
    setSettings({ ...settings, ...patch });
    setGame(fresh("X"));
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "BUTTON" || e.metaKey || e.ctrlKey) return;
      if (/^[1-9]$/.test(e.key)) {
        if (!cpuTurn) commit(Number(e.key) - 1);
      } else if (e.key.toLowerCase() === "r") {
        setGame((g) => fresh(opponent(g.first)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, cpuTurn]);

  let status: string;
  if (res.winner) status = !cpu ? `${res.winner} wins!` : res.winner === settings.human ? "You win! 🎉" : "Computer wins";
  else if (res.draw) status = "It's a draw";
  else if (!cpu) status = `${turn}'s turn`;
  else status = turn === settings.human ? `Your turn (${settings.human})` : "Computer is thinking…";

  const tally = stats[settings.level];
  const score = cpu
    ? [
        { label: "Wins", value: tally.wins },
        { label: "Draws", value: tally.draws },
        { label: "Losses", value: tally.losses },
      ]
    : [
        { label: "X wins", value: stats.pvp.x },
        { label: "Draws", value: stats.pvp.draws },
        { label: "O wins", value: stats.pvp.o },
      ];

  return (
    <FullscreenStage className="rounded-2xl border border-border bg-gradient-to-br from-sky-500/5 via-background to-rose-500/5 p-4 sm:p-6">
      {(isFs) => (
        <div className="mx-auto flex w-full flex-col gap-4 py-4" style={{ maxWidth: isFs ? "min(80vh, 90vw)" : 28 * 16 }}>
          <div className="flex flex-col gap-2 pe-0 sm:pe-28">
            <Seg label="Game mode" value={settings.mode} onChange={(mode) => change({ mode })} options={[{ id: "cpu", label: "vs Computer" }, { id: "pvp", label: "2 Players" }]} />
            {cpu && (
              <>
                <Seg label="Difficulty" value={settings.level} onChange={(level) => change({ level })} options={LEVELS} />
                <Seg label="Your mark" value={settings.human} onChange={(human) => change({ human })} options={[{ id: "X", label: "Play X" }, { id: "O", label: "Play O" }]} />
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2" aria-label="Scoreboard">
            {score.map((s) => (
              <div key={s.label} className="rounded-xl bg-muted px-3 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="text-xl font-extrabold tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>

          <p role="status" aria-live="polite" className="text-center text-lg font-bold">
            {status}
          </p>

          <div className="grid touch-manipulation select-none grid-cols-3 gap-2 rounded-2xl bg-sky-900/10 p-2 sm:gap-3 sm:p-3">
            {board.map((cell, i) => {
              const win = res.line?.includes(i) ?? false;
              const row = Math.floor(i / 3) + 1;
              const col = (i % 3) + 1;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={cell !== null || finished || cpuTurn}
                  onClick={() => commit(i)}
                  aria-label={`Row ${row}, column ${col}, ${cell ?? "empty"}`}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-xl text-5xl font-black shadow-sm transition-colors duration-150 sm:text-6xl",
                    win ? "bg-emerald-500 text-white" : "bg-background",
                    !win && cell === "X" && "text-sky-500",
                    !win && cell === "O" && "text-rose-500",
                    cell === null && !finished && !cpuTurn && "active:bg-muted"
                  )}
                >
                  {cell}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={nextRound}>
              <RotateCcw className="h-4 w-4" /> {finished ? "Play again" : "New game"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStats(DEFAULT_STATS)}>
              <Trash2 className="h-3.5 w-3.5" /> Reset scores
            </Button>
            <p className="w-full text-xs text-muted-foreground sm:ms-auto sm:w-auto">Tap a square or press 1-9. The starting player alternates each round.</p>
          </div>
        </div>
      )}
    </FullscreenStage>
  );
}

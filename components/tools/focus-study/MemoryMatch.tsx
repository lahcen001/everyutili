"use client";

import * as React from "react";
import { RotateCcw, Star, Timer, Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { Confetti } from "@/components/tools/random-decision/Confetti";
import { buildDeck, stars } from "@/lib/focus/memory";
import { formatClock } from "@/lib/focus/pomodoro";

const LEVELS = [
  { id: "easy", label: "Easy", pairs: 6, cols: 4 },
  { id: "medium", label: "Medium", pairs: 8, cols: 4 },
  { id: "hard", label: "Hard", pairs: 12, cols: 6 },
] as const;

type Best = Record<string, { moves: number; seconds: number }>;

export default function MemoryMatch() {
  useTrackTool("memory-match");
  const [levelId, setLevelId] = React.useState<(typeof LEVELS)[number]["id"]>("easy");
  const level = LEVELS.find((l) => l.id === levelId)!;
  const [deck, setDeck] = React.useState(() => buildDeck(LEVELS[0].pairs));
  const [open, setOpen] = React.useState<number[]>([]);
  const [matched, setMatched] = React.useState<Set<number>>(() => new Set());
  const [moves, setMoves] = React.useState(0);
  const [seconds, setSeconds] = React.useState(0);
  const [started, setStarted] = React.useState(false);
  const [win, setWin] = React.useState(0);
  const [best, setBest] = usePersisted<Best>("everyutili_memory_best", {});
  const locked = React.useRef(false);

  const won = matched.size === deck.length;

  React.useEffect(() => {
    if (!started || won) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [started, won]);

  const newGame = (id = levelId) => {
    const l = LEVELS.find((x) => x.id === id)!;
    setLevelId(id);
    setDeck(buildDeck(l.pairs));
    setOpen([]);
    setMatched(new Set());
    setMoves(0);
    setSeconds(0);
    setStarted(false);
    locked.current = false;
  };

  const flip = (i: number) => {
    if (locked.current || open.includes(i) || matched.has(i)) return;
    setStarted(true);
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = next;
    if (deck[a].symbol === deck[b].symbol) {
      const m = new Set(matched).add(a).add(b);
      setMatched(m);
      setOpen([]);
      if (m.size === deck.length) {
        setWin((w) => w + 1);
        const final = moves + 1;
        setBest((bst) => {
          const cur = bst[levelId];
          return !cur || final < cur.moves || (final === cur.moves && seconds < cur.seconds) ? { ...bst, [levelId]: { moves: final, seconds } } : bst;
        });
      }
    } else {
      locked.current = true;
      window.setTimeout(() => {
        setOpen([]);
        locked.current = false;
      }, 800);
    }
  };

  const earned = won ? stars(moves, level.pairs) : 0;
  const record = best[levelId];

  return (
    <FullscreenStage className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-background to-fuchsia-500/5 p-4 sm:p-6" label="Fullscreen">
      {(isFs) => (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-4">
          <Confetti fire={win} big />
          <div className="flex flex-wrap items-center gap-2 pe-28">
            <div className="flex rounded-full bg-muted p-1" role="tablist">
              {LEVELS.map((l) => (
                <button key={l.id} role="tab" aria-selected={levelId === l.id} onClick={() => newGame(l.id)} className={cn("rounded-full px-3 py-1 text-sm font-semibold", levelId === l.id ? "bg-background shadow-sm" : "text-muted-foreground")}>
                  {l.label}
                </button>
              ))}
            </div>
            <span className="ms-auto flex items-center gap-3 text-sm tabular-nums">
              <span>Moves <b>{moves}</b></span>
              <span className="flex items-center gap-1"><Timer className="h-4 w-4" /> <b>{formatClock(seconds)}</b></span>
            </span>
          </div>

          <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))` }}>
            {deck.map((card, i) => {
              const up = open.includes(i) || matched.has(i);
              return (
                <button key={card.id} onClick={() => flip(i)} aria-label={up ? card.symbol : "Hidden card"} aria-pressed={up} className="aspect-square [perspective:600px]">
                  <span className={cn("relative block h-full w-full transition-transform duration-300 [transform-style:preserve-3d]", up && "[transform:rotateY(180deg)]")}>
                    <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-fuchsia-600 text-2xl text-white shadow-md [backface-visibility:hidden]">?</span>
                    <span className={cn("absolute inset-0 flex items-center justify-center rounded-xl border-2 bg-card shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]", matched.has(i) ? "border-emerald-500 bg-emerald-500/10" : "border-border", isFs ? "text-6xl" : "text-3xl sm:text-4xl")}>{card.symbol}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {won ? (
            <Card className="flex flex-wrap items-center gap-3 border-emerald-500/40 bg-emerald-500/5 p-4">
              <Trophy className="h-8 w-8 text-amber-500" />
              <div className="flex-1">
                <p className="font-bold">You won in {moves} moves and {formatClock(seconds)}!</p>
                <p className="flex gap-0.5">{[1, 2, 3].map((n) => <Star key={n} className={cn("h-5 w-5", n <= earned ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />)}</p>
              </div>
              <Button onClick={() => newGame()}>Play again</Button>
            </Card>
          ) : (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{record ? `Best (${level.label}): ${record.moves} moves · ${formatClock(record.seconds)}` : "Find all the matching pairs."}</span>
              <Button size="sm" variant="outline" onClick={() => newGame()}>
                <RotateCcw className="h-3.5 w-3.5" /> New game
              </Button>
            </div>
          )}
        </div>
      )}
    </FullscreenStage>
  );
}

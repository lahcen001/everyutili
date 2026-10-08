"use client";

import * as React from "react";
import { RotateCcw, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { makeSchulte } from "@/lib/focus/games";

const SIZES = [3, 4, 5, 6];
const clock = () => Date.now();
const fmt = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

export default function SchulteTable() {
  useTrackTool("schulte-table");
  const [size, setSize] = React.useState(5);
  const [cells, setCells] = React.useState(() => makeSchulte(5));
  const [next, setNext] = React.useState(1);
  const [elapsed, setElapsed] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const [wrong, setWrong] = React.useState<number | null>(null);
  const [best, setBest] = usePersisted<Record<string, number>>("everyutili_schulte_best", {});
  const startAt = React.useRef(0);
  const total = size * size;
  const done = next > total;

  React.useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed(clock() - startAt.current), 50);
    return () => window.clearInterval(id);
  }, [running]);

  const reset = (s = size) => {
    setSize(s);
    setCells(makeSchulte(s));
    setNext(1);
    setElapsed(0);
    setRunning(false);
  };

  const tap = (n: number) => {
    if (done) return;
    if (n !== next) {
      setWrong(n);
      window.setTimeout(() => setWrong(null), 250);
      return;
    }
    if (n === 1) {
      startAt.current = clock();
      setRunning(true);
    }
    if (n === total) {
      const t = clock() - startAt.current;
      setElapsed(t);
      setRunning(false);
      setBest((b) => (!b[size] || t < b[size] ? { ...b, [size]: t } : b));
    }
    setNext(n + 1);
  };

  return (
    <FullscreenStage className="rounded-2xl border border-border p-4 sm:p-6">
      {(isFs) => (
        <div className="mx-auto flex w-full flex-col gap-4 py-4" style={{ maxWidth: isFs ? "min(80vh, 90vw)" : 30 * 16 }}>
          <div className="flex flex-wrap items-center gap-2 pe-28">
            <div className="flex rounded-full bg-muted p-1" role="tablist" aria-label="Grid size">
              {SIZES.map((s) => (
                <button key={s} role="tab" aria-selected={size === s} onClick={() => reset(s)} className={cn("rounded-full px-3 py-1 text-sm font-semibold", size === s ? "bg-background shadow-sm" : "text-muted-foreground")}>{s}×{s}</button>
              ))}
            </div>
            <span className="ms-auto font-mono text-2xl font-semibold tabular-nums">{fmt(elapsed)}</span>
          </div>
          <p className="text-center text-sm text-muted-foreground">{done ? `Done in ${fmt(elapsed)}!` : <>Find <b className="text-lg text-foreground">{next}</b> — then {Math.min(next + 1, total)}… up to {total}. Keep your eyes on the centre if you can.</>}</p>
          <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
            {cells.map((n) => (
              <button key={n} onClick={() => tap(n)} aria-label={String(n)} className={cn("aspect-square rounded-xl border text-xl font-semibold transition-colors sm:text-2xl", n < next ? "border-primary/20 bg-primary/10 text-primary/50" : wrong === n ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-card hover:bg-muted")} style={isFs ? { fontSize: "clamp(1.2rem, 4vh, 2.4rem)" } : undefined}>
                {n}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Trophy className="h-4 w-4 text-primary" /> Best {size}×{size}: {best[size] ? fmt(best[size]) : "–"}</span>
            <Button size="sm" variant="outline" onClick={() => reset()}><RotateCcw className="h-3.5 w-3.5" /> New table</Button>
          </div>
        </div>
      )}
    </FullscreenStage>
  );
}

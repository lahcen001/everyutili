"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { isNBackMatch, makeNBackSequence, scoreNBack, type NBackScore } from "@/lib/focus/games";

const TRIALS = 24;
const STEP_MS = 2200;
const SHOW_MS = 1200;

export default function NBackGame() {
  useTrackTool("n-back-game");
  const [n, setN] = React.useState(2);
  const [phase, setPhase] = React.useState<"idle" | "play" | "done">("idle");
  const [seq, setSeq] = React.useState<number[]>([]);
  const [index, setIndex] = React.useState(-1);
  const [lit, setLit] = React.useState(false);
  const [pressed, setPressed] = React.useState<boolean[]>([]);
  const [result, setResult] = React.useState<NBackScore | null>(null);
  const [best, setBest] = usePersisted<Record<string, number>>("everyutili_nback_best", {});
  const pressedRef = React.useRef<boolean[]>([]);

  const start = () => {
    const s = makeNBackSequence(TRIALS, n);
    setSeq(s);
    pressedRef.current = Array(TRIALS).fill(false);
    setPressed(pressedRef.current);
    setIndex(0);
    setLit(true);
    setResult(null);
    setPhase("play");
  };

  React.useEffect(() => {
    if (phase !== "play") return;
    const hide = window.setTimeout(() => setLit(false), SHOW_MS);
    const advance = window.setTimeout(() => {
      if (index + 1 >= seq.length) {
        const score = scoreNBack(seq, n, pressedRef.current);
        setResult(score);
        setBest((b) => (score.accuracy > (b[n] ?? 0) ? { ...b, [n]: score.accuracy } : b));
        setPhase("done");
      } else {
        setIndex(index + 1);
        setLit(true);
      }
    }, STEP_MS);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(advance);
    };
  }, [phase, index, seq, n, setBest]);

  const press = React.useCallback(() => {
    if (phase !== "play" || index < 0) return;
    pressedRef.current = pressedRef.current.map((p, i) => (i === index ? true : p));
    setPressed(pressedRef.current);
  }, [phase, index]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (phase === "play") press();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, press]);

  const activeCell = phase === "play" && lit ? seq[index] : -1;
  const matchNow = phase === "play" && isNBackMatch(seq, index, n);
  void matchNow;

  return (
    <FullscreenStage className="rounded-2xl border border-border p-4 sm:p-8" label="Fullscreen">
      {(isFs) => (
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 py-6 text-center">
          {phase === "idle" && (
            <>
              <h3 className="text-2xl font-semibold">Dual n-back (position)</h3>
              <p className="text-muted-foreground">A square lights up every couple of seconds. Press <b>Match</b> (or Space) when the square is in the <b>same place as {n} step{n > 1 ? "s" : ""} ago</b>. It trains working memory and focus.</p>
              <div className="flex rounded-full bg-muted p-1" role="tablist" aria-label="Difficulty">
                {[1, 2, 3].map((v) => (
                  <button key={v} role="tab" aria-selected={n === v} onClick={() => setN(v)} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", n === v ? "bg-background shadow-sm" : "text-muted-foreground")}>{v}-back</button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Best accuracy at {n}-back: {best[n] ? `${best[n]}%` : "–"}</p>
              <Button size="lg" className="min-w-40 rounded-full" onClick={start}>Start ({TRIALS} rounds)</Button>
            </>
          )}
          {phase === "play" && (
            <>
              <p className="text-sm text-muted-foreground">Round {index + 1} / {TRIALS} · {n}-back</p>
              <div className="grid w-full grid-cols-3 gap-2" style={isFs ? { maxWidth: "min(60vh, 80vw)" } : { maxWidth: 300 }}>
                {Array.from({ length: 9 }, (_, i) => (
                  <div key={i} className={cn("aspect-square rounded-2xl border transition-colors duration-150", activeCell === i ? "border-primary bg-primary" : "border-border bg-muted/50")} />
                ))}
              </div>
              <Button size="lg" onClick={press} className={cn("h-14 w-full max-w-xs rounded-2xl text-lg", pressed[index] && "ring-2 ring-primary ring-offset-2")} variant={pressed[index] ? "default" : "outline"}>
                {pressed[index] ? "Match!" : "Match (Space)"}
              </Button>
            </>
          )}
          {phase === "done" && result && (
            <>
              <h3 className="text-3xl font-semibold">{result.accuracy}% accuracy</h3>
              <div className="grid w-full grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-muted/60 p-3"><b className="text-lg">{result.hits}</b><p className="text-muted-foreground">matches found</p></div>
                <div className="rounded-xl bg-muted/60 p-3"><b className="text-lg">{result.misses}</b><p className="text-muted-foreground">missed</p></div>
                <div className="rounded-xl bg-muted/60 p-3"><b className="text-lg">{result.falseAlarms}</b><p className="text-muted-foreground">false alarms</p></div>
                <div className="rounded-xl bg-muted/60 p-3"><b className="text-lg">{result.correctRejections}</b><p className="text-muted-foreground">correctly ignored</p></div>
              </div>
              <div className="flex gap-2">
                <Button size="lg" onClick={start}><RotateCcw className="h-4 w-4" /> Again</Button>
                <Button size="lg" variant="outline" onClick={() => setPhase("idle")}>Change level</Button>
              </div>
            </>
          )}
        </div>
      )}
    </FullscreenStage>
  );
}

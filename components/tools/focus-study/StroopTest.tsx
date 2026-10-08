"use client";

import * as React from "react";
import { RotateCcw, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { STROOP_COLORS, makeStroopTrial, type StroopTrial } from "@/lib/focus/games";

const ROUND = 30;

export default function StroopTest() {
  useTrackTool("stroop-test");
  const [phase, setPhase] = React.useState<"idle" | "play" | "done">("idle");
  const [trial, setTrial] = React.useState<StroopTrial>(() => makeStroopTrial());
  const [correct, setCorrect] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [left, setLeft] = React.useState(ROUND);
  const [flash, setFlash] = React.useState<"ok" | "bad" | null>(null);
  const [best, setBest] = usePersisted<{ score: number }>("everyutili_stroop_best", { score: 0 });
  const endAt = React.useRef(0);

  React.useEffect(() => {
    if (phase !== "play") return;
    const id = window.setInterval(() => {
      const t = Math.ceil((endAt.current - Date.now()) / 1000);
      if (t <= 0) {
        setLeft(0);
        setPhase("done");
      } else setLeft(t);
    }, 200);
    return () => window.clearInterval(id);
  }, [phase]);

  React.useEffect(() => {
    if (phase === "done") setBest((b) => (correct > b.score ? { score: correct } : b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = () => {
    endAt.current = Date.now() + ROUND * 1000;
    setCorrect(0);
    setTotal(0);
    setLeft(ROUND);
    setTrial(makeStroopTrial());
    setPhase("play");
  };

  const answer = React.useCallback(
    (id: string) => {
      if (phase !== "play") return;
      const ok = id === trial.ink.id;
      setTotal((t) => t + 1);
      if (ok) setCorrect((c) => c + 1);
      setFlash(ok ? "ok" : "bad");
      window.setTimeout(() => setFlash(null), 200);
      setTrial(makeStroopTrial());
    },
    [phase, trial]
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (i >= 0 && i < STROOP_COLORS.length) answer(STROOP_COLORS[i].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer]);

  return (
    <FullscreenStage className="rounded-2xl border border-border p-4 sm:p-8" label="Fullscreen">
      {(isFs) => (
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-6 text-center">
          {phase === "idle" && (
            <>
              <h3 className="text-2xl font-semibold">Stroop test</h3>
              <p className="max-w-md text-muted-foreground">A word appears in a colour. Tap the <b>colour of the ink</b>, not what the word says. It trains attention and self-control. {ROUND} seconds.</p>
              <p className="text-sm text-muted-foreground">Best score: {best.score || "–"}</p>
              <Button size="lg" className="min-w-40 rounded-full" onClick={start}>Start</Button>
            </>
          )}
          {phase === "play" && (
            <>
              <div className="flex w-full items-center justify-between text-sm">
                <span className="rounded-full bg-muted px-3 py-1 font-medium">Score {correct}</span>
                <span className={cn("font-mono text-xl font-semibold tabular-nums", left <= 5 && "text-destructive")}>{left}s</span>
              </div>
              <p className={cn("select-none font-black tracking-tight transition-transform", isFs ? "text-9xl" : "text-7xl", flash === "bad" && "animate-pulse")} style={{ color: trial.ink.css }} aria-label={`The word ${trial.word.label}`}>{trial.word.label}</p>
              <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
                {STROOP_COLORS.map((c, i) => (
                  <button key={c.id} onClick={() => answer(c.id)} className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-semibold transition-all hover:bg-muted active:scale-95">
                    <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c.css }} /> {c.label[0] + c.label.slice(1).toLowerCase()} <kbd className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">{i + 1}</kbd>
                  </button>
                ))}
              </div>
              <p className={cn("h-5 text-sm", flash === "ok" ? "text-primary" : flash === "bad" ? "text-destructive" : "text-transparent")}>{flash === "ok" ? "Correct" : "Not quite"}</p>
            </>
          )}
          {phase === "done" && (
            <>
              <Trophy className="h-12 w-12 text-primary" />
              <h3 className="text-3xl font-semibold">{correct} correct</h3>
              <p className="text-muted-foreground">{total} answered · {total ? Math.round((correct / total) * 100) : 0}% accuracy{correct >= best.score && correct > 0 ? " · new best" : ""}</p>
              <Button size="lg" onClick={start}><RotateCcw className="h-4 w-4" /> Play again</Button>
            </>
          )}
        </div>
      )}
    </FullscreenStage>
  );
}

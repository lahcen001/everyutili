"use client";

import * as React from "react";
import { Crosshair, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { randomTarget } from "@/lib/focus/games";

const ROUND = 30;

export default function AimTrainer() {
  useTrackTool("aim-trainer");
  const [phase, setPhase] = React.useState<"idle" | "play" | "done">("idle");
  const [target, setTarget] = React.useState({ x: 0.5, y: 0.5 });
  const [hits, setHits] = React.useState(0);
  const [misses, setMisses] = React.useState(0);
  const [left, setLeft] = React.useState(ROUND);
  const [best, setBest] = usePersisted<{ hits: number }>("everyutili_aim_best", { hits: 0 });
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
    if (phase === "done") setBest((b) => (hits > b.hits ? { hits } : b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = () => {
    endAt.current = Date.now() + ROUND * 1000;
    setHits(0);
    setMisses(0);
    setLeft(ROUND);
    setTarget(randomTarget());
    setPhase("play");
  };
  const total = hits + misses;

  return (
    <FullscreenStage className="rounded-2xl border border-border p-4 sm:p-6" label="Fullscreen">
      {(isFs) => (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 py-4">
          <div className="flex items-center gap-3 pe-28 text-sm">
            <span className="rounded-full bg-muted px-3 py-1 font-medium">Hits {hits}</span>
            <span className="rounded-full bg-muted px-3 py-1 font-medium">Misses {misses}</span>
            <span className="ms-auto font-mono text-xl font-semibold tabular-nums">{left}s</span>
          </div>
          <div
            onPointerDown={() => phase === "play" && setMisses((m) => m + 1)}
            className="relative w-full select-none overflow-hidden rounded-2xl border border-border bg-muted/40"
            style={{ height: isFs ? "70vh" : 380, cursor: "crosshair", touchAction: "none" }}
          >
            {phase === "play" && (
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setHits((h) => h + 1);
                  setTarget(randomTarget());
                }}
                aria-label="Target"
                className="absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20 transition-transform active:scale-90"
                style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}
              >
                <Crosshair className="h-7 w-7" />
              </button>
            )}
            {phase !== "play" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 text-center">
                {phase === "idle" ? (
                  <>
                    <h3 className="text-2xl font-semibold">Aim trainer</h3>
                    <p className="max-w-sm text-muted-foreground">Click each target as fast as you can for {ROUND} seconds. Best: {best.hits || "–"} hits.</p>
                    <Button size="lg" className="rounded-full px-8" onClick={start}>Start</Button>
                  </>
                ) : (
                  <>
                    <h3 className="text-3xl font-semibold">{hits} hits</h3>
                    <p className="text-muted-foreground">{total ? Math.round((hits / total) * 100) : 0}% accuracy · {hits ? (ROUND / hits).toFixed(2) : "–"}s per target{hits >= best.hits && hits > 0 ? " · new best" : ""}</p>
                    <Button size="lg" onClick={start}><RotateCcw className="h-4 w-4" /> Play again</Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </FullscreenStage>
  );
}

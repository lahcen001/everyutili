"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { randomDigits } from "@/lib/focus/games";

export default function NumberMemory() {
  useTrackTool("number-memory-game");
  const [level, setLevel] = React.useState(1);
  const [digits, setDigits] = React.useState("");
  const [phase, setPhase] = React.useState<"idle" | "show" | "ask" | "right" | "wrong">("idle");
  const [answer, setAnswer] = React.useState("");
  const [best, setBest] = usePersisted<{ level: number }>("everyutili_numbermemory_best", { level: 0 });
  const timer = React.useRef<number | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const begin = (lv: number) => {
    const d = randomDigits(lv + 2);
    setLevel(lv);
    setDigits(d);
    setAnswer("");
    setPhase("show");
    timer.current = window.setTimeout(() => {
      setPhase("ask");
      window.setTimeout(() => input.current?.focus(), 50);
    }, 1200 + lv * 600);
  };

  const submit = () => {
    if (phase !== "ask") return;
    if (answer.trim() === digits) {
      setPhase("right");
      setBest((b) => (level > b.level ? { level } : b));
    } else {
      setPhase("wrong");
      setBest((b) => (level - 1 > b.level ? { level: level - 1 } : b));
    }
  };

  return (
    <FullscreenStage className="rounded-2xl border border-border p-4 sm:p-8" label="Fullscreen">
      {(isFs) => (
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 py-8 text-center">
          <div className="flex w-full items-center justify-between pe-28 text-sm">
            <span className="rounded-full bg-muted px-3 py-1 font-medium">Level {phase === "idle" ? 1 : level}</span>
            <span className="text-muted-foreground">Best level {best.level || "–"}</span>
          </div>
          {phase === "idle" && (
            <>
              <h3 className="text-2xl font-semibold">Number memory</h3>
              <p className="text-muted-foreground">A number flashes on screen. Remember it, then type it back. Each level adds one digit.</p>
              <Button size="lg" className="rounded-full px-8" onClick={() => begin(1)}>Start</Button>
            </>
          )}
          {phase === "show" && <p className={cn("break-all font-mono font-semibold tracking-widest", isFs ? "text-8xl" : "text-6xl")}>{digits}</p>}
          {phase === "ask" && (
            <>
              <p className="text-muted-foreground">What was the number?</p>
              <input ref={input} value={answer} onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && submit()} inputMode="numeric" autoComplete="off" aria-label="Your answer" className="h-16 w-full rounded-2xl border-2 border-primary bg-background text-center font-mono text-3xl tracking-widest outline-none focus:ring-4 focus:ring-primary/20" />
              <Button size="lg" onClick={submit} disabled={!answer}>Submit</Button>
            </>
          )}
          {phase === "right" && (
            <>
              <h3 className="text-2xl font-semibold text-primary">Correct!</h3>
              <p className="font-mono text-3xl tracking-widest">{digits}</p>
              <Button size="lg" onClick={() => begin(level + 1)}>Next level</Button>
            </>
          )}
          {phase === "wrong" && (
            <>
              <h3 className="text-2xl font-semibold text-destructive">Not quite</h3>
              <div className="space-y-1 font-mono text-xl tracking-widest"><p className="text-muted-foreground">You: {answer || "–"}</p><p>Number: {digits}</p></div>
              <p className="text-sm text-muted-foreground">You reached level {level}.</p>
              <Button size="lg" onClick={() => begin(1)}><RotateCcw className="h-4 w-4" /> Try again</Button>
            </>
          )}
        </div>
      )}
    </FullscreenStage>
  );
}

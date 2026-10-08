"use client";

import * as React from "react";
import { Calculator, RotateCcw, Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { accuracy, makeProblem, type Level, type Op, type Problem } from "@/lib/focus/mathquiz";

const OPS: Op[] = ["+", "-", "×", "÷"];
const LEVELS: { id: Level; label: string }[] = [
  { id: 1, label: "Easy" },
  { id: 2, label: "Medium" },
  { id: 3, label: "Hard" },
];
const ROUND_SECONDS = 60;
type Best = Record<string, number>;

export default function MathTrainer() {
  useTrackTool("math-speed-trainer");
  const [ops, setOps] = usePersisted<{ list: Op[]; level: Level }>("everyutili_math_settings", { list: ["+", "-"], level: 1 });
  const [best, setBest] = usePersisted<Best>("everyutili_math_best", {});
  const [phase, setPhase] = React.useState<"idle" | "play" | "done">("idle");
  const [problem, setProblem] = React.useState<Problem | null>(null);
  const [answer, setAnswer] = React.useState("");
  const [correct, setCorrect] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [streak, setStreak] = React.useState(0);
  const [left, setLeft] = React.useState(ROUND_SECONDS);
  const [flash, setFlash] = React.useState<"ok" | "bad" | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const endAt = React.useRef(0);

  const key = `${ops.level}:${[...ops.list].sort().join("")}`;
  const next = React.useCallback(() => {
    const op = ops.list[Math.floor(Math.random() * ops.list.length)];
    setProblem(makeProblem(op, ops.level));
    setAnswer("");
  }, [ops]);

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
    if (phase === "done") setBest((b) => (correct > (b[key] ?? 0) ? { ...b, [key]: correct } : b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = () => {
    endAt.current = Date.now() + ROUND_SECONDS * 1000;
    setCorrect(0);
    setTotal(0);
    setStreak(0);
    setLeft(ROUND_SECONDS);
    setPhase("play");
    next();
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  const submit = () => {
    if (!problem || answer.trim() === "") return;
    const ok = Number(answer) === problem.answer;
    setTotal((t) => t + 1);
    setCorrect((c) => c + (ok ? 1 : 0));
    setStreak((s) => (ok ? s + 1 : 0));
    setFlash(ok ? "ok" : "bad");
    window.setTimeout(() => setFlash(null), 250);
    next();
  };

  const toggleOp = (op: Op) =>
    setOps((o) => {
      const list = o.list.includes(op) ? o.list.filter((x) => x !== op) : [...o.list, op];
      return { ...o, list: list.length ? list : o.list };
    });

  return (
    <FullscreenStage className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-background to-emerald-500/5 p-4 sm:p-8">
      {(isFs) => (
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 py-6 text-center">
          {phase === "idle" && (
            <>
              <Calculator className="h-12 w-12 text-primary" />
              <h3 className="text-2xl font-extrabold">60-second mental maths</h3>
              <div className="space-y-3">
                <div className="flex justify-center gap-2" role="group" aria-label="Operations">
                  {OPS.map((op) => (
                    <button key={op} onClick={() => toggleOp(op)} aria-pressed={ops.list.includes(op)} className={cn("h-12 w-12 rounded-xl border-2 text-xl font-bold", ops.list.includes(op) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                      {op}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center rounded-full bg-muted p-1" role="tablist">
                  {LEVELS.map((l) => (
                    <button key={l.id} role="tab" aria-selected={ops.level === l.id} onClick={() => setOps((o) => ({ ...o, level: l.id }))} className={cn("flex-1 rounded-full px-4 py-1.5 text-sm font-semibold", ops.level === l.id ? "bg-background shadow-sm" : "text-muted-foreground")}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{best[key] ? `Your best for this setting: ${best[key]} correct` : "Answer as many as you can. Press Enter after each answer."}</p>
              <Button size="lg" className="min-w-44 rounded-full" onClick={start}>Start</Button>
            </>
          )}
          {phase === "play" && problem && (
            <>
              <div className="flex w-full items-center justify-between text-sm">
                <span className="rounded-full bg-muted px-3 py-1 font-semibold">Score {correct}</span>
                <span className={cn("font-mono text-2xl font-black tabular-nums", left <= 10 && "text-rose-500")}>{left}s</span>
                <span className="rounded-full bg-muted px-3 py-1 font-semibold">🔥 {streak}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${(left / ROUND_SECONDS) * 100}%` }} />
              </div>
              <p className={cn("font-black tabular-nums transition-colors", isFs ? "text-8xl" : "text-6xl", flash === "ok" && "text-emerald-500", flash === "bad" && "text-rose-500")}>{problem.text}</p>
              <input ref={inputRef} inputMode="numeric" autoComplete="off" value={answer} onChange={(e) => setAnswer(e.target.value.replace(/[^0-9-]/g, ""))} onKeyDown={(e) => e.key === "Enter" && submit()} aria-label="Your answer" placeholder="?" className="h-16 w-48 rounded-2xl border-2 border-primary bg-background text-center text-3xl font-bold focus:outline-none focus:ring-4 focus:ring-primary/20" />
              <Button onClick={submit} disabled={answer === ""}>Answer</Button>
            </>
          )}
          {phase === "done" && (
            <>
              <Trophy className="h-14 w-14 text-amber-500" />
              <h3 className="text-3xl font-extrabold">{correct} correct!</h3>
              <p className="text-muted-foreground">{total} answered · {accuracy(correct, total)}% accuracy{correct > 0 && correct >= (best[key] ?? 0) ? " · new best 🎉" : ""}</p>
              <Button size="lg" onClick={start}>
                <RotateCcw className="h-4 w-4" /> Play again
              </Button>
              <Button variant="ghost" onClick={() => setPhase("idle")}>Change settings</Button>
            </>
          )}
        </div>
      )}
    </FullscreenStage>
  );
}

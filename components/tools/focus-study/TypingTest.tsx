"use client";

import * as React from "react";
import { Keyboard, RotateCcw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { PASSAGES, typingStats } from "@/lib/focus/typing";

interface Result {
  at: number;
  wpm: number;
  accuracy: number;
  seconds: number;
}
const DURATIONS = [30, 60, 120];
const pick = (avoid = "") => {
  const options = PASSAGES.filter((p) => p !== avoid);
  return options[Math.floor(Math.random() * options.length)];
};

export default function TypingTest() {
  useTrackTool("typing-speed-test");
  const [history, setHistory] = usePersisted<Result[]>("everyutili_typing_history", []);
  const [duration, setDuration] = React.useState(60);
  const [target, setTarget] = React.useState(() => pick());
  const [typed, setTyped] = React.useState("");
  const [started, setStarted] = React.useState(false);
  const [left, setLeft] = React.useState(60);
  const [done, setDone] = React.useState(false);
  const [final, setFinal] = React.useState<Result | null>(null);
  const startAt = React.useRef(0);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const finish = React.useCallback(
    (text: string, elapsed: number, tgt: string) => {
      const s = typingStats(text, tgt, elapsed);
      const r: Result = { at: Date.now(), wpm: s.wpm, accuracy: s.accuracy, seconds: Math.round(elapsed) };
      setFinal(r);
      setDone(true);
      if (s.typedChars > 0) setHistory((h) => [r, ...h].slice(0, 20));
    },
    [setHistory]
  );

  React.useEffect(() => {
    if (!started || done) return;
    const id = window.setInterval(() => {
      const t = duration - (Date.now() - startAt.current) / 1000;
      if (t <= 0) {
        setLeft(0);
        finish(typed, duration, target);
      } else setLeft(Math.ceil(t));
    }, 200);
    return () => window.clearInterval(id);
  }, [started, done, duration, typed, target, finish]);

  const reset = (newPassage = true, dur = duration) => {
    setDuration(dur);
    setLeft(dur);
    setTyped("");
    setStarted(false);
    setDone(false);
    setFinal(null);
    if (newPassage) setTarget((t) => pick(t));
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  const onType = (value: string) => {
    if (done) return;
    if (!started) {
      startAt.current = Date.now();
      setStarted(true);
    }
    const text = value.slice(0, target.length);
    setTyped(text);
    if (text.length >= target.length) finish(text, Math.max(1, (Date.now() - startAt.current) / 1000), target);
  };

  const live = typingStats(typed, target, started ? Math.max(1, duration - left) : 1);
  const bestWpm = history.reduce((m, r) => Math.max(m, r.wpm), 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-full bg-muted p-1" role="tablist">
              {DURATIONS.map((d) => (
                <button key={d} role="tab" aria-selected={duration === d} onClick={() => reset(false, d)} className={cn("rounded-full px-3 py-1 text-sm font-semibold", duration === d ? "bg-background shadow-sm" : "text-muted-foreground")}>
                  {d}s
                </button>
              ))}
            </div>
            <div className="ms-auto flex items-center gap-4 text-sm">
              <span><b className="text-lg tabular-nums">{started ? live.wpm : 0}</b> wpm</span>
              <span><b className="text-lg tabular-nums">{live.accuracy}</b>%</span>
              <span className={cn("font-mono text-xl font-black tabular-nums", started && left <= 5 && "text-rose-500")}>{left}s</span>
            </div>
          </div>
          <div className="relative cursor-text rounded-2xl border border-border bg-muted/30 p-5 font-mono text-xl leading-relaxed sm:text-2xl" onClick={() => inputRef.current?.focus()}>
            {target.split("").map((ch, i) => {
              const state = i < typed.length ? (typed[i] === ch ? "ok" : "bad") : i === typed.length ? "cur" : "todo";
              return (
                <span key={i} className={cn(state === "ok" && "text-emerald-600", state === "bad" && "rounded bg-rose-500/20 text-rose-600", state === "cur" && "rounded bg-primary/25 text-foreground", state === "todo" && "text-muted-foreground")}>
                  {ch}
                </span>
              );
            })}
            <textarea ref={inputRef} value={typed} onChange={(e) => onType(e.target.value)} disabled={done} autoFocus spellCheck={false} autoComplete="off" autoCapitalize="off" aria-label="Type the text shown above" className="absolute inset-0 h-full w-full resize-none opacity-0" />
          </div>
          {!started && !done && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Keyboard className="h-4 w-4" /> Click the text and start typing — the timer begins with your first key.</p>}
          {done && final && (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4">
              <div><p className="text-4xl font-black tabular-nums">{final.wpm}</p><p className="text-xs text-muted-foreground">words per minute</p></div>
              <div><p className="text-4xl font-black tabular-nums">{final.accuracy}%</p><p className="text-xs text-muted-foreground">accuracy</p></div>
              <Button className="ms-auto" onClick={() => reset()}><RotateCcw className="h-4 w-4" /> Try again</Button>
            </div>
          )}
          {!done && started && <Button variant="outline" size="sm" onClick={() => reset()}>Restart</Button>}
        </Card>
      </div>
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Your results</h3>
          {history.length > 0 && <button onClick={() => setHistory([])} className="text-xs text-muted-foreground underline-offset-2 hover:underline">Clear</button>}
        </div>
        <p className="text-sm text-muted-foreground">Best: <b className="text-foreground">{bestWpm || "–"}</b> wpm</p>
        <ul className="space-y-1.5">
          {history.length === 0 && <li className="text-sm text-muted-foreground">Finish a test to see it here.</li>}
          {history.slice(0, 10).map((r) => (
            <li key={r.at} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5 text-sm">
              <span className="text-xs text-muted-foreground">{new Date(r.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              <span className="font-semibold tabular-nums">{r.wpm} wpm</span>
              <span className="text-xs text-muted-foreground">{r.accuracy}%</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

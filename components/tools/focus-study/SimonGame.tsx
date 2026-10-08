"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";

const PADS = [
  { id: 0, on: "bg-emerald-500", off: "bg-emerald-500/25", freq: 329.63, name: "Green" },
  { id: 1, on: "bg-rose-500", off: "bg-rose-500/25", freq: 261.63, name: "Red" },
  { id: 2, on: "bg-amber-400", off: "bg-amber-400/25", freq: 392, name: "Yellow" },
  { id: 3, on: "bg-sky-500", off: "bg-sky-500/25", freq: 523.25, name: "Blue" },
];

const pad = () => Math.floor(Math.random() * 4);

export default function SimonGame() {
  useTrackTool("simon-game");
  const [seq, setSeq] = React.useState<number[]>([]);
  const [lit, setLit] = React.useState<number | null>(null);
  const [mode, setMode] = React.useState<"idle" | "show" | "input" | "over">("idle");
  const [progress, setProgress] = React.useState(0);
  const [best, setBest] = usePersisted<{ score: number }>("everyutili_simon_best", { score: 0 });
  const audio = React.useRef<AudioContext | null>(null);
  const timers = React.useRef<number[]>([]);

  const beep = React.useCallback((freq: number, ms = 280) => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audio.current ??= new Ctx();
      const ctx = audio.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + ms / 1000 + 0.05);
    } catch {
      /* audio unavailable */
    }
  }, []);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  React.useEffect(() => clear, []);

  const play = React.useCallback(
    (sequence: number[]) => {
      clear();
      setMode("show");
      setProgress(0);
      const gap = Math.max(260, 600 - sequence.length * 25);
      sequence.forEach((p, i) => {
        timers.current.push(window.setTimeout(() => { setLit(p); beep(PADS[p].freq); }, 700 + i * gap));
        timers.current.push(window.setTimeout(() => setLit(null), 700 + i * gap + gap * 0.6));
      });
      timers.current.push(window.setTimeout(() => setMode("input"), 700 + sequence.length * gap));
    },
    [beep]
  );

  const start = () => {
    const first = [pad()];
    setSeq(first);
    play(first);
  };

  const tap = (id: number) => {
    if (mode !== "input") return;
    setLit(id);
    beep(PADS[id].freq, 200);
    window.setTimeout(() => setLit(null), 180);
    if (id !== seq[progress]) {
      beep(110, 600);
      const score = seq.length - 1;
      setBest((b) => (score > b.score ? { score } : b));
      setMode("over");
      return;
    }
    if (progress + 1 === seq.length) {
      const next = [...seq, pad()];
      setSeq(next);
      timers.current.push(window.setTimeout(() => play(next), 600));
      setMode("show");
    } else setProgress(progress + 1);
  };

  return (
    <FullscreenStage className="rounded-2xl border border-border p-4 sm:p-8" label="Fullscreen">
      {(isFs) => (
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 py-6 text-center">
          <div className="flex w-full items-center justify-between pe-28 text-sm">
            <span className="rounded-full bg-muted px-3 py-1 font-medium">Level {mode === "idle" ? 0 : mode === "over" ? seq.length - 1 : seq.length}</span>
            <span className="text-muted-foreground">Best {best.score}</span>
          </div>
          <div className="grid w-full grid-cols-2 gap-3" style={isFs ? { maxWidth: "min(60vh, 80vw)" } : { maxWidth: 340 }}>
            {PADS.map((p) => (
              <button key={p.id} onClick={() => tap(p.id)} disabled={mode !== "input"} aria-label={p.name} className={cn("aspect-square rounded-3xl transition-all duration-100 active:scale-95", lit === p.id ? `${p.on} scale-[1.03] shadow-lg` : p.off, mode === "input" && "hover:brightness-110")} />
            ))}
          </div>
          <p className="h-6 text-sm text-muted-foreground" aria-live="polite">{mode === "show" ? "Watch the pattern…" : mode === "input" ? `Your turn — ${progress}/${seq.length}` : mode === "over" ? `Game over — you reached level ${seq.length - 1}` : "Repeat the pattern as it grows."}</p>
          {(mode === "idle" || mode === "over") && (
            <Button size="lg" className="min-w-40 rounded-full" onClick={start}>{mode === "over" ? <><RotateCcw className="h-4 w-4" /> Play again</> : "Start"}</Button>
          )}
        </div>
      )}
    </FullscreenStage>
  );
}

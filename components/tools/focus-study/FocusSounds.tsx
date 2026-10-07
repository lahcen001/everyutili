"use client";

import * as React from "react";
import { AudioWaveform, CloudRain, Droplets, Fan, Flame, Headphones, Moon, Waves, Wind, Volume2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { createChannel, type Channel, type SoundId } from "@/lib/focus/soundscape";

const SOUNDS: { id: SoundId; label: string; hint: string; icon: React.ReactNode; color: string }[] = [
  { id: "rain", label: "Rain", hint: "Steady rainfall", icon: <CloudRain className="h-6 w-6" />, color: "from-sky-500/20 to-sky-500/5 text-sky-500" },
  { id: "ocean", label: "Ocean waves", hint: "Slow rolling surf", icon: <Waves className="h-6 w-6" />, color: "from-cyan-500/20 to-cyan-500/5 text-cyan-500" },
  { id: "wind", label: "Wind", hint: "Soft gusts", icon: <Wind className="h-6 w-6" />, color: "from-slate-500/20 to-slate-500/5 text-slate-500" },
  { id: "stream", label: "Stream", hint: "Babbling brook", icon: <Droplets className="h-6 w-6" />, color: "from-teal-500/20 to-teal-500/5 text-teal-500" },
  { id: "fire", label: "Fireplace", hint: "Crackling logs", icon: <Flame className="h-6 w-6" />, color: "from-red-500/20 to-red-500/5 text-red-500" },
  { id: "fan", label: "Fan hum", hint: "Low room tone", icon: <Fan className="h-6 w-6" />, color: "from-amber-500/20 to-amber-500/5 text-amber-500" },
  { id: "brown", label: "Brown noise", hint: "Deep and warm", icon: <AudioWaveform className="h-6 w-6" />, color: "from-orange-500/20 to-orange-500/5 text-orange-500" },
  { id: "pink", label: "Pink noise", hint: "Balanced, natural", icon: <AudioWaveform className="h-6 w-6" />, color: "from-pink-500/20 to-pink-500/5 text-pink-500" },
  { id: "white", label: "White noise", hint: "Masks everything", icon: <AudioWaveform className="h-6 w-6" />, color: "from-zinc-500/20 to-zinc-500/5 text-zinc-500" },
  { id: "alpha", label: "Alpha waves", hint: "10 Hz binaural · use headphones", icon: <Headphones className="h-6 w-6" />, color: "from-violet-500/20 to-violet-500/5 text-violet-500" },
];

const PRESETS: { label: string; mix: Partial<Record<SoundId, number>> }[] = [
  { label: "Deep focus", mix: { brown: 0.5, alpha: 0.25 } },
  { label: "Rainy study", mix: { rain: 0.6, brown: 0.2 } },
  { label: "Cozy fire", mix: { fire: 0.6, rain: 0.25 } },
  { label: "Calm", mix: { ocean: 0.55, wind: 0.2 } },
  { label: "Block distractions", mix: { pink: 0.5, fan: 0.3 } },
];

const TIMERS = [0, 15, 30, 60, 90];

interface Mix {
  volumes: Partial<Record<SoundId, number>>;
  master: number;
}

export default function FocusSounds() {
  useTrackTool("focus-sounds");
  const [mix, setMix] = usePersisted<Mix>("everyutili_focus_sounds", { volumes: {}, master: 0.8 });
  const [playing, setPlaying] = React.useState(false);
  const [sleepMin, setSleepMin] = React.useState(0);
  const [remaining, setRemaining] = React.useState<number | null>(null);

  const ctxRef = React.useRef<AudioContext | null>(null);
  const masterRef = React.useRef<GainNode | null>(null);
  const channels = React.useRef<Map<SoundId, { channel: Channel; gain: GainNode }>>(new Map());
  const sleepEnd = React.useRef<number | null>(null);

  const active = SOUNDS.filter((s) => (mix.volumes[s.id] ?? 0) > 0);

  const ensureContext = () => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = mix.master;
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
    }
    return ctxRef.current;
  };

  // make the running sounds match the mix (add, remove and adjust channels)
  const sync = React.useCallback(
    (volumes: Partial<Record<SoundId, number>>, on: boolean) => {
      const ctx = ctxRef.current;
      const master = masterRef.current;
      if (!ctx || !master) return;
      for (const s of SOUNDS) {
        const v = on ? (volumes[s.id] ?? 0) : 0;
        const existing = channels.current.get(s.id);
        if (v > 0 && !existing) {
          const channel = createChannel(ctx, s.id);
          const gain = ctx.createGain();
          gain.gain.value = 0;
          channel.output.connect(gain).connect(master);
          gain.gain.setTargetAtTime(v, ctx.currentTime, 0.15);
          channels.current.set(s.id, { channel, gain });
        } else if (existing) {
          existing.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.15);
          if (v === 0) {
            window.setTimeout(() => {
              const cur = channels.current.get(s.id);
              if (cur === existing && cur.gain.gain.value < 0.01) {
                cur.channel.stop();
                cur.gain.disconnect();
                channels.current.delete(s.id);
              }
            }, 900);
          }
        }
      }
    },
    []
  );

  const start = async (volumes = mix.volumes) => {
    const ctx = ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
    setPlaying(true);
    sync(volumes, true);
  };
  const stop = React.useCallback(() => {
    setPlaying(false);
    setRemaining(null);
    sleepEnd.current = null;
    sync({}, false);
    masterRef.current?.gain.setTargetAtTime(mix.master, ctxRef.current?.currentTime ?? 0, 0.05);
  }, [sync, mix.master]);

  const setVolume = (id: SoundId, v: number) => {
    const volumes = { ...mix.volumes, [id]: v };
    setMix((m) => ({ ...m, volumes }));
    if (playing) sync(volumes, true);
    else if (v > 0) void start(volumes);
  };
  const setMaster = (v: number) => {
    setMix((m) => ({ ...m, master: v }));
    if (masterRef.current && ctxRef.current) masterRef.current.gain.setTargetAtTime(v, ctxRef.current.currentTime, 0.05);
  };
  const applyPreset = (preset: Partial<Record<SoundId, number>>) => {
    setMix((m) => ({ ...m, volumes: preset }));
    void start(preset);
  };

  // sleep timer: counts down, fades out over the last seconds, then stops
  const setSleep = (min: number) => {
    setSleepMin(min);
    sleepEnd.current = min > 0 ? Date.now() + min * 60000 : null;
    setRemaining(min > 0 ? min * 60 : null);
  };
  React.useEffect(() => {
    if (!playing || sleepEnd.current === null) return;
    const id = window.setInterval(() => {
      if (sleepEnd.current === null) return;
      const left = (sleepEnd.current - Date.now()) / 1000;
      if (left <= 0) {
        stop();
        setSleepMin(0);
      } else {
        setRemaining(left);
        if (left < 8 && masterRef.current && ctxRef.current) masterRef.current.gain.setTargetAtTime(0.0001, ctxRef.current.currentTime, 2);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [playing, sleepMin, stop]);

  React.useEffect(() => {
    const map = channels.current;
    return () => {
      map.forEach(({ channel }) => channel.stop());
      map.clear();
      void ctxRef.current?.close();
    };
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-4 overflow-hidden bg-gradient-to-r from-primary/10 via-transparent to-fuchsia-500/10 p-4">
        <Button size="lg" onClick={() => (playing ? stop() : void start())} disabled={!playing && active.length === 0} className="h-14 min-w-44 rounded-full text-base">
          {playing ? "Stop sounds" : active.length === 0 ? "Pick a sound" : "Play mix"}
        </Button>
        <div className="flex min-w-48 flex-1 items-center gap-3">
          <Volume2 className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input type="range" min={0} max={1} step={0.01} value={mix.master} onChange={(e) => setMaster(Number(e.target.value))} aria-label="Master volume" className="w-full accent-primary" />
          <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">{Math.round(mix.master * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-muted-foreground" />
          <select value={sleepMin} onChange={(e) => setSleep(Number(e.target.value))} aria-label="Sleep timer" className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
            {TIMERS.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "No timer" : `Stop after ${m} min`}
              </option>
            ))}
          </select>
          {remaining !== null && playing && <span className="text-sm font-semibold tabular-nums text-primary">{fmt(remaining)}</span>}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Quick mixes</span>
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p.mix)} className="rounded-full border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary">
            {p.label}
          </button>
        ))}
        {active.length > 0 && (
          <button onClick={() => { setMix((m) => ({ ...m, volumes: {} })); sync({}, false); setPlaying(false); }} className="ml-auto text-sm text-muted-foreground underline-offset-2 hover:underline">
            Clear mix
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {SOUNDS.map((s) => {
          const v = mix.volumes[s.id] ?? 0;
          const on = v > 0;
          return (
            <div key={s.id} className={cn("rounded-2xl border p-4 transition-all", on ? "border-primary/50 bg-gradient-to-br shadow-lg shadow-primary/10 " + s.color : "border-border bg-card")}>
              <button onClick={() => setVolume(s.id, on ? 0 : 0.5)} aria-pressed={on} className="flex w-full items-center gap-3 text-left">
                <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors", on ? "bg-background/70" : "bg-muted text-muted-foreground")}>{s.icon}</span>
                <span className="min-w-0 text-foreground">
                  <span className="block font-semibold">{s.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.hint}</span>
                </span>
              </button>
              <input type="range" min={0} max={1} step={0.01} value={v} onChange={(e) => setVolume(s.id, Number(e.target.value))} aria-label={`${s.label} volume`} className="mt-3 w-full accent-primary" />
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">All sounds are generated live in your browser — nothing is downloaded or streamed. Your mix is remembered on this device.</p>
    </div>
  );
}

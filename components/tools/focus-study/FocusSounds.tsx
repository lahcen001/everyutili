"use client";

import * as React from "react";
import {
  AudioWaveform,
  Bell,
  Bird,
  Bookmark,
  Brain,
  Bug,
  CloudLightning,
  CloudRain,
  Coffee,
  Droplets,
  Fan,
  Fish,
  Flame,
  Headphones,
  HeartPulse,
  Keyboard,
  Mountain,
  Moon,
  Pause,
  Play,
  Save,
  Shuffle,
  SlidersHorizontal,
  TrainFront,
  Trash2,
  Volume2,
  Waves,
  Wind,
  Clock,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { createChannel, type Channel, type SoundId } from "@/lib/focus/soundscape";

type Category = "nature" | "noise" | "rooms" | "beats";

const SOUNDS: { id: SoundId; label: string; hint: string; cat: Category; icon: React.ReactNode }[] = [
  { id: "rain", label: "Rain", hint: "Steady rainfall", cat: "nature", icon: <CloudRain className="h-5 w-5" /> },
  { id: "thunder", label: "Thunder", hint: "Distant rolling storm", cat: "nature", icon: <CloudLightning className="h-5 w-5" /> },
  { id: "ocean", label: "Ocean waves", hint: "Slow rolling surf", cat: "nature", icon: <Waves className="h-5 w-5" /> },
  { id: "wind", label: "Wind", hint: "Soft gusts", cat: "nature", icon: <Wind className="h-5 w-5" /> },
  { id: "stream", label: "Stream", hint: "Babbling brook", cat: "nature", icon: <Droplets className="h-5 w-5" /> },
  { id: "waterfall", label: "Waterfall", hint: "Broad, steady roar", cat: "nature", icon: <Mountain className="h-5 w-5" /> },
  { id: "fire", label: "Fireplace", hint: "Crackling logs", cat: "nature", icon: <Flame className="h-5 w-5" /> },
  { id: "birds", label: "Forest birds", hint: "Morning birdsong", cat: "nature", icon: <Bird className="h-5 w-5" /> },
  { id: "crickets", label: "Night crickets", hint: "Summer evening", cat: "nature", icon: <Bug className="h-5 w-5" /> },
  { id: "underwater", label: "Underwater", hint: "Muffled and calm", cat: "nature", icon: <Fish className="h-5 w-5" /> },
  { id: "white", label: "White noise", hint: "Masks everything", cat: "noise", icon: <AudioWaveform className="h-5 w-5" /> },
  { id: "pink", label: "Pink noise", hint: "Balanced, natural", cat: "noise", icon: <AudioWaveform className="h-5 w-5" /> },
  { id: "brown", label: "Brown noise", hint: "Deep and warm", cat: "noise", icon: <AudioWaveform className="h-5 w-5" /> },
  { id: "cafe", label: "Café", hint: "Murmur and cups", cat: "rooms", icon: <Coffee className="h-5 w-5" /> },
  { id: "train", label: "Train ride", hint: "Rumble and rhythm", cat: "rooms", icon: <TrainFront className="h-5 w-5" /> },
  { id: "fan", label: "Fan hum", hint: "Low room tone", cat: "rooms", icon: <Fan className="h-5 w-5" /> },
  { id: "clock", label: "Ticking clock", hint: "Tick, tock", cat: "rooms", icon: <Clock className="h-5 w-5" /> },
  { id: "keyboard", label: "Keyboard", hint: "Quiet typing", cat: "rooms", icon: <Keyboard className="h-5 w-5" /> },
  { id: "heartbeat", label: "Heartbeat", hint: "Slow and steady", cat: "rooms", icon: <HeartPulse className="h-5 w-5" /> },
  { id: "drone", label: "Singing bowl", hint: "Warm, humming drone", cat: "beats", icon: <Bell className="h-5 w-5" /> },
  { id: "delta", label: "Delta 2 Hz", hint: "Deep sleep · headphones", cat: "beats", icon: <Headphones className="h-5 w-5" /> },
  { id: "theta", label: "Theta 6 Hz", hint: "Meditation · headphones", cat: "beats", icon: <Headphones className="h-5 w-5" /> },
  { id: "alpha", label: "Alpha 10 Hz", hint: "Calm focus · headphones", cat: "beats", icon: <Headphones className="h-5 w-5" /> },
  { id: "beta", label: "Beta 18 Hz", hint: "Alert focus · headphones", cat: "beats", icon: <Brain className="h-5 w-5" /> },
  { id: "gamma", label: "Gamma 40 Hz", hint: "Peak focus · headphones", cat: "beats", icon: <Brain className="h-5 w-5" /> },
];

const CATEGORIES: { id: Category | "all" | "mine"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "Playing" },
  { id: "nature", label: "Nature" },
  { id: "noise", label: "Noise" },
  { id: "rooms", label: "Rooms & objects" },
  { id: "beats", label: "Tones & beats" },
];

type Volumes = Partial<Record<SoundId, number>>;

const PRESETS: { label: string; mix: Volumes }[] = [
  { label: "Deep focus", mix: { brown: 0.5, alpha: 0.2 } },
  { label: "Rainy study", mix: { rain: 0.6, brown: 0.2 } },
  { label: "Thunderstorm", mix: { rain: 0.5, thunder: 0.6, wind: 0.15 } },
  { label: "Forest morning", mix: { birds: 0.5, stream: 0.35, wind: 0.15 } },
  { label: "Café study", mix: { cafe: 0.55, rain: 0.15 } },
  { label: "Train journey", mix: { train: 0.6, rain: 0.15 } },
  { label: "Cozy fire", mix: { fire: 0.6, rain: 0.25 } },
  { label: "Night camp", mix: { crickets: 0.5, fire: 0.35, wind: 0.1 } },
  { label: "Calm", mix: { ocean: 0.55, wind: 0.2 } },
  { label: "Deep sleep", mix: { brown: 0.3, delta: 0.2, ocean: 0.3 } },
  { label: "Meditation", mix: { drone: 0.5, theta: 0.2, stream: 0.2 } },
  { label: "Block distractions", mix: { pink: 0.5, fan: 0.3 } },
];

const TIMERS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180];
const FADES = [0, 1, 3, 6, 10];

interface Settings {
  volumes: Volumes;
  master: number;
  bass: number;
  treble: number;
  warmth: number;
  fade: number;
  saved: { name: string; volumes: Volumes }[];
}

const DEFAULTS: Settings = { volumes: {}, master: 0.8, bass: 0, treble: 0, warmth: 100, fade: 1, saved: [] };

/** A random blend of two to four non-beat sounds at gentle volumes. */
function randomMix(): Volumes {
  const pool = SOUNDS.filter((s) => s.cat !== "beats" || s.id === "drone");
  const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 3));
  const mix: Volumes = {};
  picks.forEach((s) => (mix[s.id] = Math.round((0.25 + Math.random() * 0.4) * 100) / 100));
  return mix;
}

const warmthHz = (w: number) => 800 * Math.pow(22000 / 800, w / 100);

export default function FocusSounds() {
  useTrackTool("focus-sounds");
  const [settings, setSettings] = usePersisted<Settings>("everyutili_focus_sounds", DEFAULTS);
  const [playing, setPlaying] = React.useState(false);
  const [sleepMin, setSleepMin] = React.useState(0);
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [filter, setFilter] = React.useState<(typeof CATEGORIES)[number]["id"]>("all");
  const [mixName, setMixName] = React.useState("");
  const [showTone, setShowTone] = React.useState(false);

  const ctxRef = React.useRef<AudioContext | null>(null);
  const nodes = React.useRef<{ master: GainNode; bass: BiquadFilterNode; treble: BiquadFilterNode; tone: BiquadFilterNode; analyser: AnalyserNode } | null>(null);
  const channels = React.useRef<Map<SoundId, { channel: Channel; gain: GainNode }>>(new Map());
  const sleepEnd = React.useRef<number | null>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);

  const { volumes } = settings;
  const active = SOUNDS.filter((s) => (volumes[s.id] ?? 0) > 0);
  const shown = SOUNDS.filter((s) => (filter === "all" ? true : filter === "mine" ? (volumes[s.id] ?? 0) > 0 : s.cat === filter));

  const ensureContext = () => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = settings.master;
      const bass = ctx.createBiquadFilter();
      bass.type = "lowshelf";
      bass.frequency.value = 200;
      bass.gain.value = settings.bass;
      const treble = ctx.createBiquadFilter();
      treble.type = "highshelf";
      treble.frequency.value = 3500;
      treble.gain.value = settings.treble;
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = warmthHz(settings.warmth);
      tone.Q.value = 0.5;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      master.connect(bass).connect(treble).connect(tone).connect(analyser).connect(ctx.destination);
      ctxRef.current = ctx;
      nodes.current = { master, bass, treble, tone, analyser };
    }
    return ctxRef.current;
  };

  // make the running sounds match the mix (add, remove and adjust channels)
  const sync = React.useCallback((vols: Volumes, on: boolean) => {
    const ctx = ctxRef.current;
    const n = nodes.current;
    if (!ctx || !n) return;
    for (const s of SOUNDS) {
      const v = on ? (vols[s.id] ?? 0) : 0;
      const existing = channels.current.get(s.id);
      if (v > 0 && !existing) {
        const channel = createChannel(ctx, s.id);
        const gain = ctx.createGain();
        gain.gain.value = 0;
        channel.output.connect(gain).connect(n.master);
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
  }, []);

  const start = async (vols: Volumes = volumes) => {
    const ctx = ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
    const n = nodes.current!;
    n.master.gain.cancelScheduledValues(ctx.currentTime);
    if (settings.fade > 0 && !playing) {
      n.master.gain.setValueAtTime(0.0001, ctx.currentTime);
      n.master.gain.linearRampToValueAtTime(Math.max(0.0001, settings.master), ctx.currentTime + settings.fade);
    } else n.master.gain.setTargetAtTime(settings.master, ctx.currentTime, 0.05);
    setPlaying(true);
    sync(vols, true);
  };

  const stop = React.useCallback(() => {
    const ctx = ctxRef.current;
    const n = nodes.current;
    setPlaying(false);
    setRemaining(null);
    sleepEnd.current = null;
    if (ctx && n) {
      const fadeS = Math.max(0.25, settings.fade);
      n.master.gain.cancelScheduledValues(ctx.currentTime);
      n.master.gain.setTargetAtTime(0.0001, ctx.currentTime, fadeS / 3);
      window.setTimeout(() => {
        sync({}, false);
        n.master.gain.setValueAtTime(settings.master, ctx.currentTime);
      }, fadeS * 1000 + 200);
    }
  }, [settings.fade, settings.master, sync]);

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  const setVolume = (id: SoundId, v: number) => {
    const next = { ...volumes, [id]: v };
    update({ volumes: next });
    if (playing) sync(next, true);
    else if (v > 0) void start(next);
  };
  const setMaster = (v: number) => {
    update({ master: v });
    const ctx = ctxRef.current;
    if (nodes.current && ctx && playing) nodes.current.master.gain.setTargetAtTime(Math.max(0.0001, v), ctx.currentTime, 0.05);
  };
  const setTone = (key: "bass" | "treble" | "warmth", v: number) => {
    update({ [key]: v });
    const ctx = ctxRef.current;
    const n = nodes.current;
    if (!ctx || !n) return;
    if (key === "bass") n.bass.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    if (key === "treble") n.treble.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    if (key === "warmth") n.tone.frequency.setTargetAtTime(warmthHz(v), ctx.currentTime, 0.05);
  };
  const applyMix = (mix: Volumes) => {
    update({ volumes: mix });
    void start(mix);
  };
  const surprise = () => applyMix(randomMix());
  const saveMix = () => {
    const name = mixName.trim();
    if (!name || active.length === 0) return;
    update({ saved: [...settings.saved.filter((m) => m.name !== name), { name, volumes }].slice(-12) });
    setMixName("");
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
        const ctx = ctxRef.current;
        if (left < 10 && nodes.current && ctx) nodes.current.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 2.5);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [playing, sleepMin, stop]);

  // live level meter
  React.useEffect(() => {
    if (!playing) return;
    const c = canvas.current;
    const analyser = nodes.current?.analyser;
    const ctx2d = c?.getContext("2d");
    if (!c || !analyser || !ctx2d) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    const draw = () => {
      analyser.getByteFrequencyData(data);
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== w * dpr) {
        c.width = w * dpr;
        c.height = h * dpr;
      }
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, w, h);
      ctx2d.fillStyle = getComputedStyle(c).color;
      const bars = 40;
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor((i / bars) * data.length * 0.7)] / 255;
        const bh = Math.max(2, v * h);
        ctx2d.globalAlpha = 0.35 + v * 0.65;
        ctx2d.fillRect(i * bw + 1, h - bh, bw - 2, bh);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  // Space = play / pause
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key !== " " || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      e.preventDefault();
      if (playing) stop();
      else if (active.length > 0) void start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, active.length, stop]);

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
      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Button size="lg" onClick={() => (playing ? stop() : void start())} disabled={!playing && active.length === 0} className="h-14 min-w-44 rounded-full text-base">
            {playing ? <><Pause className="h-5 w-5" /> Pause sounds</> : <><Play className="h-5 w-5" /> {active.length === 0 ? "Pick a sound" : "Play mix"}</>}
          </Button>
          <div className="flex min-w-48 flex-1 items-center gap-3">
            <Volume2 className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input type="range" min={0} max={1} step={0.01} value={settings.master} onChange={(e) => setMaster(Number(e.target.value))} aria-label="Master volume" className="w-full accent-primary" />
            <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">{Math.round(settings.master * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <select value={sleepMin} onChange={(e) => setSleep(Number(e.target.value))} aria-label="Sleep timer" className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
              {TIMERS.map((m) => (
                <option key={m} value={m}>{m === 0 ? "No timer" : m >= 60 && m % 60 === 0 ? `Stop after ${m / 60} h` : `Stop after ${m} min`}</option>
              ))}
            </select>
            {remaining !== null && playing && <span className="text-sm font-semibold tabular-nums text-primary">{fmt(remaining)}</span>}
          </div>
        </div>
        <canvas ref={canvas} className={cn("h-12 w-full text-primary transition-opacity", playing ? "opacity-100" : "opacity-20")} aria-hidden />
        {active.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Playing: {active.map((s) => s.label).join(" · ")}
          </p>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Quick mixes</span>
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyMix(p.mix)} className="rounded-full border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary">{p.label}</button>
        ))}
        <button onClick={surprise} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/50 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5"><Shuffle className="h-3.5 w-3.5" /> Surprise me</button>
        {active.length > 0 && (
          <button onClick={() => { update({ volumes: {} }); sync({}, false); setPlaying(false); }} className="ml-auto text-sm text-muted-foreground underline-offset-2 hover:underline">Clear mix</button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-full bg-muted p-1" role="tablist" aria-label="Sound type">
          {CATEGORIES.map((c) => (
            <button key={c.id} role="tab" aria-selected={filter === c.id} onClick={() => setFilter(c.id)} className={cn("rounded-full px-3 py-1 text-sm font-medium", filter === c.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {c.label}{c.id === "mine" && active.length > 0 ? ` (${active.length})` : ""}
            </button>
          ))}
        </div>
        <Button size="sm" variant={showTone ? "default" : "outline"} className="ml-auto" onClick={() => setShowTone((v) => !v)}>
          <SlidersHorizontal className="h-3.5 w-3.5" /> Tone & fade
        </Button>
      </div>

      {showTone && (
        <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["bass", "Bass", -12, 12, 1, " dB"],
            ["treble", "Treble", -12, 12, 1, " dB"],
            ["warmth", "Brightness", 0, 100, 1, "%"],
          ] as const).map(([key, label, min, max, step, unit]) => (
            <label key={key} className="block space-y-1">
              <span className="flex justify-between text-sm"><span className="font-medium">{label}</span><span className="tabular-nums text-muted-foreground">{settings[key]}{unit}</span></span>
              <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={(e) => setTone(key, Number(e.target.value))} aria-label={label} className="w-full accent-primary" />
            </label>
          ))}
          <label className="block space-y-1">
            <span className="flex justify-between text-sm"><span className="font-medium">Fade in / out</span><span className="tabular-nums text-muted-foreground">{settings.fade}s</span></span>
            <select value={settings.fade} onChange={(e) => update({ fade: Number(e.target.value) })} aria-label="Fade time" className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm">
              {FADES.map((f) => <option key={f} value={f}>{f === 0 ? "None" : `${f} seconds`}</option>)}
            </select>
          </label>
          <button onClick={() => { setTone("bass", 0); setTone("treble", 0); setTone("warmth", 100); }} className="text-left text-xs text-muted-foreground underline-offset-2 hover:underline sm:col-span-2 lg:col-span-4">Reset tone</button>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {shown.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Nothing is playing yet — pick a sound from the other tabs.</p>}
        {shown.map((s) => {
          const v = volumes[s.id] ?? 0;
          const on = v > 0;
          return (
            <div key={s.id} className={cn("rounded-2xl border p-3.5 transition-all", on ? "border-primary/60 bg-primary/5 shadow-sm" : "border-border bg-card")}>
              <button onClick={() => setVolume(s.id, on ? 0 : 0.5)} aria-pressed={on} className="flex w-full items-center gap-3 text-left">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{s.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{s.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.hint}</span>
                </span>
              </button>
              <input type="range" min={0} max={1} step={0.01} value={v} onChange={(e) => setVolume(s.id, Number(e.target.value))} aria-label={`${s.label} volume`} className="mt-3 w-full accent-primary" />
            </div>
          );
        })}
      </div>

      <Card className="space-y-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Bookmark className="h-4 w-4 text-primary" /> Your saved mixes</h3>
        <div className="flex flex-wrap gap-2">
          <input value={mixName} onChange={(e) => setMixName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveMix()} placeholder="Name this mix" maxLength={30} aria-label="Mix name" className="h-9 min-w-40 flex-1 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <Button size="sm" onClick={saveMix} disabled={!mixName.trim() || active.length === 0}><Save className="h-3.5 w-3.5" /> Save current mix</Button>
        </div>
        {settings.saved.length === 0 ? (
          <p className="text-xs text-muted-foreground">Build a mix, give it a name and it will be kept here on this device.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {settings.saved.map((m) => (
              <span key={m.name} className="inline-flex items-center overflow-hidden rounded-full border border-border bg-muted/40">
                <button onClick={() => applyMix(m.volumes)} className="px-3 py-1.5 text-sm font-medium hover:bg-muted">{m.name}</button>
                <button onClick={() => update({ saved: settings.saved.filter((x) => x.name !== m.name) })} aria-label={`Delete ${m.name}`} className="px-2 py-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">All sounds are generated live in your browser — nothing is downloaded or streamed. Space plays or pauses. Binaural beats need headphones. Your mix and settings are remembered on this device.</p>
    </div>
  );
}

"use client";

import * as React from "react";
import { Bell, BellOff, Coffee, Flame, Pause, Play, RotateCcw, SkipForward, Target, Volume2, VolumeX } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { playChime } from "@/lib/focus/chime";
import { DEFAULT_SETTINGS, addSession, dayKey, formatClock, lastDays, nextPhase, phaseSeconds, type Phase, type PomodoroSettings, type StatsByDay } from "@/lib/focus/pomodoro";

const PHASES: { id: Phase; label: string; color: string; ring: string }[] = [
  { id: "focus", label: "Focus", color: "text-rose-500", ring: "#f43f5e" },
  { id: "short", label: "Short break", color: "text-emerald-500", ring: "#10b981" },
  { id: "long", label: "Long break", color: "text-sky-500", ring: "#0ea5e9" },
];

interface Prefs {
  settings: PomodoroSettings;
  autoStart: boolean;
  sound: boolean;
  notify: boolean;
  task: string;
}
const DEFAULT_PREFS: Prefs = { settings: DEFAULT_SETTINGS, autoStart: true, sound: true, notify: false, task: "" };

const clampNum = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v) || min));

export default function PomodoroTimer() {
  useTrackTool("pomodoro-timer");
  const [prefs, setPrefs] = usePersisted<Prefs>("everyutili_pomodoro_prefs", DEFAULT_PREFS);
  const [stats, setStats] = usePersisted<StatsByDay>("everyutili_pomodoro_stats", {});
  const { settings } = prefs;

  const [phase, setPhase] = React.useState<Phase>("focus");
  const [running, setRunning] = React.useState(false);
  const [remaining, setRemaining] = React.useState(() => phaseSeconds("focus", settings));
  const [cycle, setCycle] = React.useState(0); // focus sessions finished in this run
  const endAt = React.useRef(0);

  const total = phaseSeconds(phase, settings);
  const meta = PHASES.find((p) => p.id === phase)!;
  const today = stats[dayKey()] ?? { sessions: 0, minutes: 0 };
  const week = lastDays(stats, 7);
  const weekMax = Math.max(1, ...week.map((d) => d.minutes));

  const goTo = React.useCallback(
    (next: Phase, start: boolean) => {
      setPhase(next);
      const secs = phaseSeconds(next, settings);
      setRemaining(secs);
      endAt.current = Date.now() + secs * 1000;
      setRunning(start);
    },
    [settings]
  );

  const finish = React.useCallback(() => {
    const finishedFocus = phase === "focus";
    const done = finishedFocus ? cycle + 1 : cycle;
    if (finishedFocus) {
      setCycle(done);
      setStats((s) => addSession(s, settings.focusMin));
    }
    if (prefs.sound) playChime();
    const next = nextPhase(phase, done, settings);
    if (prefs.notify && typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(finishedFocus ? "Focus session complete" : "Break is over", { body: finishedFocus ? `Time for a ${next === "long" ? "long" : "short"} break.` : "Ready for the next focus session?" });
    }
    goTo(next, prefs.autoStart);
  }, [phase, cycle, settings, prefs.sound, prefs.notify, prefs.autoStart, goTo, setStats]);

  // the clock: derived from an end timestamp so it stays accurate in background tabs
  React.useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const left = (endAt.current - Date.now()) / 1000;
      if (left <= 0) finish();
      else setRemaining(left);
    }, 250);
    return () => window.clearInterval(id);
  }, [running, finish]);

  // show the countdown in the browser tab title
  React.useEffect(() => {
    const original = document.title;
    if (running) document.title = `${formatClock(remaining)} · ${meta.label}`;
    return () => {
      document.title = original;
    };
  }, [running, remaining, meta.label]);

  const toggle = () => {
    if (running) {
      setRunning(false);
    } else {
      endAt.current = Date.now() + remaining * 1000;
      setRunning(true);
    }
  };
  const reset = () => {
    setRunning(false);
    setRemaining(total);
  };
  const choose = (p: Phase) => goTo(p, false);

  const update = (patch: Partial<PomodoroSettings>) => {
    const next = { ...settings, ...patch };
    setPrefs((p) => ({ ...p, settings: next }));
    if (!running) setRemaining(phaseSeconds(phase, next));
  };

  const toggleNotify = async () => {
    if (!prefs.notify && typeof Notification !== "undefined" && Notification.permission === "default") {
      const res = await Notification.requestPermission();
      if (res !== "granted") return;
    }
    if (!prefs.notify && typeof Notification !== "undefined" && Notification.permission === "denied") return;
    setPrefs((p) => ({ ...p, notify: !p.notify }));
  };

  const progress = 1 - remaining / total;
  const R = 130;
  const C = 2 * Math.PI * R;
  const filled = phase === "long" ? settings.longEvery : cycle % settings.longEvery;
  const dots = Array.from({ length: settings.longEvery }, (_, i) => i < filled);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <FullscreenStage className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-background to-fuchsia-500/5 p-6" label="Focus mode">
          {(isFs) => (
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="flex rounded-full bg-muted p-1" role="tablist">
                {PHASES.map((p) => (
                  <button key={p.id} role="tab" aria-selected={phase === p.id} onClick={() => choose(p.id)} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition-colors", phase === p.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground", phase === p.id && p.color)}>
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="relative" style={{ width: isFs ? "min(70vh, 80vw)" : 300, height: isFs ? "min(70vh, 80vw)" : 300 }}>
                <svg viewBox="0 0 300 300" className="h-full w-full -rotate-90">
                  <circle cx="150" cy="150" r={R} fill="none" stroke="currentColor" strokeWidth="12" className="text-muted" />
                  <circle cx="150" cy="150" r={R} fill="none" stroke={meta.ring} strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: running ? "stroke-dashoffset .3s linear" : "none", filter: `drop-shadow(0 0 8px ${meta.ring}66)` }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn("font-mono font-black tabular-nums tracking-tight", isFs ? "text-[min(18vh,16vw)]" : "text-6xl")} role="timer" aria-live="off">
                    {formatClock(remaining)}
                  </span>
                  <span className={cn("mt-1 text-sm font-semibold uppercase tracking-widest", meta.color)}>{meta.label}</span>
                  {prefs.task && phase === "focus" && <span className="mt-2 max-w-[70%] truncate text-sm text-muted-foreground">{prefs.task}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1.5" aria-label={`${filled} of ${settings.longEvery} sessions before a long break`}>
                {dots.map((on, i) => (
                  <span key={i} className={cn("h-2.5 w-2.5 rounded-full transition-colors", on ? "bg-rose-500" : "bg-muted")} />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={reset} aria-label="Reset">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button size="lg" onClick={toggle} className="h-14 min-w-40 rounded-full text-base">
                  {running ? (
                    <>
                      <Pause className="h-5 w-5" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" /> {remaining < total ? "Resume" : "Start"}
                    </>
                  )}
                </Button>
                <Button variant="outline" size="icon" onClick={() => goTo(nextPhase(phase, phase === "focus" ? cycle + 1 : cycle, settings), false)} aria-label="Skip to next">
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </FullscreenStage>

        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <label className="block space-y-1.5">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Target className="h-4 w-4 text-primary" /> What are you working on?
              </span>
              <input value={prefs.task} onChange={(e) => setPrefs((p) => ({ ...p, task: e.target.value }))} placeholder="e.g. Chapter 4 revision" maxLength={80} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </label>
          </Card>

          <Card className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">Today</h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-rose-500/10 p-3">
                <Flame className="mx-auto h-5 w-5 text-rose-500" />
                <p className="mt-1 text-2xl font-extrabold tabular-nums">{today.sessions}</p>
                <p className="text-xs text-muted-foreground">sessions</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-3">
                <Coffee className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-1 text-2xl font-extrabold tabular-nums">{today.minutes >= 60 ? `${Math.floor(today.minutes / 60)}h ${today.minutes % 60}m` : `${today.minutes}m`}</p>
                <p className="text-xs text-muted-foreground">focused</p>
              </div>
            </div>
            <div className="flex h-20 items-end gap-1.5" aria-label="Focused minutes in the last 7 days">
              {week.map((d) => (
                <div key={d.key} className="flex flex-1 flex-col items-center gap-1" title={`${d.key}: ${d.minutes} min`}>
                  <div className="flex w-full flex-1 items-end">
                    <div className={cn("w-full rounded-t-md", d.key === dayKey() ? "bg-rose-500" : "bg-primary/40")} style={{ height: `${Math.max(4, (d.minutes / weekMax) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{["S", "M", "T", "W", "T", "F", "S"][new Date(d.key + "T00:00").getDay()]}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">Settings</h3>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["focusMin", "Focus (min)", 1, 180],
                  ["shortMin", "Short break", 1, 60],
                  ["longMin", "Long break", 1, 90],
                  ["longEvery", "Long break every", 2, 10],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key} className="space-y-1 text-xs font-medium text-muted-foreground">
                  {label}
                  <input type="number" min={min} max={max} value={settings[key]} onChange={(e) => update({ [key]: clampNum(Number(e.target.value), min, max) })} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </label>
              ))}
            </div>
            <div className="space-y-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={prefs.autoStart} onChange={(e) => setPrefs((p) => ({ ...p, autoStart: e.target.checked }))} className="h-4 w-4 accent-primary" /> Start the next session automatically
              </label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={prefs.sound ? "default" : "outline"} onClick={() => setPrefs((p) => ({ ...p, sound: !p.sound }))}>
                  {prefs.sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} Sound
                </Button>
                <Button size="sm" variant={prefs.notify ? "default" : "outline"} onClick={() => void toggleNotify()}>
                  {prefs.notify ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />} Notifications
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                ["Classic 25/5", { focusMin: 25, shortMin: 5, longMin: 15 }],
                ["Deep work 50/10", { focusMin: 50, shortMin: 10, longMin: 30 }],
                ["Short 15/3", { focusMin: 15, shortMin: 3, longMin: 10 }],
              ].map(([label, patch]) => (
                <button key={label as string} onClick={() => update(patch as Partial<PomodoroSettings>)} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:border-primary hover:text-primary">
                  {label as string}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

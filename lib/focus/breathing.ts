export type BreathPhase = "inhale" | "hold" | "exhale" | "rest";

export interface BreathStep {
  phase: BreathPhase;
  seconds: number;
}

export interface BreathPattern {
  id: string;
  name: string;
  hint: string;
  steps: BreathStep[];
}

export const PATTERNS: BreathPattern[] = [
  { id: "box", name: "Box breathing", hint: "4-4-4-4 · steady and focused", steps: [{ phase: "inhale", seconds: 4 }, { phase: "hold", seconds: 4 }, { phase: "exhale", seconds: 4 }, { phase: "rest", seconds: 4 }] },
  { id: "478", name: "4-7-8", hint: "Deep calm · good before sleep", steps: [{ phase: "inhale", seconds: 4 }, { phase: "hold", seconds: 7 }, { phase: "exhale", seconds: 8 }] },
  { id: "coherent", name: "Coherent 5-5", hint: "Even and gentle", steps: [{ phase: "inhale", seconds: 5 }, { phase: "exhale", seconds: 5 }] },
  { id: "relax", name: "Long exhale", hint: "4 in · 6 out · releases tension", steps: [{ phase: "inhale", seconds: 4 }, { phase: "exhale", seconds: 6 }] },
];

export const cycleSeconds = (p: BreathPattern): number => p.steps.reduce((s, x) => s + x.seconds, 0);

export interface PhaseAt {
  phase: BreathPhase;
  /** 0..1 progress through the current step */
  progress: number;
  /** seconds left in the current step */
  remaining: number;
  cycle: number;
  /** circle size 0 (empty lungs) .. 1 (full) */
  size: number;
}

/** Where we are in the pattern after `elapsed` seconds. */
export function phaseAt(elapsed: number, p: BreathPattern): PhaseAt {
  const total = cycleSeconds(p);
  const cycle = Math.floor(elapsed / total);
  let t = elapsed - cycle * total;
  let prevSize = 0;
  for (const step of p.steps) {
    if (t < step.seconds) {
      const progress = t / step.seconds;
      const size = step.phase === "inhale" ? progress : step.phase === "exhale" ? 1 - progress : prevSize;
      return { phase: step.phase, progress, remaining: step.seconds - t, cycle, size };
    }
    t -= step.seconds;
    prevSize = step.phase === "inhale" || step.phase === "hold" ? 1 : 0;
  }
  return { phase: "rest", progress: 1, remaining: 0, cycle, size: 0 };
}

export const PHASE_LABEL: Record<BreathPhase, string> = { inhale: "Breathe in", hold: "Hold", exhale: "Breathe out", rest: "Rest" };

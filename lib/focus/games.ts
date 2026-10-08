type Rand = () => number;

/** The numbers 1..n² in a random order, for a Schulte table. */
export function makeSchulte(size: number, rand: Rand = Math.random): number[] {
  const cells = Array.from({ length: size * size }, (_, i) => i + 1);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

export const STROOP_COLORS = [
  { id: "red", label: "RED", css: "#ef4444" },
  { id: "blue", label: "BLUE", css: "#3b82f6" },
  { id: "green", label: "GREEN", css: "#22c55e" },
  { id: "yellow", label: "YELLOW", css: "#eab308" },
] as const;

export interface StroopTrial {
  /** the word that is shown */
  word: (typeof STROOP_COLORS)[number];
  /** the colour it is printed in (the correct answer) */
  ink: (typeof STROOP_COLORS)[number];
}

/** A word printed in a colour; about 3 in 4 trials deliberately use a different colour than the word says. */
export function makeStroopTrial(rand: Rand = Math.random): StroopTrial {
  const word = STROOP_COLORS[Math.floor(rand() * STROOP_COLORS.length)];
  if (rand() < 0.25) return { word, ink: word };
  const others = STROOP_COLORS.filter((c) => c.id !== word.id);
  return { word, ink: others[Math.floor(rand() * others.length)] };
}

/** A sequence of grid positions (0–8) in which roughly `matchRate` of the places repeat the position n steps earlier. */
export function makeNBackSequence(length: number, n: number, rand: Rand = Math.random, matchRate = 0.3): number[] {
  const seq: number[] = [];
  for (let i = 0; i < length; i++) {
    if (i >= n && rand() < matchRate) seq.push(seq[i - n]);
    else {
      let p = Math.floor(rand() * 9);
      if (i >= n && p === seq[i - n]) p = (p + 1 + Math.floor(rand() * 8)) % 9;
      seq.push(p);
    }
  }
  return seq;
}

export const isNBackMatch = (seq: number[], i: number, n: number): boolean => i >= n && seq[i] === seq[i - n];

export interface NBackScore {
  hits: number;
  misses: number;
  falseAlarms: number;
  correctRejections: number;
  /** 0–100 */
  accuracy: number;
}

export function scoreNBack(seq: number[], n: number, pressed: boolean[]): NBackScore {
  let hits = 0, misses = 0, falseAlarms = 0, correctRejections = 0;
  for (let i = 0; i < seq.length; i++) {
    const match = isNBackMatch(seq, i, n);
    if (match && pressed[i]) hits += 1;
    else if (match) misses += 1;
    else if (pressed[i]) falseAlarms += 1;
    else correctRejections += 1;
  }
  return { hits, misses, falseAlarms, correctRejections, accuracy: seq.length ? Math.round(((hits + correctRejections) / seq.length) * 100) : 0 };
}

/** A string of random digits (no leading zero). */
export function randomDigits(length: number, rand: Rand = Math.random): string {
  let s = String(1 + Math.floor(rand() * 9));
  while (s.length < length) s += String(Math.floor(rand() * 10));
  return s;
}

/** A random position for an aim-trainer target, kept `margin` away from the edges (all values 0–1). */
export function randomTarget(rand: Rand = Math.random, margin = 0.08): { x: number; y: number } {
  return { x: margin + rand() * (1 - 2 * margin), y: margin + rand() * (1 - 2 * margin) };
}

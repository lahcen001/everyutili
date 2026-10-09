/** Pure Sudoku logic: generation (unique solution), solving, conflicts. Boards are 81 numbers, 0 = empty. */

export type Board = number[];
export type Level = "easy" | "medium" | "hard";

export const LEVELS: Record<Level, { label: string; clues: number }> = {
  easy: { label: "Easy", clues: 38 },
  medium: { label: "Medium", clues: 32 },
  hard: { label: "Hard", clues: 27 },
};

export interface Puzzle {
  puzzle: Board;
  solution: Board;
}

const POP = Array.from({ length: 512 }, (_, m) => {
  let c = 0;
  for (let x = m; x; x &= x - 1) c++;
  return c;
});

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Counts solutions of a board, stopping at `limit`. Also returns the first solution found. */
export function search(grid: Board, limit = 2, rand?: () => number): { count: number; solution: Board | null } {
  const b = grid.slice();
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = b[i];
    if (!v) continue;
    const bit = 1 << (v - 1);
    if (rows[rowOf(i)] & bit || cols[colOf(i)] & bit || boxes[boxOf(i)] & bit) return { count: 0, solution: null };
    rows[rowOf(i)] |= bit;
    cols[colOf(i)] |= bit;
    boxes[boxOf(i)] |= bit;
  }
  let count = 0;
  let solution: Board | null = null;

  const rec = () => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (b[i]) continue;
      const mask = 511 & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]);
      const n = POP[mask];
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n <= 1) break;
      }
    }
    if (best === -1) {
      count++;
      if (!solution) solution = b.slice();
      return;
    }
    if (bestCount === 0) return;
    let digits: number[] = [];
    for (let d = 0; d < 9; d++) if (bestMask & (1 << d)) digits.push(d);
    if (rand) digits = shuffle(digits, rand);
    const r = rowOf(best);
    const c = colOf(best);
    const x = boxOf(best);
    for (const d of digits) {
      const bit = 1 << d;
      b[best] = d + 1;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[x] |= bit;
      rec();
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[x] &= ~bit;
      b[best] = 0;
      if (count >= limit) return;
    }
  };
  rec();
  return { count, solution };
}

export function countSolutions(grid: Board, limit = 2): number {
  return search(grid, limit).count;
}

/** A full valid grid, randomised. */
export function generateSolved(rand: () => number = Math.random): Board {
  const res = search(new Array<number>(81).fill(0), 1, rand);
  return res.solution as Board;
}

/** A puzzle with a unique solution and (about) the level's number of clues. */
export function generatePuzzle(level: Level, rand: () => number = Math.random): Puzzle {
  const solution = generateSolved(rand);
  const puzzle = solution.slice();
  const target = LEVELS[level].clues;
  let clues = 81;
  for (const idx of shuffle(Array.from({ length: 81 }, (_, i) => i), rand)) {
    if (clues <= target) break;
    const v = puzzle[idx];
    puzzle[idx] = 0;
    if (countSolutions(puzzle, 2) === 1) clues--;
    else puzzle[idx] = v;
  }
  return { puzzle, solution };
}

export const countClues = (b: Board) => b.filter(Boolean).length;

/** Indices of the 20 cells that share a row, column or box with `i`. */
export function peers(i: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) out.push(j);
  }
  return out;
}

/** Cells whose value is repeated in their row, column or box. */
export function findConflicts(b: Board): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < 81; i++) {
    if (!b[i]) continue;
    for (const j of peers(i)) {
      if (b[j] === b[i]) {
        bad.add(i);
        break;
      }
    }
  }
  return bad;
}

export function isSolved(b: Board): boolean {
  return b.every(Boolean) && findConflicts(b).size === 0;
}

/** Number of times each digit 1-9 is on the board (index 0 unused). */
export function digitCounts(b: Board): number[] {
  const c = new Array<number>(10).fill(0);
  for (const v of b) c[v]++;
  return c;
}

/** Notes are bitmasks per cell (bit d-1 = digit d). */
export const toggleNote = (mask: number, digit: number) => mask ^ (1 << (digit - 1));
export const hasNote = (mask: number, digit: number) => (mask & (1 << (digit - 1))) !== 0;

/** Places a digit (0 = erase), clears that cell's notes and the digit from peers' notes. */
export function place(board: Board, notes: number[], idx: number, digit: number): { board: Board; notes: number[] } {
  const nb = board.slice();
  const nn = notes.slice();
  nb[idx] = digit;
  nn[idx] = 0;
  if (digit) for (const p of peers(idx)) nn[p] &= ~(1 << (digit - 1));
  return { board: nb, notes: nn };
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

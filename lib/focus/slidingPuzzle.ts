/** Sliding puzzle (n x n). Board is a flat array; 0 is the gap. */
export type Board = number[];
export type Direction = "up" | "down" | "left" | "right";
export const SIZES = [3, 4, 5] as const;

export function solvedBoard(n: number): Board {
  return Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n));
}

export function isSolved(board: Board): boolean {
  return board.every((v, i) => v === (i + 1) % board.length);
}

export function gapIndex(board: Board): number {
  return board.indexOf(0);
}

/** Index of the tile that moves into the gap when sliding in `dir`, or -1. */
export function tileForDirection(board: Board, n: number, dir: Direction): number {
  const g = gapIndex(board);
  const r = Math.floor(g / n);
  const c = g % n;
  // a tile moving "left" comes from the right of the gap, and so on
  if (dir === "left") return c < n - 1 ? g + 1 : -1;
  if (dir === "right") return c > 0 ? g - 1 : -1;
  if (dir === "up") return r < n - 1 ? g + n : -1;
  return r > 0 ? g - n : -1;
}

/**
 * Slide the tile at `index`, plus any tiles between it and the gap in the same row or column.
 * Returns the same board and 0 moves when the tile cannot move.
 */
export function slideTile(board: Board, n: number, index: number): { board: Board; moved: number } {
  const g = gapIndex(board);
  if (index === g || index < 0 || index >= board.length) return { board, moved: 0 };
  const r = Math.floor(index / n);
  const c = index % n;
  const gr = Math.floor(g / n);
  const gc = g % n;
  let step: number;
  if (r === gr) step = c < gc ? 1 : -1;
  else if (c === gc) step = r < gr ? n : -n;
  else return { board, moved: 0 };
  const next = board.slice();
  let pos = g;
  let moved = 0;
  while (pos !== index) {
    next[pos] = next[pos - step];
    pos -= step;
    moved++;
  }
  next[index] = 0;
  return { board: next, moved };
}

/** Shuffle by making random legal single moves from solved, so the result is always solvable. */
export function shuffled(n: number, rand: () => number = Math.random, steps = n * n * 20): Board {
  let board = solvedBoard(n);
  let last = -1;
  for (let s = 0; s < steps; s++) {
    const g = gapIndex(board);
    const r = Math.floor(g / n);
    const c = g % n;
    const options: number[] = [];
    if (r > 0) options.push(g - n);
    if (r < n - 1) options.push(g + n);
    if (c > 0) options.push(g - 1);
    if (c < n - 1) options.push(g + 1);
    const choices = options.filter((o) => o !== last);
    const pick = choices[Math.min(choices.length - 1, Math.floor(rand() * choices.length))];
    last = g;
    board = slideTile(board, n, pick).board;
  }
  // extremely unlikely, but never hand out an already solved board
  if (isSolved(board)) return slideTile(board, n, gapIndex(board) === 0 ? 1 : gapIndex(board) - 1).board;
  return board;
}

/** Solvability check (parity of inversions plus gap row for even sizes). */
export function isSolvable(board: Board, n: number): boolean {
  const tiles = board.filter((v) => v !== 0);
  let inv = 0;
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) if (tiles[i] > tiles[j]) inv++;
  if (n % 2 === 1) return inv % 2 === 0;
  const rowFromBottom = n - Math.floor(gapIndex(board) / n);
  return (inv + rowFromBottom) % 2 === 1;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface BestRecord {
  moves: number;
  time: number;
}

/** Merge a finished game into a best record (0 means none yet). */
export function updateBest(prev: BestRecord | undefined, moves: number, time: number): BestRecord {
  return {
    moves: prev && prev.moves > 0 ? Math.min(prev.moves, moves) : moves,
    time: prev && prev.time > 0 ? Math.min(prev.time, time) : time,
  };
}

export type Grid = number[][];

export const SIZE = 4;

export const emptyGrid = (): Grid => Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));

/** Slides and merges one row to the left. Returns the new row and the points scored. */
export function slideRow(row: number[]): { row: number[]; score: number } {
  const tiles = row.filter((v) => v !== 0);
  const out: number[] = [];
  let score = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      score += tiles[i] * 2;
      i += 1;
    } else out.push(tiles[i]);
  }
  while (out.length < row.length) out.push(0);
  return { row: out, score };
}

export type Direction = "left" | "right" | "up" | "down";

const transpose = (g: Grid): Grid => g[0].map((_, c) => g.map((r) => r[c]));
const reverseRows = (g: Grid): Grid => g.map((r) => [...r].reverse());

export function move(grid: Grid, dir: Direction): { grid: Grid; score: number; moved: boolean } {
  let g = grid.map((r) => [...r]);
  if (dir === "up" || dir === "down") g = transpose(g);
  if (dir === "right" || dir === "down") g = reverseRows(g);
  let score = 0;
  g = g.map((r) => {
    const res = slideRow(r);
    score += res.score;
    return res.row;
  });
  if (dir === "right" || dir === "down") g = reverseRows(g);
  if (dir === "up" || dir === "down") g = transpose(g);
  const moved = g.some((r, y) => r.some((v, x) => v !== grid[y][x]));
  return { grid: g, score, moved };
}

/** Puts a 2 (90%) or 4 (10%) on a random empty cell. */
export function spawn(grid: Grid, rand: () => number = Math.random): Grid {
  const empty: [number, number][] = [];
  grid.forEach((r, y) => r.forEach((v, x) => v === 0 && empty.push([y, x])));
  if (empty.length === 0) return grid;
  const [y, x] = empty[Math.floor(rand() * empty.length)];
  const next = grid.map((r) => [...r]);
  next[y][x] = rand() < 0.9 ? 2 : 4;
  return next;
}

export const canMove = (grid: Grid): boolean => (["left", "right", "up", "down"] as const).some((d) => move(grid, d).moved);
export const maxTile = (grid: Grid): number => Math.max(...grid.flat());

export function newGame(rand: () => number = Math.random): Grid {
  return spawn(spawn(emptyGrid(), rand), rand);
}

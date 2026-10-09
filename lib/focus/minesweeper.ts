export type LevelId = "easy" | "medium" | "hard";
export interface Level {
  id: LevelId;
  label: string;
  rows: number;
  cols: number;
  mines: number;
}
export const LEVELS: Record<LevelId, Level> = {
  easy: { id: "easy", label: "Easy", rows: 9, cols: 9, mines: 10 },
  medium: { id: "medium", label: "Medium", rows: 12, cols: 12, mines: 24 },
  hard: { id: "hard", label: "Hard", rows: 16, cols: 16, mines: 40 },
};

export type CellState = "hidden" | "open" | "flag";
export interface Cell {
  mine: boolean;
  adjacent: number;
  state: CellState;
}
export type Status = "ready" | "playing" | "won" | "lost";
export interface Board {
  rows: number;
  cols: number;
  mines: number;
  cells: Cell[];
  status: Status;
  /** index of the mine that was hit, or -1 */
  exploded: number;
}

export function newBoard(level: Level): Board {
  return {
    rows: level.rows,
    cols: level.cols,
    mines: level.mines,
    cells: Array.from({ length: level.rows * level.cols }, () => ({ mine: false, adjacent: 0, state: "hidden" as CellState })),
    status: "ready",
    exploded: -1,
  };
}

export function neighbors(board: Pick<Board, "rows" | "cols">, index: number): number[] {
  const r = Math.floor(index / board.cols);
  const c = index % board.cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < board.rows && nc >= 0 && nc < board.cols) out.push(nr * board.cols + nc);
    }
  }
  return out;
}

/** Place mines avoiding the safe cell and its neighbours (so the first click opens an area). */
export function placeMines(board: Board, safe: number, rand: () => number = Math.random): Board {
  const total = board.rows * board.cols;
  let banned = new Set<number>([safe, ...neighbors(board, safe)]);
  if (total - banned.size < board.mines) banned = new Set([safe]);
  const pool: number[] = [];
  for (let i = 0; i < total; i++) if (!banned.has(i)) pool.push(i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const mineSet = new Set(pool.slice(0, board.mines));
  const cells = board.cells.map((cell, i) => ({ ...cell, mine: mineSet.has(i), adjacent: 0 }));
  for (let i = 0; i < total; i++) {
    cells[i].adjacent = neighbors(board, i).filter((n) => cells[n].mine).length;
  }
  return { ...board, cells };
}

function finish(board: Board): Board {
  const safeLeft = board.cells.some((c) => !c.mine && c.state !== "open");
  if (safeLeft) return board;
  return { ...board, status: "won", cells: board.cells.map((c) => (c.mine ? { ...c, state: "flag" } : c)) };
}

function lose(board: Board, index: number): Board {
  return {
    ...board,
    status: "lost",
    exploded: index,
    cells: board.cells.map((c) => (c.mine && c.state !== "flag" ? { ...c, state: "open" } : c)),
  };
}

/** Reveal a cell (flood-filling zeros). The first reveal places the mines. */
export function reveal(board: Board, index: number, rand: () => number = Math.random): Board {
  if (board.status === "won" || board.status === "lost") return board;
  let b = board;
  if (b.status === "ready") b = { ...placeMines(b, index, rand), status: "playing" };
  const target = b.cells[index];
  if (!target || target.state !== "hidden") return b;
  if (target.mine) return lose(b, index);
  const cells = b.cells.map((c) => ({ ...c }));
  const stack = [index];
  while (stack.length) {
    const i = stack.pop() as number;
    const cell = cells[i];
    if (cell.state !== "hidden") continue;
    cell.state = "open";
    if (cell.adjacent === 0) {
      for (const n of neighbors(b, i)) if (cells[n].state === "hidden") stack.push(n);
    }
  }
  return finish({ ...b, cells });
}

export function toggleFlag(board: Board, index: number): Board {
  if (board.status === "won" || board.status === "lost") return board;
  const cell = board.cells[index];
  if (!cell || cell.state === "open") return board;
  const cells = board.cells.slice();
  cells[index] = { ...cell, state: cell.state === "flag" ? "hidden" : "flag" };
  return { ...board, cells };
}

/** Chord: on an open number with enough flags around it, reveal the remaining neighbours. */
export function chord(board: Board, index: number, rand: () => number = Math.random): Board {
  if (board.status !== "playing") return board;
  const cell = board.cells[index];
  if (!cell || cell.state !== "open" || cell.adjacent === 0) return board;
  const around = neighbors(board, index);
  const flags = around.filter((n) => board.cells[n].state === "flag").length;
  if (flags !== cell.adjacent) return board;
  let b = board;
  for (const n of around) {
    if (b.cells[n].state === "hidden") b = reveal(b, n, rand);
  }
  return b;
}

export function flagsLeft(board: Board): number {
  return board.mines - board.cells.filter((c) => c.state === "flag").length;
}

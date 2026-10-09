export const COLS = 7;
export const ROWS = 6;

export type Player = 1 | 2;
export type Cell = 0 | Player;
/** Row-major board, index = row * COLS + col, row 0 is the top. */
export type Board = Cell[];
export type Difficulty = "easy" | "medium" | "hard";

export interface Winner {
  player: Player;
  cells: number[];
}

const ORDER = [3, 2, 4, 1, 5, 0, 6];

export function newBoard(): Board {
  return new Array<Cell>(COLS * ROWS).fill(0);
}

export function other(p: Player): Player {
  return p === 1 ? 2 : 1;
}

/** Row where a disc dropped into `col` would land, or -1 if the column is full / invalid. */
export function dropRow(board: Board, col: number): number {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return -1;
  for (let r = ROWS - 1; r >= 0; r--) if (board[r * COLS + col] === 0) return r;
  return -1;
}

export function validMoves(board: Board): number[] {
  return ORDER.filter((c) => board[c] === 0).sort((a, b) => a - b);
}

/** Returns a new board with the disc dropped, or the same board if the move is illegal. */
export function drop(board: Board, col: number, player: Player): Board {
  const r = dropRow(board, col);
  if (r < 0) return board;
  const next = board.slice();
  next[r * COLS + col] = player;
  return next;
}

const DIRS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function findWinner(board: Board): Winner | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r * COLS + c];
      if (p === 0) continue;
      for (const [dr, dc] of DIRS) {
        const er = r + dr * 3;
        const ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        const cells = [0, 1, 2, 3].map((k) => (r + dr * k) * COLS + (c + dc * k));
        if (cells.every((i) => board[i] === p)) return { player: p, cells };
      }
    }
  }
  return null;
}

export function isFull(board: Board): boolean {
  return validMoves(board).length === 0;
}

const WINDOWS: number[][] = (() => {
  const out: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of DIRS) {
        const er = r + dr * 3;
        const ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        out.push([0, 1, 2, 3].map((k) => (r + dr * k) * COLS + (c + dc * k)));
      }
    }
  }
  return out;
})();

/** Heuristic score of the position from `me`'s point of view. */
export function evaluate(board: Board, me: Player): number {
  let s = 0;
  for (let r = 0; r < ROWS; r++) {
    const v = board[r * COLS + 3];
    if (v === me) s += 3;
    else if (v !== 0) s -= 3;
  }
  for (const w of WINDOWS) {
    let mine = 0;
    let theirs = 0;
    for (let k = 0; k < 4; k++) {
      const v = board[w[k]];
      if (v === me) mine++;
      else if (v !== 0) theirs++;
    }
    if (mine && theirs) continue;
    if (mine === 3) s += 5;
    else if (mine === 2) s += 2;
    else if (theirs === 3) s -= 6;
    else if (theirs === 2) s -= 2;
  }
  return s;
}

const WIN = 100000;

interface Search {
  nodes: number;
  limit: number;
  aborted: boolean;
}

function negamax(board: Board, depth: number, alpha: number, beta: number, turn: Player, me: Player, ply: number, st: Search): number {
  if (++st.nodes > st.limit) {
    st.aborted = true;
    return 0;
  }
  const w = findWinner(board);
  if (w) return w.player === turn ? WIN - ply : -(WIN - ply);
  const moves = validMoves(board);
  if (moves.length === 0) return 0;
  if (depth === 0) return evaluate(board, turn);
  let best = -Infinity;
  for (const c of moves.sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3))) {
    const v = -negamax(drop(board, c, turn), depth - 1, -beta, -alpha, other(turn), me, ply + 1, st);
    if (st.aborted) return 0;
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Score every playable column (null = full) searching `depth` plies with alpha-beta. */
export function scoreMoves(board: Board, player: Player, depth: number, nodeLimit = Infinity): Array<number | null> | null {
  const st: Search = { nodes: 0, limit: nodeLimit, aborted: false };
  const out: Array<number | null> = new Array(COLS).fill(null);
  for (const c of validMoves(board)) {
    // full window per root move so every column gets an exact score
    const v = -negamax(drop(board, c, player), depth - 1, -Infinity, Infinity, other(player), player, 1, st);
    if (st.aborted) return null;
    out[c] = v;
  }
  return out;
}

const SETTINGS: Record<Difficulty, { depth: number; nodes: number; mistake: number }> = {
  easy: { depth: 2, nodes: 5000, mistake: 0.3 },
  medium: { depth: 4, nodes: 20000, mistake: 0.08 },
  hard: { depth: 6, nodes: 35000, mistake: 0 },
};

/** Choose a column for `player`. Ties are broken with `rand`. Returns -1 if the board is full. */
export function chooseMove(board: Board, player: Player, difficulty: Difficulty, rand: () => number = Math.random): number {
  const moves = validMoves(board);
  if (moves.length === 0) return -1;
  const cfg = SETTINGS[difficulty];
  // Always take an immediate win.
  for (const c of moves) if (findWinner(drop(board, c, player))) return c;
  // Always block an immediate loss (except sometimes on easy).
  const blocks = moves.filter((c) => findWinner(drop(board, c, other(player))));
  if (blocks.length && (difficulty !== "easy" || rand() > 0.25)) return blocks[0];
  if (rand() < cfg.mistake) return moves[Math.floor(rand() * moves.length) % moves.length];

  let scores: Array<number | null> | null = null;
  // Iterative deepening: keep the deepest fully-searched result within the node budget.
  for (let d = 1; d <= cfg.depth; d++) {
    const s = scoreMoves(board, player, d, cfg.nodes);
    if (!s) break;
    scores = s;
  }
  if (!scores) return moves[Math.floor(rand() * moves.length) % moves.length];
  let best = -Infinity;
  for (const s of scores) if (s !== null && s > best) best = s;
  const top = moves.filter((c) => scores![c] === best);
  return top[Math.floor(rand() * top.length) % top.length];
}

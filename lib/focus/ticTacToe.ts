export type Mark = "X" | "O";
export type Cell = Mark | null;
export type Board = Cell[];
export type Difficulty = "easy" | "medium" | "impossible";

export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export interface Outcome {
  winner: Mark | null;
  line: readonly [number, number, number] | null;
  draw: boolean;
}

export function emptyBoard(): Board {
  return Array<Cell>(9).fill(null);
}

export function opponent(m: Mark): Mark {
  return m === "X" ? "O" : "X";
}

export function availableMoves(board: Board): number[] {
  const out: number[] = [];
  board.forEach((c, i) => {
    if (c === null) out.push(i);
  });
  return out;
}

export function outcome(board: Board): Outcome {
  for (const line of LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return { winner: v, line, draw: false };
  }
  return { winner: null, line: null, draw: board.every((c) => c !== null) };
}

export function isFinished(board: Board): boolean {
  const o = outcome(board);
  return o.winner !== null || o.draw;
}

/** Returns a new board with the mark placed, or the same board if the move is illegal. */
export function place(board: Board, index: number, mark: Mark): Board {
  if (index < 0 || index > 8 || board[index] !== null || isFinished(board)) return board;
  const next = board.slice();
  next[index] = mark;
  return next;
}

function pick<T>(items: T[], rand: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rand() * items.length))];
}

/** A cell that completes a line for `mark`, or -1. */
export function findWinningMove(board: Board, mark: Mark): number {
  for (const move of availableMoves(board)) {
    const next = board.slice();
    next[move] = mark;
    if (outcome(next).winner === mark) return move;
  }
  return -1;
}

export function easyMove(board: Board, rand: () => number = Math.random): number {
  const moves = availableMoves(board);
  return moves.length ? pick(moves, rand) : -1;
}

export function mediumMove(board: Board, mark: Mark, rand: () => number = Math.random): number {
  const moves = availableMoves(board);
  if (!moves.length) return -1;
  const win = findWinningMove(board, mark);
  if (win >= 0) return win;
  const block = findWinningMove(board, opponent(mark));
  if (block >= 0) return block;
  if (board[4] === null) return 4;
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (corners.length) return pick(corners, rand);
  return pick(moves, rand);
}

function minimax(board: Board, turn: Mark, me: Mark, depth: number): number {
  const o = outcome(board);
  if (o.winner === me) return 10 - depth;
  if (o.winner) return depth - 10;
  if (o.draw) return 0;
  const scores = availableMoves(board).map((m) => {
    const next = board.slice();
    next[m] = turn;
    return minimax(next, opponent(turn), me, depth + 1);
  });
  return turn === me ? Math.max(...scores) : Math.min(...scores);
}

/** Perfect play. Ties between equally good moves are broken with `rand`. */
export function impossibleMove(board: Board, mark: Mark, rand: () => number = Math.random): number {
  const moves = availableMoves(board);
  if (!moves.length) return -1;
  let best = -Infinity;
  let bestMoves: number[] = [];
  for (const m of moves) {
    const next = board.slice();
    next[m] = mark;
    const score = minimax(next, opponent(mark), mark, 1);
    if (score > best) {
      best = score;
      bestMoves = [m];
    } else if (score === best) bestMoves.push(m);
  }
  return pick(bestMoves, rand);
}

export function computerMove(board: Board, mark: Mark, level: Difficulty, rand: () => number = Math.random): number {
  if (level === "easy") return easyMove(board, rand);
  if (level === "medium") return mediumMove(board, mark, rand);
  return impossibleMove(board, mark, rand);
}

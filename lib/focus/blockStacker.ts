// Pure logic for Block Stacker, a Tetris-style falling-blocks game.

export const COLS = 10;
export const ROWS = 20;

export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export const PIECE_TYPES: PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];

type Matrix = number[][];

const BASE: Record<PieceType, Matrix> = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};

function rotateCw(m: Matrix): Matrix {
  const n = m.length;
  return m.map((_, r) => m.map((__, c) => m[n - 1 - c][r]));
}

/** Filled cells [col,row] for each of the 4 rotations of every piece. */
export const SHAPES: Record<PieceType, [number, number][][]> = (() => {
  const out = {} as Record<PieceType, [number, number][][]>;
  for (const t of PIECE_TYPES) {
    let m = BASE[t];
    const rots: [number, number][][] = [];
    for (let i = 0; i < 4; i++) {
      const cells: [number, number][] = [];
      m.forEach((row, r) => row.forEach((v, c) => v && cells.push([c, r])));
      rots.push(cells);
      m = rotateCw(m);
    }
    out[t] = rots;
  }
  return out;
})();

export interface Piece {
  type: PieceType;
  rot: number;
  x: number;
  y: number;
}

export interface BlockState {
  /** 0 = empty, otherwise 1 + index in PIECE_TYPES */
  board: number[][];
  piece: Piece;
  next: PieceType;
  hold: PieceType | null;
  canHold: boolean;
  bag: PieceType[];
  score: number;
  lines: number;
  level: number;
  over: boolean;
}

export function emptyBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

export function pieceCells(p: Piece): [number, number][] {
  return SHAPES[p.type][p.rot].map(([c, r]) => [p.x + c, p.y + r]);
}

export function collides(board: number[][], p: Piece): boolean {
  return pieceCells(p).some(([c, r]) => c < 0 || c >= COLS || r >= ROWS || (r >= 0 && board[r][c] !== 0));
}

/** Draws one piece from the bag, refilling it with a shuffled set of 7 when empty. */
export function drawFromBag(bag: PieceType[], rand: () => number = Math.random): { type: PieceType; bag: PieceType[] } {
  let b = bag;
  if (b.length === 0) {
    b = [...PIECE_TYPES];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
  } else {
    b = [...b];
  }
  const type = b.pop()!;
  return { type, bag: b };
}

function spawn(type: PieceType): Piece {
  const w = SHAPES[type][0].reduce((m, [c]) => Math.max(m, c + 1), 0);
  const first = SHAPES[type][0].reduce((m, [, r]) => Math.min(m, r), 9);
  return { type, rot: 0, x: Math.floor((COLS - w) / 2), y: -first };
}

export function createGame(rand: () => number = Math.random): BlockState {
  const a = drawFromBag([], rand);
  const b = drawFromBag(a.bag, rand);
  return {
    board: emptyBoard(),
    piece: spawn(a.type),
    next: b.type,
    hold: null,
    canHold: true,
    bag: b.bag,
    score: 0,
    lines: 0,
    level: 1,
    over: false,
  };
}

export function tryMove(s: BlockState, dx: number, dy: number): BlockState {
  if (s.over) return s;
  const p = { ...s.piece, x: s.piece.x + dx, y: s.piece.y + dy };
  return collides(s.board, p) ? s : { ...s, piece: p };
}

const KICKS: [number, number][] = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]];

/** Rotate with simple wall kicks. dir 1 = clockwise, -1 = counter-clockwise. */
export function rotate(s: BlockState, dir: 1 | -1 = 1): BlockState {
  if (s.over || s.piece.type === "O") return s;
  const rot = (s.piece.rot + dir + 4) % 4;
  for (const [kx, ky] of KICKS) {
    const p = { ...s.piece, rot, x: s.piece.x + kx, y: s.piece.y + ky };
    if (!collides(s.board, p)) return { ...s, piece: p };
  }
  return s;
}

export function ghostY(s: BlockState): number {
  let p = s.piece;
  while (!collides(s.board, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 };
  return p.y;
}

export function scoreForLines(n: number, level: number): number {
  return ([0, 100, 300, 500, 800][n] ?? 0) * level;
}

/** Milliseconds between automatic falls for a level. */
export function dropInterval(level: number): number {
  return Math.max(80, Math.round(800 * Math.pow(0.85, level - 1)));
}

function lockAndSpawn(s: BlockState, rand: () => number): BlockState {
  const board = s.board.map((row) => row.slice());
  const id = PIECE_TYPES.indexOf(s.piece.type) + 1;
  for (const [c, r] of pieceCells(s.piece)) if (r >= 0) board[r][c] = id;
  const kept = board.filter((row) => row.some((v) => v === 0));
  const cleared = ROWS - kept.length;
  while (kept.length < ROWS) kept.unshift(new Array<number>(COLS).fill(0));
  const lines = s.lines + cleared;
  const level = Math.floor(lines / 10) + 1;
  const score = s.score + scoreForLines(cleared, s.level);
  const d = drawFromBag(s.bag, rand);
  const piece = spawn(s.next);
  return {
    ...s,
    board: kept,
    piece,
    next: d.type,
    bag: d.bag,
    canHold: true,
    score,
    lines,
    level,
    over: collides(kept, piece),
  };
}

/** Gravity step: move down one row, or lock the piece if it can't. */
export function tick(s: BlockState, rand: () => number = Math.random): BlockState {
  if (s.over) return s;
  const moved = tryMove(s, 0, 1);
  return moved !== s ? moved : lockAndSpawn(s, rand);
}

/** Player-driven soft drop: one row, +1 point when it moves. */
export function softDrop(s: BlockState, rand: () => number = Math.random): BlockState {
  if (s.over) return s;
  const moved = tryMove(s, 0, 1);
  if (moved !== s) return { ...moved, score: moved.score + 1 };
  return lockAndSpawn(s, rand);
}

/** Drops to the ghost position and locks immediately (+2 points per row). */
export function hardDrop(s: BlockState, rand: () => number = Math.random): BlockState {
  if (s.over) return s;
  const y = ghostY(s);
  const dist = y - s.piece.y;
  return lockAndSpawn({ ...s, piece: { ...s.piece, y }, score: s.score + dist * 2 }, rand);
}

export function holdPiece(s: BlockState, rand: () => number = Math.random): BlockState {
  if (s.over || !s.canHold) return s;
  if (s.hold === null) {
    const d = drawFromBag(s.bag, rand);
    const piece = spawn(s.next);
    return { ...s, hold: s.piece.type, piece, next: d.type, bag: d.bag, canHold: false, over: collides(s.board, piece) };
  }
  const piece = spawn(s.hold);
  return { ...s, hold: s.piece.type, piece, canHold: false, over: collides(s.board, piece) };
}

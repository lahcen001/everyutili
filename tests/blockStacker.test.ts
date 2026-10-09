// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  COLS, ROWS, PIECE_TYPES, createGame, drawFromBag, collides, rotate, tryMove, hardDrop, holdPiece,
  scoreForLines, dropInterval, ghostY, tick, pieceCells, type BlockState, type PieceType,
} from "@/lib/focus/blockStacker";

function seeded(seed = 1) {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
}

function withPiece(s: BlockState, type: PieceType): BlockState {
  return { ...s, piece: { ...s.piece, type, rot: 0 } };
}

describe("blockStacker", () => {
  it("7-bag yields each piece once per 7 draws", () => {
    const rand = seeded(5);
    let bag: PieceType[] = [];
    const got: PieceType[] = [];
    for (let i = 0; i < 14; i++) {
      const d = drawFromBag(bag, rand);
      bag = d.bag;
      got.push(d.type);
    }
    expect([...got.slice(0, 7)].sort()).toEqual([...PIECE_TYPES].sort());
    expect([...got.slice(7)].sort()).toEqual([...PIECE_TYPES].sort());
  });

  it("creates an empty 10x20 board with a valid spawn", () => {
    const s = createGame(seeded(2));
    expect(s.board.length).toBe(ROWS);
    expect(s.board[0].length).toBe(COLS);
    expect(collides(s.board, s.piece)).toBe(false);
    expect(s.level).toBe(1);
  });

  it("every rotation has 4 cells", () => {
    const s = createGame(seeded(3));
    for (const t of PIECE_TYPES) {
      let g = withPiece(s, t);
      g = { ...g, piece: { ...g.piece, x: 3, y: 5 } };
      for (let i = 0; i < 4; i++) {
        expect(pieceCells(g.piece).length).toBe(4);
        g = rotate(g);
      }
    }
  });

  it("walls block movement", () => {
    let s = createGame(seeded(4));
    for (let i = 0; i < 20; i++) s = tryMove(s, -1, 0);
    const minX = Math.min(...pieceCells(s.piece).map(([c]) => c));
    expect(minX).toBe(0);
  });

  it("wall kick lets a vertical I rotate against the wall", () => {
    let s = withPiece(createGame(seeded(6)), "I");
    s = { ...s, piece: { type: "I", rot: 1, x: -2, y: 5 } }; // vertical bar in column 0
    expect(collides(s.board, s.piece)).toBe(false);
    const r = rotate(s);
    expect(r.piece.rot).toBe(2);
    expect(collides(r.board, r.piece)).toBe(false);
  });

  it("hard drop lands on the floor and spawns the next piece", () => {
    const s = createGame(seeded(7));
    const next = s.next;
    const y = ghostY(s);
    const d = hardDrop(s, seeded(8));
    expect(d.board.flat().filter((v) => v > 0).length).toBe(4);
    expect(d.piece.type).toBe(next);
    expect(y).toBeGreaterThan(0);
    expect(d.score).toBeGreaterThan(0);
  });

  it("clears a full line and scores 100 x level", () => {
    let s = withPiece(createGame(seeded(9)), "I");
    const board = s.board.map((r) => r.slice());
    for (let c = 0; c < COLS; c++) if (c < 3 || c > 6) board[ROWS - 1][c] = 1;
    s = { ...s, board, piece: { type: "I", rot: 0, x: 3, y: -1 + 0 } };
    const d = hardDrop({ ...s, score: 0 }, seeded(1));
    expect(d.lines).toBe(1);
    expect(d.board[ROWS - 1].every((v) => v === 0)).toBe(true);
    expect(d.score).toBeGreaterThanOrEqual(100);
  });

  it("scoring table and level speed", () => {
    expect([1, 2, 3, 4].map((n) => scoreForLines(n, 2))).toEqual([200, 600, 1000, 1600]);
    expect(dropInterval(5)).toBeLessThan(dropInterval(1));
  });

  it("hold swaps once per piece", () => {
    const s = createGame(seeded(10));
    const type = s.piece.type;
    const h = holdPiece(s, seeded(1));
    expect(h.hold).toBe(type);
    expect(h.canHold).toBe(false);
    expect(holdPiece(h, seeded(1))).toBe(h);
  });

  it("game ends when the stack reaches the spawn area", () => {
    let s = createGame(seeded(11));
    for (let i = 0; i < 40 && !s.over; i++) s = hardDrop(s, seeded(i));
    expect(s.over).toBe(true);
    expect(tick(s)).toBe(s);
  });
});

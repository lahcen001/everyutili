// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  availableMoves,
  computerMove,
  easyMove,
  emptyBoard,
  impossibleMove,
  isFinished,
  mediumMove,
  outcome,
  place,
  type Board,
  type Mark,
} from "@/lib/focus/ticTacToe";

const b = (s: string): Board => s.split("").map((c) => (c === "X" || c === "O" ? c : null));

describe("tic-tac-toe logic", () => {
  it("starts empty with 9 moves", () => {
    expect(availableMoves(emptyBoard())).toHaveLength(9);
  });

  it("detects a winning line and returns it", () => {
    const o = outcome(b("XXX.OO..."));
    expect(o.winner).toBe("X");
    expect(o.line).toEqual([0, 1, 2]);
  });

  it("detects diagonals and draws", () => {
    expect(outcome(b("O.X.XOX..")).line).toEqual([2, 4, 6]);
    const d = outcome(b("XOXXOOOXX"));
    expect(d.draw).toBe(true);
    expect(d.winner).toBeNull();
  });

  it("place ignores occupied cells and finished games", () => {
    const board = b("X........");
    expect(place(board, 0, "O")).toBe(board);
    const done = b("XXXOO....");
    expect(place(done, 8, "O")).toBe(done);
    expect(place(board, 4, "O")[4]).toBe("O");
    expect(board[4]).toBeNull();
  });

  it("easy picks by injected rand", () => {
    const board = b("X........");
    expect(easyMove(board, () => 0)).toBe(1);
    expect(easyMove(board, () => 0.999)).toBe(8);
  });

  it("medium takes a win, then blocks", () => {
    expect(mediumMove(b("OO.XX...."), "O", () => 0)).toBe(2);
    expect(mediumMove(b("XX..O...."), "O", () => 0)).toBe(2);
  });

  it("medium prefers centre then corner", () => {
    expect(mediumMove(b("X........"), "O", () => 0)).toBe(4);
    expect(mediumMove(b("....X...."), "O", () => 0.5)).toBe(6);
  });

  it("impossible wins when it can and blocks otherwise", () => {
    expect(impossibleMove(b("OO.XX...."), "O", () => 0)).toBe(2);
    expect(impossibleMove(b("XX..O...."), "O", () => 0)).toBe(2);
  });

  it("impossible never loses against every possible opponent line", () => {
    const check = (board: Board, turn: Mark, ai: Mark): boolean => {
      const o = outcome(board);
      if (o.winner) return o.winner === ai;
      if (o.draw) return true;
      if (turn === ai) return check(place(board, impossibleMove(board, ai, () => 0), ai), "X" === ai ? "O" : "X", ai);
      return availableMoves(board).every((m) => check(place(board, m, turn), ai, ai));
    };
    expect(check(emptyBoard(), "X", "O")).toBe(true);
    expect(check(emptyBoard(), "X", "X")).toBe(true);
  });

  it("computerMove dispatches and returns -1 on a full board", () => {
    expect(computerMove(b("OO.XX...."), "O", "medium", () => 0)).toBe(2);
    const full = b("XOXXOOOXX");
    expect(computerMove(full, "X", "impossible")).toBe(-1);
    expect(isFinished(full)).toBe(true);
  });
});

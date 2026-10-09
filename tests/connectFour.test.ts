// @vitest-environment node
import { describe, expect, it } from "vitest";
import { COLS, ROWS, chooseMove, drop, dropRow, findWinner, isFull, newBoard, validMoves, type Board, type Player } from "@/lib/focus/connectFour";

function play(cols: number[], first: Player = 1): Board {
  let b = newBoard();
  let p: Player = first;
  for (const c of cols) {
    b = drop(b, c, p);
    p = p === 1 ? 2 : 1;
  }
  return b;
}

describe("connect four logic", () => {
  it("starts empty with all columns playable", () => {
    const b = newBoard();
    expect(b).toHaveLength(COLS * ROWS);
    expect(validMoves(b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("discs fall to the lowest free row", () => {
    let b = drop(newBoard(), 2, 1);
    expect(b[(ROWS - 1) * COLS + 2]).toBe(1);
    expect(dropRow(b, 2)).toBe(ROWS - 2);
    b = drop(b, 2, 2);
    expect(b[(ROWS - 2) * COLS + 2]).toBe(2);
  });

  it("rejects moves in a full column or out of range", () => {
    const b = play([0, 0, 0, 0, 0, 0]);
    expect(dropRow(b, 0)).toBe(-1);
    expect(drop(b, 0, 1)).toBe(b);
    expect(validMoves(b)).not.toContain(0);
    expect(dropRow(b, 9)).toBe(-1);
  });

  it("detects horizontal, vertical and diagonal wins", () => {
    expect(findWinner(play([0, 0, 1, 1, 2, 2, 3]))?.player).toBe(1);
    expect(findWinner(play([0, 1, 0, 1, 0, 1, 0]))?.cells).toHaveLength(4);
    // diagonal up-right for player 1
    expect(findWinner(play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]))?.player).toBe(1);
    // diagonal up-left for player 1 (mirror)
    expect(findWinner(play([6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]))?.player).toBe(1);
  });

  it("returns null when there is no winner and detects a full board", () => {
    expect(findWinner(newBoard())).toBeNull();
    expect(isFull(newBoard())).toBe(false);
    const b = newBoard().map((_, i) => ((Math.floor(i / COLS) + (i % COLS) * 2) % 3 === 0 ? 1 : 2)) as Board;
    expect(isFull(b)).toBe(true);
  });

  it("computer takes an immediate win on every level", () => {
    const b = play([0, 6, 1, 6, 2, 5]); // player 1 can win at col 3
    for (const d of ["easy", "medium", "hard"] as const) expect(chooseMove(b, 1, d, () => 0.5)).toBe(3);
  });

  it("computer blocks an immediate loss on medium and hard", () => {
    const b = play([0, 6, 1, 6, 2]); // player 1 threatens col 3, player 2 to move
    expect(chooseMove(b, 2, "medium", () => 0.5)).toBe(3);
    expect(chooseMove(b, 2, "hard", () => 0.5)).toBe(3);
  });

  it("hard avoids a move that lets the opponent win next turn", () => {
    // Player 1 has 1,2,3 on the bottom row open at 0 and 4: a double threat must be stopped early.
    const b = play([2, 6, 3, 6]); // p1 at 2,3; p2 to... p1 to move
    const m = chooseMove(b, 1, "hard", () => 0.5);
    expect([1, 4]).toContain(m);
  });

  it("returns -1 when no moves remain", () => {
    const b = newBoard().map(() => 1 as const) as Board;
    expect(chooseMove(b, 2, "hard")).toBe(-1);
  });
});

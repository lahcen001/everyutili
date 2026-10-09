// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatTime, isSolvable, isSolved, shuffled, slideTile, solvedBoard, tileForDirection, updateBest } from "@/lib/focus/slidingPuzzle";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("sliding puzzle", () => {
  it("builds a solved board with the gap last", () => {
    expect(solvedBoard(3)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
    expect(isSolved(solvedBoard(4))).toBe(true);
  });

  it("slides a single adjacent tile into the gap", () => {
    const r = slideTile(solvedBoard(3), 3, 7);
    expect(r.moved).toBe(1);
    expect(r.board).toEqual([1, 2, 3, 4, 5, 6, 7, 0, 8]);
  });

  it("slides a whole row toward the gap", () => {
    const r = slideTile(solvedBoard(3), 3, 6);
    expect(r.moved).toBe(2);
    expect(r.board).toEqual([1, 2, 3, 4, 5, 6, 0, 7, 8]);
  });

  it("slides a whole column toward the gap", () => {
    const r = slideTile(solvedBoard(3), 3, 2);
    expect(r.moved).toBe(2);
    expect(r.board).toEqual([1, 2, 0, 4, 5, 3, 7, 8, 6]);
  });

  it("ignores tiles not aligned with the gap and the gap itself", () => {
    const b = solvedBoard(3);
    expect(slideTile(b, 3, 0)).toEqual({ board: b, moved: 0 });
    expect(slideTile(b, 3, 8).moved).toBe(0);
  });

  it("maps arrow directions to the tile that moves", () => {
    const b = solvedBoard(3);
    expect(tileForDirection(b, 3, "right")).toBe(7);
    expect(tileForDirection(b, 3, "down")).toBe(5);
    expect(tileForDirection(b, 3, "left")).toBe(-1);
    expect(tileForDirection(b, 3, "up")).toBe(-1);
  });

  it("shuffles to a solvable, unsolved board for every size", () => {
    for (const n of [3, 4, 5]) {
      for (let seed = 1; seed <= 20; seed++) {
        const b = shuffled(n, seeded(seed));
        expect([...b].sort((x, y) => x - y)).toEqual(solvedBoard(n).sort((x, y) => x - y));
        expect(isSolvable(b, n)).toBe(true);
        expect(isSolved(b)).toBe(false);
      }
    }
  });

  it("detects an unsolvable board", () => {
    expect(isSolvable([2, 1, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(false);
  });

  it("tracks best moves and time independently", () => {
    expect(updateBest(undefined, 50, 90)).toEqual({ moves: 50, time: 90 });
    expect(updateBest({ moves: 50, time: 90 }, 60, 70)).toEqual({ moves: 50, time: 70 });
  });

  it("formats time", () => {
    expect(formatTime(75)).toBe("1:15");
  });
});

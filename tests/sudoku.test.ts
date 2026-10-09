// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  countClues,
  countSolutions,
  findConflicts,
  generatePuzzle,
  generateSolved,
  isSolved,
  place,
  peers,
  toggleNote,
  hasNote,
  type Level,
} from "@/lib/focus/sudoku";

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("sudoku", () => {
  it("generates a full valid grid", () => {
    const g = generateSolved(seeded(1));
    expect(g).toHaveLength(81);
    expect(isSolved(g)).toBe(true);
    expect(findConflicts(g).size).toBe(0);
  });

  it("is deterministic for a seed and varies between seeds", () => {
    expect(generateSolved(seeded(5))).toEqual(generateSolved(seeded(5)));
    expect(generateSolved(seeded(5))).not.toEqual(generateSolved(seeded(6)));
  });

  it.each(["easy", "medium", "hard"] as Level[])("%s puzzle has a unique solution matching the answer", (level) => {
    const { puzzle, solution } = generatePuzzle(level, seeded(42));
    expect(countSolutions(puzzle, 2)).toBe(1);
    for (let i = 0; i < 81; i++) if (puzzle[i]) expect(puzzle[i]).toBe(solution[i]);
    expect(isSolved(solution)).toBe(true);
  });

  it("clue counts follow the levels", () => {
    const e = countClues(generatePuzzle("easy", seeded(3)).puzzle);
    const h = countClues(generatePuzzle("hard", seeded(3)).puzzle);
    expect(e).toBeLessThanOrEqual(40);
    expect(h).toBeLessThan(e);
    expect(h).toBeLessThanOrEqual(32);
  });

  it("counts multiple solutions up to the limit", () => {
    expect(countSolutions(new Array(81).fill(0), 2)).toBe(2);
  });

  it("detects conflicts", () => {
    const b = new Array(81).fill(0);
    b[0] = 5;
    b[8] = 5;
    b[30] = 7;
    expect([...findConflicts(b)].sort((x, y) => x - y)).toEqual([0, 8]);
  });

  it("has 20 peers per cell", () => {
    expect(peers(40)).toHaveLength(20);
  });

  it("place clears notes in the cell and peers", () => {
    const notes = new Array(81).fill(0);
    notes[0] = toggleNote(0, 4);
    notes[1] = toggleNote(0, 4) | toggleNote(0, 6);
    notes[80] = toggleNote(0, 4);
    const r = place(new Array(81).fill(0), notes, 0, 4);
    expect(r.board[0]).toBe(4);
    expect(r.notes[0]).toBe(0);
    expect(hasNote(r.notes[1], 4)).toBe(false);
    expect(hasNote(r.notes[1], 6)).toBe(true);
    expect(hasNote(r.notes[80], 4)).toBe(true);
  });

  it("generates quickly", () => {
    const t = performance.now();
    generatePuzzle("hard", seeded(9));
    expect(performance.now() - t).toBeLessThan(1500);
  });
});

// @vitest-environment node
import { describe, expect, it } from "vitest";
import { LEVELS, chord, flagsLeft, neighbors, newBoard, placeMines, reveal, toggleFlag, type Board } from "@/lib/focus/minesweeper";

function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const count = (b: Board) => b.cells.filter((c) => c.mine).length;

describe("minesweeper", () => {
  it("has the three level sizes", () => {
    expect(LEVELS.easy).toMatchObject({ rows: 9, cols: 9, mines: 10 });
    expect(LEVELS.medium).toMatchObject({ rows: 12, cols: 12, mines: 24 });
    expect(LEVELS.hard).toMatchObject({ rows: 16, cols: 16, mines: 40 });
  });
  it("neighbors handles corners and the middle", () => {
    const b = newBoard(LEVELS.easy);
    expect(neighbors(b, 0)).toHaveLength(3);
    expect(neighbors(b, 4)).toHaveLength(5);
    expect(neighbors(b, 40)).toHaveLength(8);
  });
  it("places the exact number of mines and never on the first click or its neighbours", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const b = placeMines(newBoard(LEVELS.hard), 100, seeded(seed));
      expect(count(b)).toBe(40);
      for (const i of [100, ...neighbors(b, 100)]) expect(b.cells[i].mine).toBe(false);
    }
  });
  it("first reveal starts the game, is safe and flood-fills", () => {
    const b = reveal(newBoard(LEVELS.easy), 40, seeded());
    expect(b.status === "playing" || b.status === "won").toBe(true);
    expect(b.cells[40].state).toBe("open");
    expect(b.cells[40].adjacent).toBe(0);
    expect(b.cells.filter((c) => c.state === "open").length).toBeGreaterThan(9);
  });
  it("adjacent counts match neighbouring mines", () => {
    const b = placeMines(newBoard(LEVELS.medium), 0, seeded(9));
    b.cells.forEach((c, i) => expect(c.adjacent).toBe(neighbors(b, i).filter((n) => b.cells[n].mine).length));
  });
  it("revealing a mine loses and shows mines", () => {
    let b = reveal(newBoard(LEVELS.easy), 0, seeded());
    const m = b.cells.findIndex((c) => c.mine);
    b = reveal(b, m);
    expect(b.status).toBe("lost");
    expect(b.exploded).toBe(m);
    expect(b.cells[m].state).toBe("open");
    expect(reveal(b, 1)).toBe(b);
  });
  it("flags toggle, block reveal and are counted", () => {
    let b = reveal(newBoard(LEVELS.easy), 0, seeded());
    const h = b.cells.findIndex((c) => c.state === "hidden");
    b = toggleFlag(b, h);
    expect(b.cells[h].state).toBe("flag");
    expect(flagsLeft(b)).toBe(9);
    expect(reveal(b, h).cells[h].state).toBe("flag");
    expect(toggleFlag(b, h).cells[h].state).toBe("hidden");
  });
  it("revealing every safe cell wins", () => {
    let b = reveal(newBoard(LEVELS.easy), 40, seeded(3));
    for (let i = 0; i < b.cells.length; i++) if (!b.cells[i].mine && b.cells[i].state === "hidden") b = reveal(b, i);
    expect(b.status).toBe("won");
    expect(flagsLeft(b)).toBe(0);
  });
  it("chord opens neighbours only when flags match the number", () => {
    let b = reveal(newBoard(LEVELS.easy), 40, seeded(11));
    const i = b.cells.findIndex((c, k) => c.state === "open" && c.adjacent > 0 && neighbors(b, k).some((n) => b.cells[n].state === "hidden"));
    expect(chord(b, i)).toBe(b);
    for (const n of neighbors(b, i)) if (b.cells[n].mine) b = toggleFlag(b, n);
    const after = chord(b, i);
    expect(neighbors(after, i).every((n) => after.cells[n].state !== "hidden")).toBe(true);
    expect(after.status === "playing" || after.status === "won").toBe(true);
  });
});

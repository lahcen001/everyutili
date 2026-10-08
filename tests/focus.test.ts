import { describe, expect, it } from "vitest";
import { addSession, DEFAULT_SETTINGS, formatClock, lastDays, nextPhase, phaseSeconds } from "@/lib/focus/pomodoro";
import { boxCounts, cardsToText, dueQueue, newCard, parseCards, review, BOX_DAYS } from "@/lib/focus/leitner";
import { breakdown, urgency } from "@/lib/focus/countdown";
import { bestStreak, completionRate, currentStreak, toggleDay } from "@/lib/focus/habits";
import { fillNoise } from "@/lib/focus/noise";

describe("pomodoro", () => {
  it("cycles focus → short → … → long after 4 sessions", () => {
    expect(nextPhase("focus", 1, DEFAULT_SETTINGS)).toBe("short");
    expect(nextPhase("focus", 3, DEFAULT_SETTINGS)).toBe("short");
    expect(nextPhase("focus", 4, DEFAULT_SETTINGS)).toBe("long");
    expect(nextPhase("short", 1, DEFAULT_SETTINGS)).toBe("focus");
    expect(nextPhase("long", 4, DEFAULT_SETTINGS)).toBe("focus");
  });
  it("converts and formats time", () => {
    expect(phaseSeconds("focus", DEFAULT_SETTINGS)).toBe(1500);
    expect(formatClock(1500)).toBe("25:00");
    expect(formatClock(59.2)).toBe("01:00");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-4)).toBe("00:00");
  });
  it("records sessions per day and fills gaps", () => {
    const day = new Date(2026, 0, 10, 12);
    const stats = addSession(addSession({}, 25, day), 25, day);
    expect(stats["2026-01-10"]).toEqual({ sessions: 2, minutes: 50 });
    const week = lastDays(stats, 3, day);
    expect(week.map((d) => d.key)).toEqual(["2026-01-08", "2026-01-09", "2026-01-10"]);
    expect(week.map((d) => d.sessions)).toEqual([0, 0, 2]);
  });
});

describe("leitner", () => {
  const now = 1_000_000_000_000;
  it("moves right answers up and wrong ones back to box 1", () => {
    let c = newCard("a", "q", "a", now);
    expect(c.box).toBe(0);
    c = review(c, true, now);
    expect(c.box).toBe(1);
    expect(c.due).toBe(now + BOX_DAYS[1] * 86400000);
    c = review(review(c, true, now), true, now);
    expect(c.box).toBe(3);
    expect(review(c, false, now)).toMatchObject({ box: 1, due: now });
    let top = { ...c, box: 5 };
    top = review(top, true, now);
    expect(top.box).toBe(5);
  });
  it("queues only due cards, hardest first", () => {
    const cards = [
      { ...newCard("1", "a", "b", now), box: 3, due: now - 10 },
      { ...newCard("2", "a", "b", now), box: 1, due: now - 5 },
      { ...newCard("3", "a", "b", now), box: 2, due: now + 9999 },
    ];
    expect(dueQueue(cards, now).map((c) => c.id)).toEqual(["2", "1"]);
    expect(boxCounts(cards)).toEqual([0, 1, 1, 1, 0, 0]);
  });
  it("parses pasted card lists", () => {
    expect(parseCards("hola, hello\nadiós;bye\n\"x\"\t\"y\"\nno separator\nA - B")).toEqual([
      { front: "hola", back: "hello" },
      { front: "adiós", back: "bye" },
      { front: "x", back: "y" },
      { front: "A", back: "B" },
    ]);
    expect(parseCards(cardsToText([{ front: "q", back: "a" }]))).toEqual([{ front: "q", back: "a" }]);
  });
});

describe("countdown", () => {
  it("breaks a duration into parts", () => {
    const now = 0;
    const t = ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000;
    expect(breakdown(t, now)).toMatchObject({ past: false, days: 2, hours: 3, minutes: 4, seconds: 5 });
    expect(breakdown(-1000, now).past).toBe(true);
  });
  it("rates urgency", () => {
    const d = 86400000;
    expect(urgency(2 * d, 0)).toBe("soon");
    expect(urgency(10 * d, 0)).toBe("near");
    expect(urgency(30 * d, 0)).toBe("far");
    expect(urgency(-d, 0)).toBe("past");
  });
});

describe("habits", () => {
  it("counts streaks, allowing today to be pending", () => {
    const done = ["2026-03-08", "2026-03-09", "2026-03-10"];
    expect(currentStreak(done, "2026-03-10")).toBe(3);
    expect(currentStreak(done, "2026-03-11")).toBe(3);
    expect(currentStreak(done, "2026-03-12")).toBe(0);
    expect(bestStreak([...done, "2026-03-01", "2026-03-02"])).toBe(3);
    expect(toggleDay(done, "2026-03-09")).toEqual(["2026-03-08", "2026-03-10"]);
    expect(completionRate(done, 10, "2026-03-10")).toBe(30);
  });
});

describe("noise", () => {
  it("fills buffers within range", () => {
    for (const kind of ["white", "pink", "brown"] as const) {
      const buf = new Float32Array(4096);
      fillNoise(buf, kind);
      expect(Math.max(...buf)).toBeLessThanOrEqual(1.5);
      expect(Math.min(...buf)).toBeGreaterThanOrEqual(-1.5);
      expect(buf.some((v) => v !== 0)).toBe(true);
    }
  });
});

import { makeLoopable, renderFire, renderOcean, renderRain, renderStream, renderWind } from "@/lib/focus/soundscapeRender";

describe("soundscape rendering", () => {
  const sr = 8000;
  let seed = 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  it("renders loopable, bounded, non-silent buffers", () => {
    for (const render of [renderRain, renderOcean, renderWind, renderStream, renderFire]) {
      const buf = render(sr, 6, rand);
      expect(buf.length).toBeGreaterThan(sr * 3);
      let peak = 0;
      let energy = 0;
      for (const v of buf) {
        peak = Math.max(peak, Math.abs(v));
        energy += v * v;
      }
      expect(peak).toBeLessThanOrEqual(1);
      expect(energy / buf.length).toBeGreaterThan(1e-4);
      expect(Number.isNaN(energy)).toBe(false);
    }
  });
  it("crossfades the loop point so there is no jump", () => {
    const data = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 7));
    const loop = makeLoopable(data, 200);
    expect(loop.length).toBe(800);
    expect(Math.abs(loop[0] - loop[799])).toBeLessThan(0.3);
  });
  it("gives a different signal for each ear", () => {
    const a = renderRain(sr, 3, rand);
    const b = renderRain(sr, 3, rand);
    expect(a[1000]).not.toBe(b[1000]);
  });
});

import { canMove, emptyGrid, maxTile, move, newGame, slideRow, spawn } from "@/lib/focus/game2048";
import { buildDeck, stars } from "@/lib/focus/memory";
import { PATTERNS, cycleSeconds, phaseAt } from "@/lib/focus/breathing";
import { ROUTINES, routineSeconds } from "@/lib/focus/stretches";

describe("2048", () => {
  it("merges each pair once, left to right", () => {
    expect(slideRow([2, 2, 2, 2])).toEqual({ row: [4, 4, 0, 0], score: 8 });
    expect(slideRow([2, 2, 4, 0])).toEqual({ row: [4, 4, 0, 0], score: 4 });
    expect(slideRow([0, 2, 0, 2])).toEqual({ row: [4, 0, 0, 0], score: 4 });
    expect(slideRow([2, 4, 2, 4])).toEqual({ row: [2, 4, 2, 4], score: 0 });
  });
  it("moves in every direction and detects no-ops", () => {
    const g = emptyGrid();
    g[0][3] = 2;
    g[3][3] = 2;
    expect(move(g, "left").grid[0][0]).toBe(2);
    expect(move(g, "down").grid[3][3]).toBe(4);
    expect(move(g, "up").grid[0][3]).toBe(4);
    expect(move(g, "right").moved).toBe(false);
  });
  it("spawns a tile and knows when the game is over", () => {
    expect(newGame().flat().filter(Boolean).length).toBe(2);
    expect(spawn(emptyGrid(), () => 0).flat().filter(Boolean)).toEqual([2]);
    const full = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(canMove(full)).toBe(false);
    expect(canMove([[2, 2, 4, 8], ...full.slice(1)])).toBe(true);
    expect(maxTile(full)).toBe(4);
  });
});

describe("memory match", () => {
  it("builds a shuffled deck of pairs", () => {
    const deck = buildDeck(8);
    expect(deck).toHaveLength(16);
    const counts = new Map<string, number>();
    deck.forEach((c) => counts.set(c.symbol, (counts.get(c.symbol) ?? 0) + 1));
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
    expect(new Set(deck.map((c) => c.id)).size).toBe(16);
  });
  it("rates by moves", () => {
    expect(stars(8, 8)).toBe(3);
    expect(stars(18, 8)).toBe(2);
    expect(stars(40, 8)).toBe(1);
  });
});

describe("breathing", () => {
  it("walks through the phases of a pattern", () => {
    const box = PATTERNS[0];
    expect(cycleSeconds(box)).toBe(16);
    expect(phaseAt(0, box)).toMatchObject({ phase: "inhale", cycle: 0, size: 0 });
    expect(phaseAt(2, box)).toMatchObject({ phase: "inhale", size: 0.5 });
    expect(phaseAt(5, box)).toMatchObject({ phase: "hold", size: 1 });
    expect(phaseAt(9, box)).toMatchObject({ phase: "exhale" });
    expect(phaseAt(13, box)).toMatchObject({ phase: "rest", size: 0 });
    expect(phaseAt(16.5, box)).toMatchObject({ phase: "inhale", cycle: 1 });
  });
});

describe("stretch routines", () => {
  it("has complete, sensible routines", () => {
    for (const r of ROUTINES) {
      expect(r.steps.length).toBeGreaterThan(2);
      expect(routineSeconds(r)).toBeGreaterThanOrEqual(60);
      for (const s of r.steps) {
        expect(s.title && s.how && s.icon).toBeTruthy();
        expect(s.seconds).toBeGreaterThanOrEqual(10);
      }
    }
  });
});

import { dailyTotals, formatMinutes, sumMinutes, toCsv, totalsBySubject, type LogEntry } from "@/lib/focus/studylog";
import { accuracy, makeProblem } from "@/lib/focus/mathquiz";
import { PASSAGES, typingStats } from "@/lib/focus/typing";
import { canTurn, initialState, step } from "@/lib/focus/snake";

describe("study log", () => {
  const day = new Date(2026, 4, 10, 12).getTime();
  const entries: LogEntry[] = [
    { id: "1", subject: "Maths", start: day, minutes: 45 },
    { id: "2", subject: "Maths", start: day + 3600000, minutes: 30 },
    { id: "3", subject: "History", start: day - 86400000, minutes: 20, note: 'said "hi", ok' },
  ];
  it("totals by subject and day", () => {
    const from = new Date(2026, 4, 10).getTime();
    expect(totalsBySubject(entries, from, from + 86400000)).toEqual({ Maths: 75 });
    expect(sumMinutes({ a: 5, b: 7 })).toBe(12);
    const week = dailyTotals(entries, 3, day);
    expect(week.map((d) => d.minutes)).toEqual([0, 20, 75]);
  });
  it("formats minutes and exports CSV with quoting", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(95)).toBe("1h 35m");
    const csv = toCsv(entries);
    expect(csv.split("\n")[0]).toBe("start,subject,minutes,note");
    expect(csv).toContain('"said ""hi"", ok"');
  });
});

describe("math trainer", () => {
  it("always makes whole-number, non-negative answers", () => {
    for (const op of ["+", "-", "×", "÷"] as const) {
      for (const level of [1, 2, 3] as const) {
        for (let i = 0; i < 60; i++) {
          const p = makeProblem(op, level);
          expect(Number.isInteger(p.answer)).toBe(true);
          expect(p.answer).toBeGreaterThanOrEqual(0);
          if (op === "÷") expect(p.a / p.b).toBe(p.answer);
          if (op === "×") expect(p.a * p.b).toBe(p.answer);
        }
      }
    }
    expect(accuracy(3, 4)).toBe(75);
    expect(accuracy(0, 0)).toBe(0);
  });
});

describe("typing", () => {
  it("computes wpm and accuracy", () => {
    expect(typingStats("hello wor", "hello world", 12)).toMatchObject({ wpm: 9, accuracy: 100 });
    expect(typingStats("hellx", "hello", 60)).toMatchObject({ correctChars: 4, accuracy: 80, wpm: 1 });
    expect(typingStats("", "abc", 10).accuracy).toBe(100);
    expect(PASSAGES.length).toBeGreaterThan(5);
  });
});

describe("snake", () => {
  it("moves, grows and dies", () => {
    let s = initialState(10, () => 0);
    expect(s.snake).toHaveLength(3);
    const head = s.snake[0];
    s = step(s, "right", () => 0);
    expect(s.snake[0]).toEqual({ x: head.x + 1, y: head.y });
    expect(s.snake).toHaveLength(3);
    // eat
    s = { ...s, food: { x: s.snake[0].x + 1, y: s.snake[0].y } };
    const len = s.snake.length;
    s = step(s, "right", () => 0);
    expect(s.snake).toHaveLength(len + 1);
    expect(s.score).toBe(1);
    // cannot reverse
    expect(canTurn("right", "left")).toBe(false);
    expect(step(s, "left", () => 0).dir).toBe("right");
    // wall
    let w = initialState(5, () => 0);
    for (let i = 0; i < 6; i++) w = step(w, "right", () => 0);
    expect(w.over).toBe(true);
  });
});

import { buildReminders } from "@/lib/focus/reminders";

describe("reminders", () => {
  const now = new Date(2026, 5, 10, 9, 0);
  const today = "2026-06-10";
  it("lists what needs attention today", () => {
    const r = buildReminders(
      {
        todos: [
          { done: false, due: "2026-06-08" },
          { done: false, due: today },
          { done: true, due: "2026-06-01" },
          { done: false, due: "2026-07-01" },
          { done: false, due: "" },
        ],
        habits: [{ done: [today] }, { done: [] }, { done: ["2026-06-09"] }],
        countdowns: [{ name: "Far", at: now.getTime() + 40 * 86400000 }, { name: "Chem", at: now.getTime() + 2.5 * 86400000 }, { name: "Gone", at: now.getTime() - 1000 }],
        decks: [{ cards: [{ due: now.getTime() - 5 }, { due: now.getTime() + 99999 }] }],
        running: { subject: "Maths" },
      },
      now
    );
    const by = Object.fromEntries(r.map((x) => [x.kind, x]));
    expect(by["todos-overdue"].count).toBe(1);
    expect(by["todos-today"].count).toBe(1);
    expect(by.habits.count).toBe(2);
    expect(by.exam).toMatchObject({ name: "Chem", days: 2, tone: "red" });
    expect(by.cards.count).toBe(1);
    expect(by.timer.name).toBe("Maths");
  });
  it("shows nothing when there is nothing to do", () => {
    expect(buildReminders({}, now)).toEqual([]);
    expect(buildReminders({ habits: [{ done: [today] }], todos: [{ done: true, due: "2020-01-01" }] }, now)).toEqual([]);
  });
});

import { isNBackMatch, makeNBackSequence, makeSchulte, makeStroopTrial, randomDigits, randomTarget, scoreNBack, STROOP_COLORS } from "@/lib/focus/games";

describe("focus games", () => {
  it("builds a Schulte table with every number once", () => {
    const t = makeSchulte(5);
    expect(t).toHaveLength(25);
    expect([...t].sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });
  it("makes Stroop trials where most words and colours disagree", () => {
    let mismatch = 0;
    for (let i = 0; i < 400; i++) {
      const t = makeStroopTrial();
      expect(STROOP_COLORS).toContain(t.ink);
      if (t.ink.id !== t.word.id) mismatch += 1;
    }
    expect(mismatch / 400).toBeGreaterThan(0.6);
  });
  it("creates n-back sequences with real matches and scores them", () => {
    const seq = makeNBackSequence(60, 2, Math.random, 0.4);
    expect(seq.every((p) => p >= 0 && p <= 8)).toBe(true);
    const matches = seq.filter((_, i) => isNBackMatch(seq, i, 2)).length;
    expect(matches).toBeGreaterThan(5);
    const perfect = seq.map((_, i) => isNBackMatch(seq, i, 2));
    expect(scoreNBack(seq, 2, perfect)).toMatchObject({ misses: 0, falseAlarms: 0, accuracy: 100 });
    const none = scoreNBack(seq, 2, seq.map(() => false));
    expect(none.hits).toBe(0);
    expect(none.misses).toBe(matches);
    expect(scoreNBack([1, 1, 2], 1, [false, true, true])).toMatchObject({ hits: 1, falseAlarms: 1, correctRejections: 1 });
  });
  it("generates digits and targets", () => {
    for (let i = 1; i <= 12; i++) {
      const d = randomDigits(i);
      expect(d).toHaveLength(i);
      expect(d[0]).not.toBe("0");
    }
    const p = randomTarget(() => 0, 0.1);
    expect(p).toEqual({ x: 0.1, y: 0.1 });
    const q = randomTarget(() => 0.999999, 0.1);
    expect(q.x).toBeLessThanOrEqual(0.9);
  });
});

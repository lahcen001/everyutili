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

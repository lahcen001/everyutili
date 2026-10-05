import { describe, expect, it } from "vitest";
import { analyzeText, countSentences, extractWords, formatDuration, keywordStats, topWords } from "@/lib/textStats";

describe("extractWords", () => {
  it("counts like a word processor: hyphens and apostrophes stay inside a word", () => {
    expect(extractWords("A well-known fact: it's true.")).toEqual(["A", "well-known", "fact", "it's", "true"]);
  });
  it("ignores punctuation-only tokens and strips edge punctuation", () => {
    expect(extractWords("Hello — world ... (yes!)")).toEqual(["Hello", "world", "yes"]);
    expect(extractWords("   \n\t ")).toEqual([]);
  });
  it("segments scripts without spaces", () => {
    expect(extractWords("你好世界").length).toBeGreaterThanOrEqual(2);
    expect(extractWords("今日は天気です").length).toBeGreaterThanOrEqual(3);
    expect(extractWords("Hello 你好 world")).toContain("Hello");
  });
});

describe("countSentences", () => {
  it("handles abbreviations, decimals and trailing text", () => {
    expect(countSentences("Dr. Smith went home. He slept.")).toBe(2);
    expect(countSentences("Pi is 3.14 and e is 2.71. Nice!")).toBe(2);
    expect(countSentences("No punctuation here")).toBe(1);
    expect(countSentences("Is it? Yes! Really... ok")).toBe(4);
    expect(countSentences("e.g. this is one sentence.")).toBe(1);
  });
  it("counts CJK sentence marks and returns 0 for empty text", () => {
    expect(countSentences("你好。我很好。")).toBe(2);
    expect(countSentences("")).toBe(0);
    expect(countSentences("  ...  ")).toBe(1 - 1 + countSentences("  ...  "));
  });
});

describe("analyzeText", () => {
  it("computes counts, averages and times", () => {
    const s = analyzeText("One two three four five six.\n\nSeven eight.");
    expect(s.words).toBe(8);
    expect(s.sentences).toBe(2);
    expect(s.paragraphs).toBe(2);
    expect(s.uniqueWords).toBe(8);
    expect(s.charactersNoSpaces).toBeLessThan(s.characters);
    expect(s.averageSentenceLength).toBe(4);
    expect(s.readingMinutes).toBeCloseTo(8 / 238);
    expect(s.speakingMinutes).toBeGreaterThan(s.readingMinutes);
  });
  it("counts emoji and astral characters as one character each", () => {
    expect(analyzeText("a😀b").characters).toBe(3);
  });
  it("is all zeros for empty text", () => {
    expect(analyzeText("")).toMatchObject({ words: 0, sentences: 0, paragraphs: 0, averageWordLength: 0, averageSentenceLength: 0 });
  });
});

describe("topWords and keywordStats", () => {
  const text = "Apples and oranges. Apples, apples! The orange is an orange. 42 42";
  it("ranks words, skipping common words and numbers by default", () => {
    const top = topWords(text, 3);
    expect(top[0]).toMatchObject({ word: "apples", count: 3 });
    expect(top.map((t) => t.word)).not.toContain("the");
    expect(top.map((t) => t.word)).not.toContain("42");
    expect(topWords(text, 50, false).map((t) => t.word)).toContain("the");
  });
  it("counts whole words and phrases and their density", () => {
    expect(keywordStats(text, "apples").count).toBe(3);
    expect(keywordStats(text, "orange").count).toBe(2);
    expect(keywordStats(text, "orang").count).toBe(0);
    expect(keywordStats("big red dog and big red cat", "big red").count).toBe(2);
    expect(keywordStats("big red dog and big red cat", "big red").density).toBeCloseTo((2 * 2) / 7 * 100);
    expect(keywordStats(text, "   ")).toEqual({ count: 0, density: 0 });
  });
});

describe("formatDuration", () => {
  it("formats seconds and minutes", () => {
    expect(formatDuration(0)).toBe("0 sec");
    expect(formatDuration(0.5)).toBe("30 sec");
    expect(formatDuration(2.5)).toBe("2 min 30 sec");
    expect(formatDuration(12)).toBe("12 min");
  });
});

// Scripts written without spaces between words, counted with the browser's word segmenter.
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
const HAS_WORD_CHAR = /[\p{L}\p{N}]/u;
const EDGE_PUNCT = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

let segmenter: Intl.Segmenter | null | undefined;
function wordSegmenter(): Intl.Segmenter | null {
  if (segmenter === undefined) {
    segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "word" }) : null;
  }
  return segmenter;
}

/**
 * Words the way a word processor counts them: whitespace-separated tokens (so "well-known" and "don't" are
 * one word each), punctuation-only tokens are ignored, and scripts without spaces (Chinese, Japanese, Thai…)
 * are split with Intl.Segmenter.
 */
export function extractWords(text: string): string[] {
  const words: string[] = [];
  for (const token of text.split(/\s+/)) {
    if (!HAS_WORD_CHAR.test(token)) continue;
    const seg = wordSegmenter();
    if (seg && UNSPACED.test(token)) {
      for (const part of seg.segment(token)) if (part.isWordLike) words.push(part.segment);
    } else {
      const cleaned = token.replace(EDGE_PUNCT, "");
      if (cleaned) words.push(cleaned);
    }
  }
  return words;
}

const ABBREVIATION = /(^|[\s(])(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|inc|ltd|no|fig|e\.g|i\.e)\.$/i;

/** Counts sentences; "Dr. Smith", "3.14" and "e.g." don't end one, and trailing text without punctuation counts. */
export function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const terminator = /(?:[.!?…]+["'”’)\]]*(?=\s|$))|[。！？]+/gu;
  let count = 0;
  let lastEnd = 0;
  for (const match of trimmed.matchAll(terminator)) {
    const index = match.index ?? 0;
    if (match[0] === "." && ABBREVIATION.test(trimmed.slice(Math.max(0, index - 10), index + 1))) continue;
    count++;
    lastEnd = index + match[0].length;
  }
  if (HAS_WORD_CHAR.test(trimmed.slice(lastEnd))) count++;
  return count;
}

export const READING_WPM = 238;
export const SPEAKING_WPM = 150;

export interface TextStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  uniqueWords: number;
  averageWordLength: number;
  averageSentenceLength: number;
  readingMinutes: number;
  speakingMinutes: number;
}

export function analyzeText(text: string): TextStats {
  const words = extractWords(text);
  const sentences = countSentences(text);
  const letters = words.reduce((sum, w) => sum + [...w].length, 0);
  return {
    words: words.length,
    characters: [...text].length,
    charactersNoSpaces: [...text.replace(/\s/g, "")].length,
    sentences,
    paragraphs: text.split(/\n+/).filter((p) => p.trim() !== "").length,
    uniqueWords: new Set(words.map((w) => w.toLowerCase())).size,
    averageWordLength: words.length ? letters / words.length : 0,
    averageSentenceLength: sentences ? words.length / sentences : 0,
    readingMinutes: words.length / READING_WPM,
    speakingMinutes: words.length / SPEAKING_WPM,
  };
}

const COMMON_WORDS = new Set(
  "the a an and or but of to in on at for with by from as is are was were be been it its this that these those i you he she we they them his her our their my your not no so if then than too very can will just do does did have has had would should could about into over after before up out off all any more most some such only own same also there here what which who whom when where why how".split(
    " "
  )
);

export interface WordFrequency {
  word: string;
  count: number;
  percent: number;
}

/** Most frequent words, optionally skipping very common English words and bare numbers. */
export function topWords(text: string, limit = 10, ignoreCommon = true): WordFrequency[] {
  const words = extractWords(text).map((w) => w.toLowerCase().replace(/^['’]+|['’]+$/g, ""));
  const total = words.length;
  const counts = new Map<string, number>();
  for (const word of words) {
    if (!word || /^\p{N}+$/u.test(word) || (ignoreCommon && COMMON_WORDS.has(word))) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count, percent: total ? (count / total) * 100 : 0 }));
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** How often a word or phrase appears (whole words, any case) and its share of all words. */
export function keywordStats(text: string, keyword: string): { count: number; density: number } {
  const phrase = keyword.trim();
  if (!phrase) return { count: 0, density: 0 };
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase).replace(/\s+/g, "\\s+")}(?![\\p{L}\\p{N}])`, "giu");
  const count = text.match(pattern)?.length ?? 0;
  const total = extractWords(text).length;
  return { count, density: total ? ((count * extractWords(phrase).length) / total) * 100 : 0 };
}

export const LIMIT_PRESETS: { id: string; label: string; characters: number }[] = [
  { id: "x", label: "X / Twitter post — 280", characters: 280 },
  { id: "seo-title", label: "SEO title — 60", characters: 60 },
  { id: "meta", label: "Meta description — 160", characters: 160 },
  { id: "sms", label: "SMS — 160", characters: 160 },
  { id: "linkedin", label: "LinkedIn post — 3,000", characters: 3000 },
  { id: "instagram", label: "Instagram caption — 2,200", characters: 2200 },
];

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0 sec";
  const seconds = Math.round(minutes * 60);
  if (seconds < 60) return `${seconds} sec`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 || m >= 10 ? `${m} min` : `${m} min ${s} sec`;
}

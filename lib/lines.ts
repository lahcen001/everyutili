export type LineMode = "unique" | "duplicates" | "only-unique" | "count";
export type LineSort = "none" | "az" | "za" | "natural" | "natural-desc" | "length" | "length-desc" | "reverse" | "shuffle";

export interface LineOptions {
  mode: LineMode;
  caseInsensitive: boolean;
  trim: boolean;
  removeEmpty: boolean;
  sort: LineSort;
}

export interface LineResult {
  lines: string[];
  inputLines: number;
  outputLines: number;
  emptyRemoved: number;
  /** extra copies dropped (unique mode) */
  duplicatesRemoved: number;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const plain = new Intl.Collator(undefined, { sensitivity: "variant" });

export function processLines(text: string, o: LineOptions, rng: () => number = Math.random): LineResult {
  let lines = text.replace(/\r\n?/g, "\n").split("\n");
  // a final newline isn't an extra empty line
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  if (text === "") lines = [];
  const inputLines = lines.length;
  if (o.trim) lines = lines.map((l) => l.trim());
  let emptyRemoved = 0;
  if (o.removeEmpty) {
    const before = lines.length;
    lines = lines.filter((l) => l.trim() !== "");
    emptyRemoved = before - lines.length;
  }
  const keyOf = (l: string) => (o.caseInsensitive ? l.toLowerCase() : l);

  const counts = new Map<string, number>();
  const first = new Map<string, string>();
  for (const l of lines) {
    const k = keyOf(l);
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if (!first.has(k)) first.set(k, l);
  }

  let out: string[];
  switch (o.mode) {
    case "unique":
      out = [...first.values()];
      break;
    case "duplicates":
      out = [...first.entries()].filter(([k]) => counts.get(k)! > 1).map(([, l]) => l);
      break;
    case "only-unique":
      out = lines.filter((l) => counts.get(keyOf(l)) === 1);
      break;
    case "count":
      out = [...first.entries()].map(([k, l]) => `${counts.get(k)}\t${l}`);
      break;
  }
  const duplicatesRemoved = o.mode === "unique" ? lines.length - out.length : 0;

  const body = (l: string) => (o.mode === "count" ? l.slice(l.indexOf("\t") + 1) : l);
  switch (o.sort) {
    case "az":
      out = [...out].sort((a, b) => plain.compare(body(a), body(b)));
      break;
    case "za":
      out = [...out].sort((a, b) => plain.compare(body(b), body(a)));
      break;
    case "natural":
      out = [...out].sort((a, b) => collator.compare(body(a), body(b)));
      break;
    case "natural-desc":
      out = [...out].sort((a, b) => collator.compare(body(b), body(a)));
      break;
    case "length":
      out = [...out].sort((a, b) => body(a).length - body(b).length);
      break;
    case "length-desc":
      out = [...out].sort((a, b) => body(b).length - body(a).length);
      break;
    case "reverse":
      out = [...out].reverse();
      break;
    case "shuffle":
      out = [...out];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      break;
  }
  return { lines: out, inputLines, outputLines: out.length, emptyRemoved, duplicatesRemoved };
}

/** A small deterministic random source, so a "shuffle" can be re-run by changing the seed. */
export function seededRng(seed: number): () => number {
  let state = Math.max(1, Math.floor(seed)) % 2147483647 || 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

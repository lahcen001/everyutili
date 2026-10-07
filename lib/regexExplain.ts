export interface ExplainItem {
  token: string;
  meaning: string;
  depth: number;
}

const ESCAPES: Record<string, string> = {
  d: "a digit (0–9)",
  D: "anything that is not a digit",
  w: "a word character (letter, digit or _)",
  W: "anything that is not a word character",
  s: "a whitespace character",
  S: "anything that is not whitespace",
  b: "a word boundary",
  B: "a position that is not a word boundary",
  n: "a newline",
  r: "a carriage return",
  t: "a tab",
  f: "a form feed",
  v: "a vertical tab",
  0: "a null character",
};

const FLAG_NAMES: Record<string, string> = {
  g: "global — find every match, not just the first",
  i: "ignore case",
  m: "multiline — ^ and $ match at each line",
  s: "dot-all — . also matches newlines",
  u: "unicode — full Unicode support",
  y: "sticky — match only at lastIndex",
  d: "indices — report capture group positions",
  v: "unicodeSets — set notation and string properties",
};

export function explainFlags(flags: string): ExplainItem[] {
  return [...flags].map((f) => ({ token: f, meaning: FLAG_NAMES[f] ?? "unknown flag", depth: 0 }));
}

/** Walk a pattern left to right and describe each piece in plain English. */
export function explainRegex(pattern: string): ExplainItem[] {
  const items: ExplainItem[] = [];
  let i = 0;
  let depth = 0;
  const push = (token: string, meaning: string, d = depth) => items.push({ token, meaning, depth: d });
  const quantifier = (): string | null => {
    const m = /^(?:\*|\+|\?|\{\d+(?:,\d*)?\})\??/.exec(pattern.slice(i));
    return m ? m[0] : null;
  };
  const describeQuantifier = (q: string) => {
    const lazy = q.endsWith("?") && q.length > 1;
    const core = lazy ? q.slice(0, -1) : q;
    let text: string;
    if (core === "*") text = "zero or more times";
    else if (core === "+") text = "one or more times";
    else if (core === "?") text = "optional (zero or one time)";
    else {
      const [a, b] = core.slice(1, -1).split(",");
      text = b === undefined ? `exactly ${a} times` : b === "" ? `${a} or more times` : `between ${a} and ${b} times`;
    }
    return lazy ? `${text}, as few as possible (lazy)` : text;
  };

  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "\\") {
      const n = pattern[i + 1];
      if (n === undefined) {
        push("\\", "a trailing backslash");
        i++;
      } else if (n === "u" && /^[0-9a-fA-F]{4}/.test(pattern.slice(i + 2))) {
        push(pattern.slice(i, i + 6), `the character U+${pattern.slice(i + 2, i + 6).toUpperCase()}`);
        i += 6;
      } else if (n === "x" && /^[0-9a-fA-F]{2}/.test(pattern.slice(i + 2))) {
        push(pattern.slice(i, i + 4), `the character with code 0x${pattern.slice(i + 2, i + 4).toUpperCase()}`);
        i += 4;
      } else if ((n === "p" || n === "P") && pattern[i + 2] === "{") {
        const end = pattern.indexOf("}", i);
        push(pattern.slice(i, end + 1), `${n === "p" ? "a" : "not a"} Unicode ${pattern.slice(i + 3, end)} character`);
        i = end + 1;
      } else if (n === "k" && pattern[i + 2] === "<") {
        const end = pattern.indexOf(">", i);
        push(pattern.slice(i, end + 1), `the same text as the group named "${pattern.slice(i + 3, end)}"`);
        i = end + 1;
      } else if (/[1-9]/.test(n)) {
        push(`\\${n}`, `the same text as capture group ${n}`);
        i += 2;
      } else if (ESCAPES[n]) {
        push(`\\${n}`, ESCAPES[n]);
        i += 2;
      } else {
        push(`\\${n}`, `a literal "${n}"`);
        i += 2;
      }
    } else if (c === "[") {
      let j = i + 1;
      if (pattern[j] === "^") j++;
      if (pattern[j] === "]") j++;
      while (j < pattern.length && pattern[j] !== "]") j += pattern[j] === "\\" ? 2 : 1;
      const set = pattern.slice(i, j + 1);
      const negated = set[1] === "^";
      push(set, `${negated ? "any character except" : "any one of"}: ${set.slice(negated ? 2 : 1, -1).replace(/\\([dwsDWS])/g, (_, k: string) => ESCAPES[k]) || "(nothing)"}`);
      i = j + 1;
    } else if (c === "(") {
      let token = "(";
      let meaning = "start of a capture group";
      const rest = pattern.slice(i + 1);
      if (rest.startsWith("?:")) (token = "(?:"), (meaning = "start of a non-capturing group");
      else if (rest.startsWith("?=")) (token = "(?="), (meaning = "positive lookahead — what follows must match");
      else if (rest.startsWith("?!")) (token = "(?!"), (meaning = "negative lookahead — what follows must not match");
      else if (rest.startsWith("?<=")) (token = "(?<="), (meaning = "positive lookbehind — what precedes must match");
      else if (rest.startsWith("?<!")) (token = "(?<!"), (meaning = "negative lookbehind — what precedes must not match");
      else if (rest.startsWith("?<")) {
        const end = rest.indexOf(">");
        token = `(?${rest.slice(1, end + 1)}`;
        meaning = `start of a named capture group "${rest.slice(2, end)}"`;
      }
      push(token, meaning);
      depth++;
      i += token.length;
    } else if (c === ")") {
      depth = Math.max(0, depth - 1);
      push(")", "end of group");
      i++;
    } else if (c === "|") {
      push("|", "or — match either the part before or the part after");
      i++;
    } else if (c === "^") {
      push("^", "the start of the text (or of a line with the m flag)");
      i++;
    } else if (c === "$") {
      push("$", "the end of the text (or of a line with the m flag)");
      i++;
    } else if (c === ".") {
      push(".", "any character except a newline");
      i++;
    } else if (c === "*" || c === "+" || c === "?" || c === "{") {
      const q = quantifier();
      if (q) {
        push(q, describeQuantifier(q));
        i += q.length;
      } else {
        push(c, `a literal "${c}"`);
        i++;
      }
    } else {
      // a run of plain characters
      let j = i;
      while (j < pattern.length && !/[\\[()|^$.*+?{]/.test(pattern[j])) j++;
      // a quantifier applies only to the last character of the run
      if (j < pattern.length && /[*+?{]/.test(pattern[j]) && j - i > 1) j--;
      const lit = pattern.slice(i, j);
      push(lit, `the text "${lit}"`);
      i = j;
    }
  }
  return items;
}

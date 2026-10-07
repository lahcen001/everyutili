export type CaseId = "upper" | "lower" | "capitalized" | "sentence" | "alternating" | "inverse" | "camel" | "pascal" | "snake" | "constant" | "kebab" | "train" | "dot" | "path";

export const CASES: { id: CaseId; label: string; example: string; identifier?: boolean }[] = [
  { id: "upper", label: "UPPER CASE", example: "HELLO WORLD" },
  { id: "lower", label: "lower case", example: "hello world" },
  { id: "capitalized", label: "Capitalized Case", example: "Hello World" },
  { id: "sentence", label: "Sentence case", example: "Hello world. Next one." },
  { id: "alternating", label: "aLtErNaTiNg", example: "hElLo WoRlD" },
  { id: "inverse", label: "iNVERSE", example: "hELLO wORLD" },
  { id: "camel", label: "camelCase", example: "helloWorld", identifier: true },
  { id: "pascal", label: "PascalCase", example: "HelloWorld", identifier: true },
  { id: "snake", label: "snake_case", example: "hello_world", identifier: true },
  { id: "constant", label: "CONSTANT_CASE", example: "HELLO_WORLD", identifier: true },
  { id: "kebab", label: "kebab-case", example: "hello-world", identifier: true },
  { id: "train", label: "Train-Case", example: "Hello-World", identifier: true },
  { id: "dot", label: "dot.case", example: "hello.world", identifier: true },
  { id: "path", label: "path/case", example: "hello/world", identifier: true },
];

/**
 * Split text into words: handles spaces, punctuation, snake/kebab separators, camelCase
 * boundaries and acronyms (getHTTPResponse → get, HTTP, Response). Works for any script.
 */
export function splitWords(text: string): string[] {
  return text
    .replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter(Boolean);
}

const cap = (w: string) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w);
// charAt works on UTF-16 units; use code-point aware first letter so astral letters (e.g. Deseret) survive
const capCp = (w: string) => {
  const [first, ...rest] = Array.from(w);
  return first ? first.toUpperCase() + rest.join("").toLowerCase() : w;
};

function sentenceCase(text: string): string {
  let out = "";
  let start = true;
  for (const ch of text.toLowerCase()) {
    if (start && /\p{L}/u.test(ch)) {
      out += ch.toUpperCase();
      start = false;
    } else {
      out += ch;
      if (/[.!?…。！？]/u.test(ch)) start = true;
      else if (/\n/.test(ch)) start = true;
      else if (/\p{L}|\p{N}/u.test(ch)) start = false;
    }
  }
  return out;
}

function convertOne(text: string, id: CaseId): string {
  switch (id) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "capitalized":
      return text.toLowerCase().replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
    case "sentence":
      return sentenceCase(text);
    case "alternating": {
      let i = 0;
      return Array.from(text.toLowerCase(), (ch) => (/\p{L}/u.test(ch) ? (i++ % 2 ? ch.toUpperCase() : ch) : ch)).join("");
    }
    case "inverse":
      return Array.from(text, (ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase())).join("");
    default: {
      const words = splitWords(text);
      switch (id) {
        case "camel":
          return words.map((w, i) => (i === 0 ? w.toLowerCase() : capCp(w))).join("");
        case "pascal":
          return words.map(capCp).join("");
        case "snake":
          return words.map((w) => w.toLowerCase()).join("_");
        case "constant":
          return words.map((w) => w.toUpperCase()).join("_");
        case "kebab":
          return words.map((w) => w.toLowerCase()).join("-");
        case "train":
          return words.map(capCp).join("-");
        case "dot":
          return words.map((w) => w.toLowerCase()).join(".");
        case "path":
          return words.map((w) => w.toLowerCase()).join("/");
      }
    }
  }
  return text;
}

/** perLine converts every line on its own (handy for lists of names or identifiers). */
export function applyCase(text: string, id: CaseId, perLine = false): string {
  const identifier = CASES.find((c) => c.id === id)?.identifier;
  if (identifier || perLine) return text.split("\n").map((line) => convertOne(line, id)).join("\n");
  return convertOne(text, id);
}

export { cap as capitalizeWord };

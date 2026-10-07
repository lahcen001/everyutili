export type TitleStyle = "ap" | "apa" | "chicago" | "every";

export const TITLE_STYLES: { id: TitleStyle; label: string; hint: string }[] = [
  { id: "ap", label: "AP", hint: "Lowercase articles, conjunctions and prepositions of 3 letters or fewer" },
  { id: "apa", label: "APA", hint: "Lowercase minor words of 3 letters or fewer; capitalize every word of 4+ letters" },
  { id: "chicago", label: "Chicago / MLA", hint: "Lowercase articles, conjunctions and all prepositions, whatever their length" },
  { id: "every", label: "Every word", hint: "Capitalize the first letter of every word" },
];

const ARTICLES = ["a", "an", "the"];
const CONJUNCTIONS = ["and", "but", "for", "nor", "or", "so", "yet"];
const SHORT_PREPS = ["as", "at", "by", "in", "of", "off", "on", "per", "to", "up", "via", "out"];
const LONG_PREPS = ["about", "above", "across", "after", "against", "along", "among", "around", "before", "behind", "below", "beneath", "beside", "between", "beyond", "despite", "down", "during", "except", "from", "inside", "into", "like", "near", "onto", "outside", "over", "past", "since", "through", "throughout", "till", "toward", "towards", "under", "underneath", "until", "upon", "with", "within", "without"];

function minorWords(style: TitleStyle): Set<string> {
  if (style === "every") return new Set();
  if (style === "ap") return new Set([...ARTICLES, ...CONJUNCTIONS, ...SHORT_PREPS]);
  if (style === "apa") return new Set([...ARTICLES, ...CONJUNCTIONS, ...SHORT_PREPS].filter((w) => w.length <= 3));
  return new Set([...ARTICLES, ...CONJUNCTIONS, ...SHORT_PREPS, ...LONG_PREPS]);
}

const upperFirst = (w: string) => {
  const [first, ...rest] = Array.from(w);
  return first ? first.toUpperCase() + rest.join("") : w;
};

/** All-caps words (NASA, API) and words with inner capitals (iPhone, McDonald) are left alone. */
const isSpecial = (w: string) => /\p{Lu}.*\p{Lu}/u.test(w) || /^\p{Ll}+\p{Lu}/u.test(w);

export interface TitleOptions {
  style: TitleStyle;
  preserveCaps: boolean;
}

function titleLine(line: string, o: TitleOptions): string {
  const minor = minorWords(o.style);
  // tokens are words (with apostrophes and hyphens) and everything between them
  const tokens = line.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?(?:-[\p{L}\p{N}]+(?:['’][\p{L}]+)?)*|[^\p{L}\p{N}]+/gu) ?? [];
  const wordIdx = tokens.map((t, i) => (/^[\p{L}\p{N}]/u.test(t) ? i : -1)).filter((i) => i >= 0);
  const first = wordIdx[0];
  const last = wordIdx[wordIdx.length - 1];
  return tokens
    .map((tok, i) => {
      if (!/^[\p{L}\p{N}]/u.test(tok)) return tok;
      if (o.preserveCaps && isSpecial(tok)) return tok;
      const prev = tokens.slice(0, i).join("").trimEnd();
      const afterBreak = /[:?!.—–]$/.test(prev);
      const forced = i === first || i === last || afterBreak;
      return tok
        .split("-")
        .map((part, pi) => {
          if (o.preserveCaps && isSpecial(part)) return part;
          const lower = part.toLowerCase();
          const keepLower = !forced && pi === 0 && tok.indexOf("-") === -1 && minor.has(lower);
          return keepLower ? lower : upperFirst(lower);
        })
        .join("-");
    })
    .join("");
}

export function toTitleCase(text: string, o: TitleOptions): string {
  return text.split("\n").map((l) => titleLine(l, o)).join("\n");
}

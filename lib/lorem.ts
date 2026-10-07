const WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nunc gravida eros vitae pharetra massa porta mauris fermentum dictum risus tellus facilisis ligula integer posuere accumsan vulputate condimentum maecenas feugiat sapien neque volutpat blandit aenean placerat vestibulum lectus donec ultrices euismod nibh phasellus faucibus cursus turpis".split(" ");

export type LoremUnit = "paragraphs" | "sentences" | "words";
export type LoremFormat = "text" | "html" | "list";

export interface LoremOptions {
  unit: LoremUnit;
  count: number;
  startWithLorem: boolean;
  format: LoremFormat;
  /** sentences per paragraph (min, max) */
  paragraphSentences: [number, number];
  /** words per sentence (min, max) */
  sentenceWords: [number, number];
}

export const DEFAULT_LOREM: LoremOptions = { unit: "paragraphs", count: 3, startWithLorem: true, format: "text", paragraphSentences: [4, 7], sentenceWords: [8, 16] };
export const OPENING = "Lorem ipsum dolor sit amet, consectetur adipiscing elit";

type Rng = () => number;
const between = ([min, max]: [number, number], rng: Rng) => min + Math.floor(rng() * (Math.max(max, min) - min + 1));
const pick = (rng: Rng) => WORDS[Math.floor(rng() * WORDS.length)];

function sentence(o: LoremOptions, rng: Rng, opening: boolean): string {
  const n = between(o.sentenceWords, rng);
  let words: string[];
  if (opening) {
    const lead = OPENING.toLowerCase().replace(/,/g, "").split(" ");
    words = [...lead];
    while (words.length < n) words.push(pick(rng));
  } else {
    words = Array.from({ length: n }, () => pick(rng));
  }
  // sprinkle a comma or two into longer sentences
  const text = words.map((w, i) => (!opening && n > 8 && i > 2 && i < n - 2 && rng() < 0.12 ? `${w},` : w));
  if (opening) text[4] = `${text[4]},`;
  const joined = text.join(" ");
  return joined.charAt(0).toUpperCase() + joined.slice(1) + ".";
}

function paragraph(o: LoremOptions, rng: Rng, opening: boolean): string {
  const n = between(o.paragraphSentences, rng);
  return Array.from({ length: n }, (_, i) => sentence(o, rng, opening && i === 0)).join(" ");
}

export function generateLorem(o: LoremOptions, rng: Rng = Math.random): string {
  const count = Math.max(1, Math.floor(o.count));
  let items: string[];
  if (o.unit === "words") {
    const w = Array.from({ length: count }, () => pick(rng));
    if (o.startWithLorem) OPENING.toLowerCase().replace(/,/g, "").split(" ").slice(0, count).forEach((x, i) => (w[i] = x));
    const text = w.join(" ");
    items = [text.charAt(0).toUpperCase() + text.slice(1) + (count > 1 ? "." : "")];
  } else if (o.unit === "sentences") {
    items = Array.from({ length: count }, (_, i) => sentence(o, rng, o.startWithLorem && i === 0));
    if (o.format === "text") items = [items.join(" ")];
  } else {
    items = Array.from({ length: count }, (_, i) => paragraph(o, rng, o.startWithLorem && i === 0));
  }
  if (o.format === "html") return items.map((t) => `<p>${t}</p>`).join("\n");
  if (o.format === "list") return `<ul>\n${items.map((t) => `  <li>${t}</li>`).join("\n")}\n</ul>`;
  return items.join("\n\n");
}

export function countText(text: string): { words: number; characters: number } {
  const plain = text.replace(/<[^>]+>/g, " ");
  return { words: plain.trim() === "" ? 0 : plain.trim().split(/\s+/).length, characters: text.length };
}

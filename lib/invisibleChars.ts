export type InvisibleCategory = "zero-width" | "joiner" | "bidi" | "soft-hyphen" | "invisible-math" | "filler" | "tag" | "variation" | "space" | "control";

export const CATEGORY_INFO: Record<InvisibleCategory, { label: string; removeByDefault: boolean; note: string }> = {
  "zero-width": { label: "Zero-width space / no-break / word joiner", removeByDefault: true, note: "U+200B, U+2060, U+FEFF" },
  joiner: { label: "Zero-width joiner / non-joiner", removeByDefault: false, note: "U+200C, U+200D — needed inside emoji sequences and Persian, Arabic and Indic text" },
  bidi: { label: "Text-direction marks", removeByDefault: true, note: "U+200E/F, U+202A–E, U+2066–9, U+061C" },
  "soft-hyphen": { label: "Soft hyphen", removeByDefault: true, note: "U+00AD" },
  "invisible-math": { label: "Invisible math operators", removeByDefault: true, note: "U+2061–U+2064" },
  filler: { label: "Filler characters", removeByDefault: true, note: "U+034F, U+115F, U+1160, U+3164, U+FFA0" },
  tag: { label: "Unicode tag characters", removeByDefault: true, note: "U+E0000–U+E007F — sometimes used to hide text" },
  variation: { label: "Variation selectors", removeByDefault: false, note: "U+FE00–U+FE0F — pick emoji vs text style; removing them changes emoji" },
  space: { label: "Unusual spaces (replaced with a normal space)", removeByDefault: true, note: "no-break space, em/en/thin spaces, ideographic space…" },
  control: { label: "Control characters", removeByDefault: true, note: "U+0000–U+001F (except tab and newlines), U+007F–U+009F" },
};

export function classify(cp: number): InvisibleCategory | null {
  if (cp === 0x200b || cp === 0x2060 || cp === 0xfeff) return "zero-width";
  if (cp === 0x200c || cp === 0x200d) return "joiner";
  if (cp === 0x200e || cp === 0x200f || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069) || cp === 0x061c) return "bidi";
  if (cp === 0x00ad) return "soft-hyphen";
  if (cp >= 0x2061 && cp <= 0x2064) return "invisible-math";
  if (cp === 0x034f || cp === 0x115f || cp === 0x1160 || cp === 0x3164 || cp === 0xffa0) return "filler";
  if (cp >= 0xe0000 && cp <= 0xe007f) return "tag";
  if ((cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef)) return "variation";
  if (cp === 0x00a0 || cp === 0x1680 || (cp >= 0x2000 && cp <= 0x200a) || cp === 0x202f || cp === 0x205f || cp === 0x3000) return "space";
  if ((cp < 0x20 && cp !== 9 && cp !== 10 && cp !== 13) || (cp >= 0x7f && cp <= 0x9f)) return "control";
  return null;
}

const NAMES: Record<number, string> = { 0x200b: "Zero width space", 0x200c: "Zero width non-joiner", 0x200d: "Zero width joiner", 0x2060: "Word joiner", 0xfeff: "Zero width no-break space (BOM)", 0x00ad: "Soft hyphen", 0x200e: "Left-to-right mark", 0x200f: "Right-to-left mark", 0x202a: "Left-to-right embedding", 0x202b: "Right-to-left embedding", 0x202c: "Pop directional formatting", 0x202d: "Left-to-right override", 0x202e: "Right-to-left override", 0x2066: "Left-to-right isolate", 0x2067: "Right-to-left isolate", 0x2068: "First strong isolate", 0x2069: "Pop directional isolate", 0x061c: "Arabic letter mark", 0x00a0: "No-break space", 0x3000: "Ideographic space", 0x202f: "Narrow no-break space", 0x205f: "Medium mathematical space", 0x1680: "Ogham space mark", 0x034f: "Combining grapheme joiner", 0x115f: "Hangul choseong filler", 0x1160: "Hangul jungseong filler", 0x3164: "Hangul filler", 0xffa0: "Halfwidth Hangul filler", 0x2061: "Function application", 0x2062: "Invisible times", 0x2063: "Invisible separator", 0x2064: "Invisible plus" };

export function nameOf(cp: number): string {
  if (NAMES[cp]) return NAMES[cp];
  if (cp >= 0x2000 && cp <= 0x200a) return "Typographic space";
  if (cp >= 0xe0000 && cp <= 0xe007f) return "Tag character";
  if (cp >= 0xfe00 && cp <= 0xfe0f) return "Variation selector";
  if (cp >= 0xe0100 && cp <= 0xe01ef) return "Variation selector";
  return "Control character";
}

export interface InvisibleHit {
  /** index in code points */
  index: number;
  codePoint: number;
  category: InvisibleCategory;
  name: string;
}

export function scanInvisible(text: string): InvisibleHit[] {
  const hits: InvisibleHit[] = [];
  let index = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const category = classify(cp);
    if (category) hits.push({ index, codePoint: cp, category, name: nameOf(cp) });
    index++;
  }
  return hits;
}

export const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;

export function countByCategory(hits: InvisibleHit[]): Partial<Record<InvisibleCategory, number>> {
  const out: Partial<Record<InvisibleCategory, number>> = {};
  for (const h of hits) out[h.category] = (out[h.category] ?? 0) + 1;
  return out;
}

/** Remove (or, for unusual spaces, replace with a plain space) the chosen categories. */
export function cleanInvisible(text: string, categories: Set<InvisibleCategory>): string {
  let out = "";
  for (const ch of text) {
    const category = classify(ch.codePointAt(0)!);
    if (category && categories.has(category)) out += category === "space" ? " " : "";
    else out += ch;
  }
  return out;
}

/** The same text with every invisible character shown as a visible [U+XXXX] badge, for review. */
export function revealInvisible(text: string): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    out += classify(cp) ? `⟦${hex(cp)}⟧` : ch;
  }
  return out;
}

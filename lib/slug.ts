const SPECIAL: Record<string, string> = { ß: "ss", æ: "ae", Æ: "AE", œ: "oe", Œ: "OE", ø: "o", Ø: "O", đ: "d", Đ: "D", ł: "l", Ł: "L", þ: "th", Þ: "Th", ð: "d", Ð: "D", ı: "i", ħ: "h", ŋ: "ng", "&": " and ", "@": " at ", "%": " percent ", "€": " euro ", "£": " pound ", "$": " dollar " };

const CYRILLIC: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", є: "ye", і: "i", ї: "yi", ґ: "g" };
const GREEK: Record<string, string> = { α: "a", β: "b", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o" };
const ARABIC: Record<string, string> = { ا: "a", أ: "a", إ: "i", آ: "a", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh", د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", ة: "a", و: "w", ي: "y", ى: "a", ء: "" };

const STOP_WORDS = new Set("a an and are as at be but by for if in into is it no not of on or such that the their then there these they this to was will with".split(" "));

export interface SlugOptions {
  separator: string;
  lowercase: boolean;
  /** convert ä→a, ß→ss, Cyrillic/Greek/Arabic to Latin letters */
  transliterate: boolean;
  /** keep letters of any script (é, 日本語) instead of dropping non-ASCII */
  keepUnicode: boolean;
  removeStopWords: boolean;
  /** 0 = no limit */
  maxLength: number;
}

export const DEFAULT_SLUG: SlugOptions = { separator: "-", lowercase: true, transliterate: true, keepUnicode: false, removeStopWords: false, maxLength: 0 };

function mapChars(text: string): string {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const mapped = SPECIAL[ch] ?? CYRILLIC[lower] ?? GREEK[lower] ?? ARABIC[ch];
    if (mapped === undefined) out += ch;
    else out += ch !== lower && mapped.length > 0 && (CYRILLIC[lower] !== undefined || GREEK[lower] !== undefined) ? mapped[0].toUpperCase() + mapped.slice(1) : mapped;
  }
  return out;
}

function transliterate(text: string): string {
  // map first (so й stays "y"), then strip accents (é → e, ά → α), then map what the decomposition exposed
  return mapChars(mapChars(text).normalize("NFKD").replace(/\p{M}+/gu, ""));
}

export function slugify(input: string, o: SlugOptions): string {
  let text = input.trim();
  if (o.transliterate) text = transliterate(text);
  else if (!o.keepUnicode) text = text.normalize("NFKD").replace(/\p{M}+/gu, "");
  if (o.lowercase) text = text.toLowerCase();
  const keep = o.keepUnicode ? /[^\p{L}\p{N}]+/gu : /[^A-Za-z0-9]+/g;
  let words = text.replace(/['’]/g, "").split(keep).filter(Boolean);
  if (o.removeStopWords) {
    const kept = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
    if (kept.length > 0) words = kept;
  }
  let slug = words.join(o.separator);
  if (o.maxLength > 0 && slug.length > o.maxLength) {
    slug = slug.slice(0, o.maxLength);
    const cut = slug.lastIndexOf(o.separator);
    // end on a whole word unless that would leave almost nothing
    if (o.separator && cut > o.maxLength * 0.5 && slug.length === o.maxLength && words.join(o.separator)[o.maxLength] !== o.separator) slug = slug.slice(0, cut);
  }
  return slug;
}

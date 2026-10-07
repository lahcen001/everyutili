import type { IptvChannel } from "@/lib/iptv";

/** Lower-case, accent-free, punctuation-free text for matching. */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Names people actually type for a country, keyed by ISO code. */
const COUNTRY_ALIASES: Record<string, string[]> = {
  US: ["usa", "america", "united states of america", "us"],
  GB: ["uk", "england", "britain", "great britain", "scotland", "wales"],
  AE: ["uae", "emirates", "dubai", "abu dhabi"],
  SA: ["ksa", "saudi"],
  KR: ["south korea", "korea"],
  KP: ["north korea"],
  CZ: ["czech", "czech republic"],
  RU: ["russia"],
  IR: ["persia"],
  TR: ["turkey", "turkiye"],
  NL: ["holland"],
  CD: ["drc", "congo"],
  MM: ["burma"],
  VN: ["vietnam"],
  LA: ["laos"],
  MK: ["macedonia"],
  CI: ["ivory coast"],
  PS: ["palestine"],
  HK: ["hong kong"],
};

export interface CountryInfo {
  code: string;
  name: string;
  flag: string;
}

export interface SearchEntry {
  channel: IptvChannel;
  /** normalised channel name */
  name: string;
  nameWords: string[];
  /** normalised country name + aliases */
  country: string[];
  code: string;
  /** normalised category names */
  categories: string[];
}

export function buildIndex(channels: IptvChannel[], categoryNames: Map<string, string>): SearchEntry[] {
  return channels.map((channel) => {
    const code = (channel.countryCode ?? "").toLowerCase();
    const name = normalize(channel.name);
    return {
      channel,
      name,
      nameWords: name.split(" ").filter(Boolean),
      country: [normalize(channel.countryName ?? ""), ...(COUNTRY_ALIASES[channel.countryCode ?? ""] ?? [])].filter(Boolean),
      code,
      categories: channel.categories.map((id) => normalize(categoryNames.get(id) ?? id)),
    };
  });
}

/** Edit distance, giving up (returns max+1) once it exceeds `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** How many typos to forgive: none for short words, two for long ones. */
const typos = (token: string) => (token.length >= 6 ? 2 : 1);

function tokenScore(entry: SearchEntry, token: string, fuzzy: boolean): number {
  let best = 0;
  // channel name
  entry.nameWords.forEach((w, i) => {
    if (w === token) best = Math.max(best, i === 0 ? 16 : 12);
    else if (w.startsWith(token)) best = Math.max(best, i === 0 ? 14 : 10);
    else if (token.length >= 3 && w.includes(token)) best = Math.max(best, 5);
    else if (fuzzy && token.length >= 4 && distance(w, token, typos(token)) <= typos(token)) best = Math.max(best, 3);
  });
  // country
  for (const c of entry.country) {
    if (c === token) best = Math.max(best, 9);
    else if (token.length >= 2 && c.split(" ").some((w) => w.startsWith(token))) best = Math.max(best, 7);
    else if (fuzzy && token.length >= 4 && c.split(" ").some((w) => distance(w, token, typos(token)) <= typos(token))) best = Math.max(best, 3);
  }
  if (token.length === 2 && entry.code === token) best = Math.max(best, 9);
  // category
  for (const c of entry.categories) {
    if (c.split(" ").some((w) => w.startsWith(token))) best = Math.max(best, 4);
  }
  return best;
}

export interface SearchOptions {
  countryCode?: string;
  category?: string;
}

/**
 * Smart search: every word must match the channel name, its country (names, aliases like "uk" or
 * "usa", or the 2-letter code) or its category, so "morocco sports" or "bbc uk" just work.
 * Results are ranked by match quality; with no text the input order is kept. If nothing matches,
 * a one-typo-tolerant pass runs.
 */
export function searchChannels(entries: SearchEntry[], query: string, options: SearchOptions = {}): IptvChannel[] {
  const pool = entries.filter(
    (e) => (!options.countryCode || e.channel.countryCode === options.countryCode) && (!options.category || e.channel.categories.includes(options.category))
  );
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return pool.map((e) => e.channel);

  const run = (fuzzy: boolean) => {
    const hits: { channel: IptvChannel; score: number }[] = [];
    for (const entry of pool) {
      let total = 0;
      let ok = true;
      for (const token of tokens) {
        const s = tokenScore(entry, token, fuzzy);
        if (s === 0) {
          ok = false;
          break;
        }
        total += s;
      }
      if (ok) hits.push({ channel: entry.channel, score: total });
    }
    return hits;
  };

  let hits = run(false);
  if (hits.length === 0) hits = run(true);
  hits.sort((a, b) => b.score - a.score || a.channel.name.localeCompare(b.channel.name));
  return hits.map((h) => h.channel);
}

/** Countries that the typed text could be referring to (for one-tap country chips). */
export function suggestCountries(query: string, countries: CountryInfo[], limit = 4): CountryInfo[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const words = q.split(" ");
  const out: { c: CountryInfo; score: number }[] = [];
  for (const c of countries) {
    const names = [normalize(c.name), ...(COUNTRY_ALIASES[c.code] ?? [])];
    let score = 0;
    for (const n of names) {
      if (n === q) score = Math.max(score, 3);
      else if (n.startsWith(q)) score = Math.max(score, 2);
      else if (words.some((w) => w.length >= 3 && n.split(" ").some((nw) => nw.startsWith(w)))) score = Math.max(score, 1);
    }
    if (q.length === 2 && c.code.toLowerCase() === q) score = Math.max(score, 3);
    if (score) out.push({ c, score });
  }
  out.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  return out.slice(0, limit).map((o) => o.c);
}

/** The visitor's likely country from their browser language ("ar-MA" → "MA"). */
export function guessCountryCode(languages: readonly string[]): string | null {
  for (const lang of languages) {
    const m = /[-_]([A-Za-z]{2})\b/.exec(lang);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

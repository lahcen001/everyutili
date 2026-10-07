export const VALID_FLAGS = "dgimsuvy";

export interface RegexMatch {
  index: number;
  end: number;
  text: string;
  groups: (string | undefined)[];
  named: Record<string, string | undefined>;
  /** [start, end] of each capture group, when the d flag is on */
  ranges?: ([number, number] | undefined)[];
}

export type RegexMode = "match" | "replace" | "split";

export interface RegexRequest {
  pattern: string;
  flags: string;
  text: string;
  mode: RegexMode;
  replacement: string;
  limit?: number;
}

export interface RegexResponse {
  ok: boolean;
  error?: string;
  matches: RegexMatch[];
  /** true when more than `limit` matches exist */
  truncated: boolean;
  total: number;
  replaced?: string;
  parts?: string[];
}

/** Keep each flag once, in a stable order, dropping anything that isn't a flag. */
export function normalizeFlags(flags: string): string {
  return [...VALID_FLAGS].filter((f) => flags.includes(f)).join("");
}

export function runRegex(req: RegexRequest): RegexResponse {
  const empty: RegexResponse = { ok: true, matches: [], truncated: false, total: 0 };
  if (!req.pattern) return empty;
  const limit = req.limit ?? 1000;
  let regex: RegExp;
  try {
    // d gives capture positions; g is added for matching only (exec loop), so the UI flag stays honest
    regex = new RegExp(req.pattern, normalizeFlags(req.flags.replace("g", "") + "d" + "g"));
  } catch (e) {
    try {
      regex = new RegExp(req.pattern, normalizeFlags(req.flags.replace("g", "") + "g"));
    } catch (e2) {
      return { ...empty, ok: false, error: (e2 instanceof Error ? e2.message : String(e2)).replace(/^Invalid regular expression: /, "") };
    }
    void e;
  }
  const userGlobal = req.flags.includes("g");
  const matches: RegexMatch[] = [];
  let total = 0;
  const all = req.text.matchAll(regex);
  for (const m of all) {
    total++;
    if (matches.length < limit) {
      const index = m.index ?? 0;
      const indices = (m as RegExpMatchArray & { indices?: ([number, number] | undefined)[] }).indices;
      matches.push({
        index,
        end: index + m[0].length,
        text: m[0],
        groups: m.slice(1),
        named: { ...(m.groups ?? {}) },
        ranges: indices ? indices.slice(1) : undefined,
      });
    }
    if (!userGlobal) break;
  }
  const out: RegexResponse = { ok: true, matches, truncated: total > matches.length, total };
  if (req.mode === "replace") {
    const r = new RegExp(regex.source, regex.flags.replace("d", "").replace("g", userGlobal ? "g" : ""));
    out.replaced = req.text.replace(r, req.replacement);
  } else if (req.mode === "split") {
    out.parts = req.text.split(new RegExp(regex.source, regex.flags.replace("d", "").replace("g", "")));
  }
  return out;
}

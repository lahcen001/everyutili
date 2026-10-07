import { createTwoFilesPatch, diffLines } from "diff";

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
  identical: boolean;
}

/** CRLF and a missing final newline are not real differences for most people. */
export const normalizeEol = (s: string) => s.replace(/\r\n?/g, "\n");

/** With ignore options on, lines are compared (and the patch is written) in their loosened form. */
function loosen(text: string, o: DiffOptions): string {
  let x = normalizeEol(text);
  if (o.ignoreWhitespace) x = x.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).join("\n");
  if (o.ignoreCase) x = x.toLowerCase();
  return x;
}

export function diffStats(a: string, b: string, o: DiffOptions): DiffStats {
  const parts = diffLines(loosen(a, o), loosen(b, o));
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const p of parts) {
    const n = p.count ?? 0;
    if (p.added) added += n;
    else if (p.removed) removed += n;
    else unchanged += n;
  }
  return { added, removed, unchanged, identical: added === 0 && removed === 0 };
}

export function unifiedPatch(a: string, b: string, o: DiffOptions, names: { original: string; modified: string } = { original: "original", modified: "modified" }): string {
  return createTwoFilesPatch(names.original, names.modified, loosen(a, o), loosen(b, o), "", "", { context: 3 });
}

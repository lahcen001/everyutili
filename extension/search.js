// Shared fuzzy/keyword search scoring for newtab.js and popup.js. Plain
// script (no bundler in this extension), so it exposes a small global —
// load this after tools-data.js and before newtab.js/popup.js.
(function () {
  "use strict";

  // Small hand-written Levenshtein distance — only ever called against a
  // tool's short name/keywords (a handful of words) for ~80 tools, so an
  // O(n*m) DP table is more than fast enough without needing a library.
  function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    let prevRow = new Array(n + 1);
    let currRow = new Array(n + 1);
    for (let j = 0; j <= n; j++) prevRow[j] = j;

    for (let i = 1; i <= m; i++) {
      currRow[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        currRow[j] = Math.min(currRow[j - 1] + 1, prevRow[j] + 1, prevRow[j - 1] + cost);
      }
      [prevRow, currRow] = [currRow, prevRow];
    }
    return prevRow[n];
  }

  function initials(name) {
    return name
      .split(/[\s/&-]+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .toLowerCase();
  }

  // Query terms that carry no format/task-specific meaning on their own
  // ("convert to jpg" and "jpg" should score the same way against a tool
  // named "PNG to JPG"). Stripped only for the keyword-substring check so a
  // source-agnostic phrasing still lands on the tool's own name-based tiers
  // when the leftover text is empty.
  const FILLER_WORDS = new Set(["convert", "converter", "to", "into", "as", "a", "an", "the"]);

  function scoreMatch(tool, query) {
    const name = tool.name.toLowerCase();
    const slug = tool.slug.toLowerCase();
    const keywords = tool.keywords || [];

    if (name.startsWith(query)) return 5;
    if (name.includes(query)) return 4;

    // Keyword phrases are authored per-tool (messages/en.json) to cover
    // exactly this case: "convert to jpg" has no lexical overlap with "PNG
    // to JPG" the tool name, but it IS one of that tool's keyword phrases.
    for (const kw of keywords) {
      const k = kw.toLowerCase();
      if (k === query || k.startsWith(query) || k.includes(query)) return 4.5;
    }

    if (slug.includes(query)) return 3;

    if (query.length <= 4) {
      if (initials(tool.name) === query) return 3.5;
      if (initials(tool.name).startsWith(query)) return 2.5;
    }

    // Fuzzy fallback: only worth trying for reasonably short queries, and
    // only when nothing above already matched — avoids wasting cycles
    // scoring every tool on every keystroke. Compares the whole query
    // against the whole name (catches "jpeg to png" -> "jpg to png") AND,
    // for a single-word query, against each individual word of the name or
    // of a keyword phrase (catches "jpeg" -> the "jpg" in "JPG to PNG").
    if (query.length >= 3 && query.length <= 24) {
      let best = levenshtein(query, name);

      if (!query.includes(" ")) {
        for (const word of name.split(/\s+/)) {
          const dist = levenshtein(query, word);
          if (dist < best) best = dist;
        }
        for (const kw of keywords) {
          for (const word of kw.toLowerCase().split(/\s+/)) {
            if (FILLER_WORDS.has(word)) continue;
            const dist = levenshtein(query, word);
            if (dist < best) best = dist;
          }
        }
      }

      const maxAllowed = query.length <= 5 ? 1 : query.length <= 10 ? 2 : 3;
      if (best <= maxAllowed) return 2 - best * 0.2;
    }

    return 0;
  }

  window.EveryUtiliSearch = { scoreMatch, levenshtein, initials };
})();

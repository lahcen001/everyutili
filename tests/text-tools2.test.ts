import { describe, expect, it } from "vitest";
import { decodeEntities, encodeEntities, ENTITY_TABLE } from "@/lib/htmlEntities";
import { processLines, type LineOptions } from "@/lib/lines";
import { classify, cleanInvisible, countByCategory, revealInvisible, scanInvisible, CATEGORY_INFO, type InvisibleCategory } from "@/lib/invisibleChars";
import { DEFAULT_LOREM, countText, generateLorem } from "@/lib/lorem";

describe("html entities", () => {
  it("encodes minimal, non-ascii and all", () => {
    expect(encodeEntities(`<a href="x">Tom & 'Jerry'</a>`, { scope: "minimal", style: "named" })).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;");
    expect(encodeEntities("café © 日", { scope: "non-ascii", style: "named" })).toBe("caf&eacute; &copy; &#26085;");
    expect(encodeEntities("é", { scope: "non-ascii", style: "hex" })).toBe("&#xE9;");
    expect(encodeEntities("é", { scope: "non-ascii", style: "decimal" })).toBe("&#233;");
    expect(encodeEntities("ab", { scope: "all", style: "decimal" })).toBe("&#97;&#98;");
    expect(encodeEntities("a\nb", { scope: "all", style: "decimal" })).toBe("&#97;\n&#98;");
  });
  it("handles astral characters as one code point", () => {
    expect(encodeEntities("😀", { scope: "non-ascii", style: "decimal" })).toBe("&#128512;");
    expect(decodeEntities("&#128512;&#x1F600;")).toBe("😀😀");
  });
  it("decodes named, decimal and hex, leaving unknown or invalid ones", () => {
    expect(decodeEntities("&lt;p&gt; &amp;amp; &copy; &euro; &#65; &#x41; &nbsp;|")).toBe("<p> &amp; © € A A  |");
    expect(decodeEntities("&bogus; &#0; &#xD800; &amp")).toBe("&bogus; &#0; &#xD800; &amp");
  });
  it("round-trips", () => {
    const s = `5 < 6 & "quotes" é ñ — ✓`;
    for (const style of ["named", "decimal", "hex"] as const) expect(decodeEntities(encodeEntities(s, { scope: "non-ascii", style }))).toBe(s);
  });
  it("has a reference table", () => {
    expect(ENTITY_TABLE.find((e) => e.name === "copy")?.char).toBe("©");
  });
});

describe("processLines", () => {
  const base: LineOptions = { mode: "unique", caseInsensitive: false, trim: false, removeEmpty: false, sort: "none" };
  it("removes duplicates keeping first occurrence and reports counts correctly", () => {
    const r = processLines("a\nb\na\n\n\nc\nb\n", { ...base, removeEmpty: true });
    expect(r.lines).toEqual(["a", "b", "c"]);
    expect(r.inputLines).toBe(7);
    expect(r.emptyRemoved).toBe(2);
    expect(r.duplicatesRemoved).toBe(2);
  });
  it("is case-insensitive and trims when asked", () => {
    expect(processLines("A\na\n a \nb", { ...base, caseInsensitive: true, trim: true }).lines).toEqual(["A", "b"]);
  });
  it("shows only duplicates, only-unique lines and counts", () => {
    expect(processLines("a\nb\na\nc", { ...base, mode: "duplicates" }).lines).toEqual(["a"]);
    expect(processLines("a\nb\na\nc", { ...base, mode: "only-unique" }).lines).toEqual(["b", "c"]);
    expect(processLines("a\nb\na", { ...base, mode: "count" }).lines).toEqual(["2\ta", "1\tb"]);
  });
  it("sorts naturally, by length, reversed and shuffled", () => {
    expect(processLines("item10\nitem2\nitem1", { ...base, sort: "natural" }).lines).toEqual(["item1", "item2", "item10"]);
    expect(processLines("ccc\na\nbb", { ...base, sort: "length" }).lines).toEqual(["a", "bb", "ccc"]);
    expect(processLines("a\nb\nc", { ...base, sort: "reverse" }).lines).toEqual(["c", "b", "a"]);
    expect(processLines("a\nb\nc\nd", { ...base, sort: "shuffle" }, () => 0).lines.sort()).toEqual(["a", "b", "c", "d"]);
  });
  it("handles empty input and CRLF", () => {
    expect(processLines("", base).lines).toEqual([]);
    expect(processLines("a\r\na\r\nb", base).lines).toEqual(["a", "b"]);
  });
});

describe("invisible characters", () => {
  const sample = "a​b c‍d‮e­f\u{E0041}";
  it("finds and classifies characters", () => {
    const hits = scanInvisible(sample);
    expect(hits.map((h) => h.category)).toEqual(["zero-width", "space", "joiner", "bidi", "soft-hyphen", "tag"]);
    expect(hits[0].index).toBe(1);
    expect(countByCategory(hits)["bidi"]).toBe(1);
    expect(classify(65)).toBeNull();
    expect(classify(0x0a)).toBeNull();
    expect(classify(0x00)).toBe("control");
  });
  it("removes chosen categories, turns odd spaces into spaces and keeps joiners by default", () => {
    const defaults = new Set(Object.entries(CATEGORY_INFO).filter(([, v]) => v.removeByDefault).map(([k]) => k as InvisibleCategory));
    expect(cleanInvisible(sample, defaults)).toBe("ab c‍d" + "ef");
  });
  it("keeps emoji sequences intact when joiners are kept", () => {
    const family = "👨‍👩‍👧";
    const defaults = new Set(Object.entries(CATEGORY_INFO).filter(([, v]) => v.removeByDefault).map(([k]) => k as InvisibleCategory));
    expect(cleanInvisible(family, defaults)).toBe(family);
  });
  it("reveals characters as badges", () => {
    expect(revealInvisible("a​b")).toBe("a⟦U+200B⟧b");
  });
});

describe("lorem", () => {
  const seeded = () => {
    let s = 7;
    return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  };
  it("produces the requested number of paragraphs and starts with the classic line", () => {
    const text = generateLorem({ ...DEFAULT_LOREM, count: 3 }, seeded());
    expect(text.split("\n\n")).toHaveLength(3);
    expect(text.startsWith("Lorem ipsum dolor sit amet, consectetur adipiscing elit")).toBe(true);
  });
  it("produces exact word and sentence counts", () => {
    const words = generateLorem({ ...DEFAULT_LOREM, unit: "words", count: 25 }, seeded());
    expect(countText(words).words).toBe(25);
    const sentences = generateLorem({ ...DEFAULT_LOREM, unit: "sentences", count: 4, startWithLorem: false }, seeded());
    expect(sentences.match(/\./g)).toHaveLength(4);
  });
  it("formats html and lists", () => {
    expect(generateLorem({ ...DEFAULT_LOREM, count: 2, format: "html" }, seeded())).toMatch(/^<p>[\s\S]*<\/p>\n<p>/);
    const list = generateLorem({ ...DEFAULT_LOREM, unit: "sentences", count: 3, format: "list" }, seeded());
    expect(list.match(/<li>/g)).toHaveLength(3);
  });
  it("respects word limits per sentence", () => {
    const t = generateLorem({ ...DEFAULT_LOREM, unit: "sentences", count: 20, startWithLorem: false, sentenceWords: [5, 5], format: "list" }, seeded());
    for (const li of t.match(/<li>(.*?)<\/li>/g) ?? []) expect(countText(li).words).toBe(5);
  });
});

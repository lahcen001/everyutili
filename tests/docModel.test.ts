// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { blocksToHtml, parseHtml, parseMarkdown, parsePlainText, runsToText, type Block } from "@/lib/office/docModel";

describe("parseMarkdown", () => {
  it("keeps headings, inline emphasis, links and code spans", () => {
    const [h, p] = parseMarkdown("## Title\n\nHello **bold** and *it* `code` [site](https://a.b)");
    expect(h).toMatchObject({ type: "heading", level: 2 });
    expect(p.type).toBe("paragraph");
    const runs = (p as Extract<Block, { type: "paragraph" }>).runs;
    expect(runs.find((r) => r.text === "bold")?.bold).toBe(true);
    expect(runs.find((r) => r.text === "it")?.italic).toBe(true);
    expect(runs.find((r) => r.text === "code")?.code).toBe(true);
    expect(runs.find((r) => r.text === "site")?.href).toBe("https://a.b");
  });

  it("flattens nested lists with levels and keeps ordered flag", () => {
    const [list] = parseMarkdown("- a\n  - b\n    - c\n- d");
    expect(list).toMatchObject({ type: "list", ordered: false });
    const items = (list as Extract<Block, { type: "list" }>).items;
    expect(items.map((i) => [runsToText(i.runs), i.level])).toEqual([["a", 0], ["b", 1], ["c", 2], ["d", 0]]);
    expect(parseMarkdown("1. x\n2. y")[0]).toMatchObject({ ordered: true });
  });

  it("parses tables, quotes, code blocks and rules", () => {
    const blocks = parseMarkdown("| h1 | h2 |\n|---|---|\n| a | **b** |\n\n> quoted\n\n```\ncode here\n```\n\n---");
    const table = blocks.find((b) => b.type === "table") as Extract<Block, { type: "table" }>;
    expect(table.header?.map(runsToText)).toEqual(["h1", "h2"]);
    expect(table.rows[0].map(runsToText)).toEqual(["a", "b"]);
    expect(table.rows[0][1][0].bold).toBe(true);
    expect(blocks.find((b) => b.type === "quote")).toBeDefined();
    expect(blocks.find((b) => b.type === "code")).toMatchObject({ text: "code here" });
    expect(blocks.some((b) => b.type === "rule")).toBe(true);
  });

  it("decodes entities and keeps text of raw HTML instead of dropping it", () => {
    const [p] = parseMarkdown("Tom & Jerry <3");
    expect(runsToText((p as Extract<Block, { type: "paragraph" }>).runs)).toBe("Tom & Jerry <3");
  });
});

describe("parsePlainText", () => {
  it("splits on blank lines and keeps single line breaks", () => {
    const blocks = parsePlainText("one\ntwo\n\n\nthree");
    expect(blocks).toHaveLength(2);
    expect(runsToText((blocks[0] as Extract<Block, { type: "paragraph" }>).runs)).toBe("one\ntwo");
  });
});

describe("parseHtml", () => {
  it("reads headings, nested lists, tables and inline styles through wrapper divs", () => {
    const blocks = parseHtml(
      "<div><h1>T</h1><p>a <b>b</b> <i>c</i> <a href='https://x.y'>l</a></p><ul><li>one<ul><li>two</li></ul></li></ul>" +
        "<table><tr><th>H</th></tr><tr><td>v</td></tr></table></div>"
    );
    expect(blocks[0]).toMatchObject({ type: "heading", level: 1 });
    const p = blocks[1] as Extract<Block, { type: "paragraph" }>;
    expect(p.runs.find((r) => r.text === "b")?.bold).toBe(true);
    expect(p.runs.find((r) => r.text === "l")?.href).toBe("https://x.y");
    const list = blocks[2] as Extract<Block, { type: "list" }>;
    expect(list.items.map((i) => [runsToText(i.runs), i.level])).toEqual([["one", 0], ["two", 1]]);
    const table = blocks[3] as Extract<Block, { type: "table" }>;
    expect(table.header?.map(runsToText)).toEqual(["H"]);
    expect(table.rows[0].map(runsToText)).toEqual(["v"]);
  });

  it("ignores scripts and falls back to loose text", () => {
    expect(parseHtml("<script>alert(1)</script><p>safe</p>")).toHaveLength(1);
    expect(parseHtml("just text")).toHaveLength(1);
  });
});

describe("blocksToHtml", () => {
  it("escapes text and drops unsafe links", () => {
    const html = blocksToHtml([
      { type: "paragraph", runs: [{ text: "<img src=x onerror=alert(1)>" }, { text: "bad", href: "javascript:alert(1)" }, { text: "ok", href: "https://ok.dev", bold: true }] },
    ]);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('<a href="https://ok.dev"><strong>ok</strong></a>');
  });
});

describe("images", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  it("keeps only data-URL images (also inside paragraphs) and renders them safely", () => {
    const blocks = parseHtml(`<p>text <img src="${png}" alt="a"></p><img src="https://evil.test/x.png"><img src="javascript:alert(1)">`);
    const images = blocks.filter((b) => b.type === "image");
    expect(images).toHaveLength(1);
    expect(blocksToHtml(blocks)).toContain(`<img src="${png}"`);
    expect(blocksToHtml(blocks)).not.toContain("evil.test");
  });
});

import { blocksToMarkdown } from "@/lib/office/docModel";

describe("blocksToMarkdown", () => {
  it("round-trips a rich document through Markdown", () => {
    const source = `# Title

Hello **bold**, *it* and [link](https://a.b).

- one
  - nested
- two

1. a
2. b

| h1 | h2 |
| --- | --- |
| x | **y** |

> quote

\`\`\`
code
\`\`\`

---
`;
    const once = blocksToMarkdown(parseMarkdown(source));
    expect(once).toContain("# Title");
    expect(once).toContain("**bold**");
    expect(once).toContain("[link](https://a.b)");
    expect(once).toContain("  - nested");
    expect(once).toContain("| x | **y** |");
    // Stable: re-parsing and re-serializing gives the same text.
    expect(blocksToMarkdown(parseMarkdown(once))).toBe(once);
  });

  it("escapes characters that would change meaning, and drops unsafe links", () => {
    const md = blocksToMarkdown([
      { type: "paragraph", runs: [{ text: "2 * 3 [x] _lead" }] },
      { type: "paragraph", runs: [{ text: "# not a heading" }] },
      { type: "paragraph", runs: [{ text: "bad", href: "javascript:alert(1)" }] },
      { type: "table", header: [[{ text: "a|b" }]], rows: [[[{ text: "c" }]]] },
    ]);
    expect(md).toContain("2 \\* 3 \\[x\\] \\_lead");
    expect(md).toContain("\\# not a heading");
    expect(md).not.toContain("javascript:");
    expect(md).toContain("a\\|b");
  });

  it("numbers ordered lists per level and writes images", () => {
    const md = blocksToMarkdown([
      { type: "list", ordered: true, items: [{ runs: [{ text: "a" }], level: 0 }, { runs: [{ text: "b" }], level: 1 }, { runs: [{ text: "c" }], level: 1 }, { runs: [{ text: "d" }], level: 0 }] },
      { type: "image", src: "data:image/png;base64,AAAA", alt: "pic" },
    ]);
    expect(md).toContain("1. a\n  1. b\n  2. c\n2. d");
    expect(md).toContain("![pic](data:image/png;base64,AAAA)");
  });
});

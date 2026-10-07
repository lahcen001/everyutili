// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { DEFAULT_COVER, addHeadingIds, coverHtml, pageContentHeightPx, pageIndexAt, printedPage, tocHtml } from "@/lib/office/composeDocument";
import { DEFAULT_PAGE } from "@/lib/office/pageSettings";
import { applyOverrides, NO_OVERRIDES, shade } from "@/lib/office/docStyle";
import { DOC_THEMES } from "@/lib/office/docThemes";
import { fillVariables, pageLabels } from "@/lib/office/headerFooter";

describe("addHeadingIds / tocHtml", () => {
  const html = "<h1>One</h1><p>x</p><h2>Two &amp; more</h2><h3>Deep</h3><h2></h2>";
  it("ids and lists headings up to the chosen level, skipping empty ones", () => {
    const r = addHeadingIds(html, 2);
    expect(r.entries.map((e) => [e.level, e.text])).toEqual([[1, "One"], [2, "Two & more"]]);
    expect(r.html).toContain('id="toc-0"');
    expect(r.html).toContain('id="toc-1"');
    expect(r.html).not.toContain('id="toc-2"');
  });
  it("builds a contents block with page numbers, escaped text and a forced break after it", () => {
    const { entries } = addHeadingIds("<h1>A <b>&lt;x&gt;</b></h1><h2>B</h2>", 3);
    const toc = tocHtml(entries, [3, 5], "Contents");
    expect(toc).toContain("Contents");
    expect(toc).toContain("&lt;x&gt;");
    expect(toc).toContain(">3<");
    expect(toc).toContain(">5<");
    expect(toc).toContain("data-page-break");
    expect(tocHtml([], [], "Contents")).toBe("");
  });
});

describe("coverHtml", () => {
  it("is empty when disabled and fills one page when enabled", () => {
    expect(coverHtml(DEFAULT_COVER, 1000, DOC_THEMES[0])).toBe("");
    const h = coverHtml({ enabled: true, title: "Q3 <Report>", subtitle: "Sub", author: "Ada", date: "7 Oct 2026" }, 1000, DOC_THEMES[0]);
    expect(h).toContain("Q3 &lt;Report&gt;");
    expect(h).toContain("height:998px");
    expect(h).toContain("data-page-break");
  });
});

describe("page numbering", () => {
  it("finds the page for a vertical position and offsets for cover pages", () => {
    const slices = [{ start: 0, end: 100 }, { start: 100, end: 250 }, { start: 250, end: 400 }];
    expect(pageIndexAt(slices, 0)).toBe(0);
    expect(pageIndexAt(slices, 100)).toBe(1);
    expect(pageIndexAt(slices, 999)).toBe(2);
    expect(printedPage(1, 1)).toBe(1);
    expect(printedPage(2, 1)).toBe(2);
    expect(printedPage(3, 0)).toBe(4);
  });
  it("computes A4 content height", () => {
    expect(pageContentHeightPx(DEFAULT_PAGE)).toBe(Math.round(((297 - 50.8) / 25.4) * 96));
  });
});

describe("header / footer", () => {
  const ctx = { page: 3, pages: 10, title: "Report", author: "Ada", date: "7 Oct" };
  it("fills variables case-insensitively and leaves unknown ones", () => {
    expect(fillVariables("Page {page} of {PAGES} — {title} by {author}, {date} {x}", ctx)).toBe("Page 3 of 10 — Report by Ada, 7 Oct {x}");
  });
  it("adds the page number unless the footer already has {page}", () => {
    const base = { headerText: "{title}", footerText: "Confidential", pageNumbers: true };
    expect(pageLabels(base, ctx)).toEqual({ header: "Report", footer: "Confidential   ·   3" });
    expect(pageLabels({ ...base, footerText: "Page {page} of {pages}" }, ctx).footer).toBe("Page 3 of 10");
    expect(pageLabels({ ...base, footerText: "", pageNumbers: false }, ctx).footer).toBe("");
  });
});

describe("style overrides", () => {
  it("changes font, accent and spacing but leaves the rest", () => {
    const base = DOC_THEMES[0];
    const t = applyOverrides(base, { fontId: "georgia", accent: "dc2626", lineHeight: 1.8 });
    expect(t.cssFont).toContain("Georgia");
    expect(t.font).toBe("Georgia");
    expect(t.accent).toBe("DC2626");
    expect(t.lineHeight).toBe(1.8);
    expect(t.baseSize).toBe(base.baseSize);
    expect(applyOverrides(base, NO_OVERRIDES)).toEqual(base);
    expect(applyOverrides(base, { fontId: "theme", accent: "nothex", lineHeight: 9 })).toEqual(base);
  });
  it("shades toward white and black", () => {
    expect(shade("000000", 1)).toBe("FFFFFF");
    expect(shade("FFFFFF", -1)).toBe("000000");
    expect(shade("808080", 0)).toBe("808080");
  });
});

import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN, PRESETS, escapeXml, renderQr, type QrDesign } from "@/lib/qrStyle";

const matrix = (text: string) => QRCode.create(text, { errorCorrectionLevel: "H" }).modules as { size: number; data: ArrayLike<number> };

describe("styled QR rendering", () => {
  const m = matrix("https://everyutili.com");

  it("builds a valid, square SVG for the default design", () => {
    const r = renderQr(m, DEFAULT_DESIGN);
    expect(r.svg.startsWith("<svg")).toBe(true);
    expect(r.svg.endsWith("</svg>")).toBe(true);
    expect(r.width).toBe(m.size + 4);
    expect(r.height).toBe(m.size + 4);
    expect((r.svg.match(/<path/g) ?? []).length).toBe(2);
  });

  it("draws different shapes for different module and eye styles", () => {
    const shapes = (["square", "rounded", "dots", "classy", "diamond"] as const).map((moduleStyle) => renderQr(m, { ...DEFAULT_DESIGN, moduleStyle }).svg);
    expect(new Set(shapes).size).toBe(5);
    const eyes = (["square", "rounded", "circle", "leaf"] as const).map((eyeStyle) => renderQr(m, { ...DEFAULT_DESIGN, eyeStyle }).svg);
    expect(new Set(eyes).size).toBe(4);
  });

  it("uses a gradient only when the two colours differ", () => {
    expect(renderQr(m, DEFAULT_DESIGN).svg).not.toContain("linearGradient");
    const g = renderQr(m, { ...DEFAULT_DESIGN, fg: "#ff0000", fg2: "#0000ff" }).svg;
    expect(g).toContain("linearGradient");
    expect(g).toContain('stop-color="#0000ff"');
  });

  it("adds a title and makes room for it", () => {
    const base = renderQr(m, DEFAULT_DESIGN);
    const withTitle = renderQr(m, { ...DEFAULT_DESIGN, title: { text: "Café <Wi-Fi> & more", position: "bottom", color: "#111111" } });
    expect(withTitle.height).toBeGreaterThan(base.height);
    expect(withTitle.svg).toContain("Café &lt;Wi-Fi&gt; &amp; more");
    const top = renderQr(m, { ...DEFAULT_DESIGN, title: { text: "Top", position: "top", color: "#000" } });
    expect(top.height).toBe(withTitle.height);
    const longTitle = renderQr(m, { ...DEFAULT_DESIGN, title: { text: "x".repeat(80), position: "bottom", color: "#000" } });
    expect(longTitle.svg).toContain("textLength");
  });

  it("frames the code and adds a label bar", () => {
    const bar = renderQr(m, { ...DEFAULT_DESIGN, frame: "bar", frameLabel: "SCAN ME" });
    expect(bar.svg).toContain("SCAN ME");
    expect(bar.height).toBeGreaterThan(bar.width);
    expect(renderQr(m, { ...DEFAULT_DESIGN, frame: "line" }).svg).toContain('fill="none"');
  });

  it("puts a logo in the middle and clears the modules behind it", () => {
    const withLogo = renderQr(m, { ...DEFAULT_DESIGN, logo: { url: "data:image/png;base64,AAAA", ratio: 0.22, shape: "circle", plate: true } });
    expect(withLogo.svg).toContain("<image");
    expect(withLogo.svg).toContain("clipPath");
    const plain = renderQr(m, DEFAULT_DESIGN);
    const pathLen = (s: string) => (s.match(/d="([^"]*)"/g) ?? []).join("").length;
    expect(pathLen(withLogo.svg)).toBeLessThan(pathLen(plain.svg));
  });

  it("every preset renders", () => {
    for (const p of PRESETS) {
      const d: QrDesign = { ...DEFAULT_DESIGN, ...p.design };
      expect(renderQr(m, d).svg).toContain("<svg");
    }
    expect(escapeXml('a"b')).toBe("a&quot;b");
  });
});

import { PAPERS, pageCount, parseRows, sheetGeometry, sheetHtml } from "@/lib/qrSheet";

describe("print sheet", () => {
  const a4 = PAPERS[0];
  it("fits codes on a page", () => {
    const g = sheetGeometry({ paper: a4, columns: 3, margin: 10, gap: 5 }, 1);
    expect(g.cellW).toBeCloseTo((210 - 20 - 10) / 3, 5);
    expect(g.rows).toBe(Math.floor((277 + 5) / (g.cellW + 5)));
    expect(g.perPage).toBe(3 * g.rows);
    expect(sheetGeometry({ paper: a4, columns: 6, margin: 10, gap: 5 }, 1).rows).toBeGreaterThan(g.rows);
    expect(sheetGeometry({ paper: a4, columns: 1, margin: 10, gap: 5 }, 10).rows).toBe(1);
    expect(pageCount(0, 12)).toBe(0);
    expect(pageCount(25, 12)).toBe(3);
  });
  it("builds printable HTML with one page per sheet", () => {
    const html = sheetHtml(Array(30).fill("<svg></svg>"), { paper: a4, columns: 4, margin: 10, gap: 4 }, 1.1, true);
    const per = sheetGeometry({ paper: a4, columns: 4, margin: 10, gap: 4 }, 1.1).perPage;
    expect((html.match(/class="page"/g) ?? []).length).toBe(Math.ceil(30 / per));
    expect(html).toContain("@page");
    expect(html).toContain("dashed");
    expect(sheetHtml(["<svg></svg>"], { paper: a4, columns: 2, margin: 10, gap: 4 }, 1, false)).not.toContain("dashed");
  });
  it("reads pasted rows", () => {
    expect(parseRows("Table 1 | https://a.com/1\nhttps://b.com\n\n  | \nWi-Fi | WIFI:S:x;;")).toEqual([
      { title: "Table 1", content: "https://a.com/1" },
      { title: "", content: "https://b.com" },
      { title: "Wi-Fi", content: "WIFI:S:x;;" },
    ]);
  });
});

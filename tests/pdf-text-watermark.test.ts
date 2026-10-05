import { describe, expect, it } from "vitest";
import { itemsToLines, reflowLines, type PdfTextItem } from "@/lib/pdf/text";
import { originForCentre, watermarkPlacements } from "@/lib/pdf/watermark";

const item = (str: string, x: number, y: number, width = str.length * 5, height = 10): PdfTextItem => ({ str, transform: [10, 0, 0, 10, x, y], width, height });

describe("itemsToLines", () => {
  it("groups items on a baseline, orders left to right and top to bottom", () => {
    const lines = itemsToLines([item("world", 40, 700), item("Hello", 0, 700), item("second line", 0, 680)]);
    expect(lines).toEqual(["Hello world", "second line"]);
  });
  it("only inserts a space where there is a gap", () => {
    expect(itemsToLines([item("Hel", 0, 700, 15), item("lo", 15, 700, 10)])).toEqual(["Hello"]);
    expect(itemsToLines([item("Hello", 0, 700, 25), item("there", 31, 700, 25)])).toEqual(["Hello there"]);
  });
  it("tolerates tiny baseline differences and skips empty items", () => {
    expect(itemsToLines([item("a", 0, 700.5), item("b", 20, 699.8), item("", 30, 700)])).toEqual(["a b"]);
    expect(itemsToLines([])).toEqual([]);
  });
});

describe("reflowLines", () => {
  it("joins wrapped lines into paragraphs and mends hyphenation", () => {
    const text = reflowLines([
      "This sentence is wrapped across several lines because the page",
      "was narrow and it finally ends here.",
      "Next paragraph starts with a long line that has no end and con-",
      "tinues on the following line.",
    ]);
    expect(text).toBe("This sentence is wrapped across several lines because the page was narrow and it finally ends here.\n\nNext paragraph starts with a long line that has no end and continues on the following line.");
  });
  it("keeps short heading-like lines separate", () => {
    expect(reflowLines(["Chapter One", "Body text that is long enough to be a full line of text here."])).toBe("Chapter One\n\nBody text that is long enough to be a full line of text here.");
  });
});

describe("watermark geometry", () => {
  it("rotates about the centre: the centre stays put for any angle", () => {
    for (const angle of [0, 30, 45, 90, -45, 180]) {
      const w = 200;
      const h = 40;
      const { x, y } = originForCentre(300, 400, w, h, angle);
      const t = (angle * Math.PI) / 180;
      // centre of the rotated rectangle = origin + R * (w/2, h/2)
      const cx = x + ((w / 2) * Math.cos(t) - (h / 2) * Math.sin(t));
      const cy = y + ((w / 2) * Math.sin(t) + (h / 2) * Math.cos(t));
      expect(cx).toBeCloseTo(300);
      expect(cy).toBeCloseTo(400);
    }
  });

  it("centres a single watermark and keeps corner ones inside the margins", () => {
    const [c] = watermarkPlacements({ pageWidth: 600, pageHeight: 800, width: 200, height: 50, position: "center", rotation: 0 });
    expect(c.x + 100).toBeCloseTo(300);
    expect(c.y + 25).toBeCloseTo(400);
    const [br] = watermarkPlacements({ pageWidth: 600, pageHeight: 800, width: 200, height: 50, position: "bottom-right", rotation: 0, margin: 30 });
    expect(br.x + 200).toBeCloseTo(570);
    expect(br.y).toBeCloseTo(30);
    const [tl] = watermarkPlacements({ pageWidth: 600, pageHeight: 800, width: 200, height: 50, position: "top-left", rotation: 0, margin: 30 });
    expect(tl.x).toBeCloseTo(30);
    expect(tl.y + 50).toBeCloseTo(770);
  });

  it("tiles across the whole page and stays finite for any size", () => {
    const tiles = watermarkPlacements({ pageWidth: 600, pageHeight: 800, width: 150, height: 40, position: "tiled", rotation: 30 });
    expect(tiles.length).toBeGreaterThan(20);
    expect(tiles.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.rotation === 30)).toBe(true);
    const tiny = watermarkPlacements({ pageWidth: 600, pageHeight: 800, width: 0.5, height: 0.5, position: "tiled", rotation: 0 });
    expect(tiny.length).toBeLessThan(10000);
  });
});

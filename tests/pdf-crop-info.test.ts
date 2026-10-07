import { PDFDocument, PDFName, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { clampMargins, cropPdf, detectContentMargins, marginsToBox } from "@/lib/pdf/crop";
import { applyPdfInfo, fromLocalInput, paperName, pointsToMm, readPdfInfo, toLocalInput, EMPTY_INFO } from "@/lib/pdf/info";

const box = { x: 0, y: 0, width: 600, height: 800 };

describe("marginsToBox", () => {
  it("crops the matching edges on an unrotated page", () => {
    const b = marginsToBox(box, 0, { top: 0.1, right: 0.2, bottom: 0.05, left: 0.0 });
    expect(b.x).toBeCloseTo(0);
    expect(b.y).toBeCloseTo(40); // bottom 5% of 800
    expect(b.width).toBeCloseTo(480);
    expect(b.height).toBeCloseTo(680);
  });
  it("maps displayed edges to the right user-space edges on rotated pages", () => {
    // rotated 90° clockwise: the displayed top is the user-space left edge
    const b90 = marginsToBox(box, 90, { top: 0.1, right: 0, bottom: 0, left: 0 });
    expect(b90.x).toBeCloseTo(60);
    expect(b90.width).toBeCloseTo(540);
    expect(b90.y).toBeCloseTo(0);
    // 180°: displayed top is the user-space bottom
    const b180 = marginsToBox(box, 180, { top: 0.1, right: 0, bottom: 0, left: 0 });
    expect(b180.y).toBeCloseTo(80);
    expect(b180.height).toBeCloseTo(720);
    // 270°: displayed top is the user-space right edge
    const b270 = marginsToBox(box, 270, { top: 0.1, right: 0, bottom: 0, left: 0 });
    expect(b270.x).toBeCloseTo(0);
    expect(b270.width).toBeCloseTo(540);
    // displayed left on 90° is the user-space bottom
    expect(marginsToBox(box, 90, { top: 0, right: 0, bottom: 0, left: 0.25 }).y).toBeCloseTo(200);
  });
  it("respects a box that doesn't start at the origin", () => {
    const b = marginsToBox({ x: 10, y: 20, width: 100, height: 100 }, 0, { top: 0, right: 0, bottom: 0, left: 0.5 });
    expect(b).toEqual({ x: 60, y: 20, width: 50, height: 100 });
  });
  it("never lets margins swallow the page", () => {
    const m = clampMargins({ top: 0.8, bottom: 0.8, left: 2, right: -1 });
    expect(m.top + m.bottom).toBeLessThanOrEqual(0.9001);
    expect(m.left).toBeLessThanOrEqual(0.9);
    expect(m.right).toBe(0);
  });
});

describe("cropPdf", () => {
  it("sets the crop box only on the chosen pages, from the full page each time", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    doc.addPage([600, 800]);
    const bytes = await doc.save();
    const margins = new Map([[0, { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 }]]);
    const once = await cropPdf(bytes, margins);
    const twice = await cropPdf(once, margins);
    for (const out of [once, twice]) {
      const d = await PDFDocument.load(out);
      expect(d.getPage(0).getCropBox()).toEqual({ x: 60, y: 80, width: 480, height: 640 });
      expect(d.getPage(1).getCropBox()).toEqual({ x: 0, y: 0, width: 600, height: 800 });
    }
  });
  it("works on rotated pages", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]).setRotation(degrees(90));
    const out = await cropPdf(await doc.save(), new Map([[0, { top: 0.1, right: 0, bottom: 0, left: 0 }]]));
    expect((await PDFDocument.load(out)).getPage(0).getCropBox().x).toBeCloseTo(60);
  });
});

describe("detectContentMargins", () => {
  it("finds white margins around dark content", () => {
    const w = 100;
    const h = 200;
    const px = new Uint8ClampedArray(w * h * 4).fill(255);
    for (let y = 40; y < 160; y++) for (let x = 20; x < 80; x++) px[(y * w + x) * 4] = 0;
    const m = detectContentMargins(px, w, h, { padding: 0 })!;
    expect(m.left).toBeCloseTo(0.2, 2);
    expect(m.right).toBeCloseTo(0.2, 2);
    expect(m.top).toBeCloseTo(0.2, 2);
    expect(m.bottom).toBeCloseTo(0.2, 2);
  });
  it("returns null for a blank page and ignores transparent pixels", () => {
    expect(detectContentMargins(new Uint8ClampedArray(4 * 4 * 4).fill(255), 4, 4)).toBeNull();
    expect(detectContentMargins(new Uint8ClampedArray(4 * 4 * 4), 4, 4)).toBeNull();
  });
});

describe("PDF info", () => {
  it("reads, edits and clears fields", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]);
    doc.setTitle("Old");
    doc.setAuthor("Ada");
    doc.setKeywords(["a", "b"]);
    const bytes = await doc.save();
    const facts = await readPdfInfo(bytes);
    expect(facts.info.title).toBe("Old");
    expect(facts.info.keywords).toBe("a b");
    expect(facts.pageCount).toBe(1);
    expect(facts.pageSize).toEqual({ width: 300, height: 400 });

    const out = await applyPdfInfo(bytes, { ...EMPTY_INFO, title: "New title", keywords: "x, y , ,z", creationDate: new Date("2020-01-02T03:04:05Z") });
    const after = await readPdfInfo(out);
    expect(after.info.title).toBe("New title");
    expect(after.info.author).toBe(""); // blank fields are removed
    expect(after.info.keywords).toBe("x y z");
    expect(after.info.creationDate?.toISOString()).toBe("2020-01-02T03:04:05.000Z");
  });
  it("drops the XMP stream on request and keeps the producer you set", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const xmp = doc.context.stream("<x:xmpmeta/>");
    doc.catalog.set(PDFName.of("Metadata"), doc.context.register(xmp));
    const bytes = await doc.save();
    expect((await readPdfInfo(bytes)).hasXmp).toBe(true);
    const cleaned = await applyPdfInfo(bytes, { ...EMPTY_INFO, producer: "My tool" }, { removeXmp: true, touchModified: false });
    const facts = await readPdfInfo(cleaned);
    expect(facts.hasXmp).toBe(false);
    expect(facts.info.producer).toBe("My tool");
  });
  it("round-trips datetime-local text", () => {
    const d = new Date(2024, 4, 6, 7, 8);
    expect(toLocalInput(d)).toBe("2024-05-06T07:08");
    expect(fromLocalInput("2024-05-06T07:08")?.getTime()).toBe(d.getTime());
    expect(fromLocalInput("")).toBeNull();
    expect(toLocalInput(null)).toBe("");
  });
  it("names standard paper sizes", () => {
    expect(paperName(595, 842)).toBe("A4 (portrait)");
    expect(paperName(842, 595)).toBe("A4 (landscape)");
    expect(paperName(612, 792)).toBe("Letter (portrait)");
    expect(paperName(500, 500)).toBeNull();
    expect(pointsToMm(72)).toBeCloseTo(25.4);
  });
});

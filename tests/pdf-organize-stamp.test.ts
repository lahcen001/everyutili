import { PDFDocument, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildOrganizedPdf, duplicateItem, insertBlankAfter, interleaveDuplex, moveItem, oddThenEven, removeItems, reverseItems, rotateItems, type PageItem } from "@/lib/pdf/organize";
import { applyStamps, opaqueBounds, placementToPdf, whiteToTransparent } from "@/lib/pdf/stamp";

const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

/** A PDF whose page n is (100 + 10n) wide, so pages can be told apart by size. */
async function makePdf(pages: number, rotations: number[] = []): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([100 + i * 10, 200]);
    if (rotations[i - 1]) p.setRotation(degrees(rotations[i - 1]));
  }
  return doc.save();
}
const widths = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPages().map((p) => p.getWidth());
const page = (id: string, source: number, n: number, rotation = 0): PageItem => ({ id, kind: "page", source, page: n, rotation });

describe("organize helpers", () => {
  const items = [page("a", 0, 0), page("b", 0, 1), page("c", 0, 2), page("d", 0, 3)];
  it("moves, removes, duplicates, inserts blanks and rotates", () => {
    expect(moveItem(items, 0, 2).map((i) => i.id)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(items, 3, 0).map((i) => i.id)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(items, 1, 1)).toBe(items);
    expect(removeItems(items, new Set(["b", "d"])).map((i) => i.id)).toEqual(["a", "c"]);
    expect(duplicateItem(items, 1, "b2").map((i) => i.id)).toEqual(["a", "b", "b2", "c", "d"]);
    expect(insertBlankAfter(items, 0, "x")[1]).toMatchObject({ kind: "blank" });
    const rotated = rotateItems(items, new Set(["a"]), -90);
    expect((rotated[0] as { rotation: number }).rotation).toBe(270);
    expect((rotateItems(rotated, new Set(["a"]), 90)[0] as { rotation: number }).rotation).toBe(0);
  });
  it("reverses, splits odd/even and re-interleaves duplex scans", () => {
    expect(reverseItems([1, 2, 3])).toEqual([3, 2, 1]);
    expect(oddThenEven([1, 2, 3, 4, 5])).toEqual([1, 3, 5, 2, 4]);
    expect(interleaveDuplex(["f1", "f2", "f3", "b3", "b2", "b1"])).toEqual(["f1", "b1", "f2", "b2", "f3", "b3"]);
  });
});

describe("buildOrganizedPdf", () => {
  it("reorders, duplicates and mixes pages from several files", async () => {
    const a = await makePdf(3); // widths 110, 120, 130
    const b = await makePdf(2); // 110, 120
    const out = await buildOrganizedPdf([a, b], [page("1", 0, 2), page("2", 1, 0), page("3", 0, 0), page("4", 0, 0)]);
    expect(await widths(out)).toEqual([130, 110, 110, 110]);
  });
  it("adds blank pages and rotates relative to the existing rotation", async () => {
    const a = await makePdf(2, [90, 0]);
    const out = await buildOrganizedPdf([a], [page("1", 0, 0, 90), page("2", 0, 1, 270), { id: "b", kind: "blank", width: 300, height: 400 }]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([180, 270, 0]);
    expect(doc.getPage(2).getSize()).toEqual({ width: 300, height: 400 });
  });
});

describe("placementToPdf", () => {
  const box = { x: 0, y: 0, width: 600, height: 800 };
  const p = { x: 0.1, y: 0.2, w: 0.3, h: 0.1 };

  /** Where the stamp's corners really land on the displayed page (top-left origin, fractions) after drawing at rect. */
  function displayedCorners(rect: ReturnType<typeof placementToPdf>, rot: number) {
    const th = (rect.rotate * Math.PI) / 180;
    const local = [[0, 0], [rect.width, 0], [rect.width, rect.height], [0, rect.height]];
    const dw = rot % 180 === 0 ? box.width : box.height;
    const dh = rot % 180 === 0 ? box.height : box.width;
    return local.map(([u, v]) => {
      const ux = rect.x + u * Math.cos(th) - v * Math.sin(th);
      const uy = rect.y + u * Math.sin(th) + v * Math.cos(th);
      // user space -> displayed (top-left origin) for a page rotated clockwise by `rot`
      let dx: number, dy: number;
      if (rot === 0) [dx, dy] = [ux, box.height - uy];
      else if (rot === 90) [dx, dy] = [uy, ux];
      else if (rot === 180) [dx, dy] = [box.width - ux, uy];
      else [dx, dy] = [box.height - uy, box.width - ux];
      return [dx / dw, dy / dh];
    });
  }

  for (const rot of [0, 90, 180, 270]) {
    it(`lands where it was dropped on a page rotated ${rot}°`, () => {
      const corners = displayedCorners(placementToPdf(p, box, rot), rot);
      const expected = [[p.x, p.y + p.h], [p.x + p.w, p.y + p.h], [p.x + p.w, p.y], [p.x, p.y]];
      corners.forEach(([x, y], i) => {
        expect(x).toBeCloseTo(expected[i][0], 6);
        expect(y).toBeCloseTo(expected[i][1], 6);
      });
    });
  }
  it("honours a crop box that doesn't start at the origin", () => {
    const r = placementToPdf({ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 50, y: 70, width: 200, height: 100 }, 0);
    expect(r).toMatchObject({ x: 50, y: 70 + 50, width: 100, height: 50 });
  });
});

describe("applyStamps", () => {
  it("draws the image on the chosen pages only", async () => {
    const out = await applyStamps(await makePdf(3), [{ png: PNG, placement: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 }, pages: [0, 2] }]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
    const xobj = (i: number) => doc.getPage(i).node.Resources()?.lookup(doc.context.obj("XObject") as never);
    expect(xobj(0)).toBeTruthy();
    expect(xobj(1)).toBeFalsy();
    expect(xobj(2)).toBeTruthy();
  });
});

describe("image helpers", () => {
  it("finds the opaque bounds", () => {
    const w = 4;
    const h = 3;
    const px = new Uint8ClampedArray(w * h * 4);
    px[(1 * w + 2) * 4 + 3] = 255;
    px[(2 * w + 1) * 4 + 3] = 255;
    expect(opaqueBounds(px, w, h)).toEqual({ x: 1, y: 1, w: 2, h: 2 });
    expect(opaqueBounds(new Uint8ClampedArray(w * h * 4), w, h)).toBeNull();
  });
  it("turns white into transparent and keeps ink", () => {
    const px = new Uint8ClampedArray([255, 255, 255, 255, 20, 20, 20, 255, 128, 128, 128, 255]);
    whiteToTransparent(px);
    expect(px[3]).toBe(0);
    expect(px[7]).toBe(255);
    expect(px[11]).toBeGreaterThan(100);
    expect(px[11]).toBeLessThanOrEqual(255);
  });
});

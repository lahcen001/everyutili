import JSZip from "jszip";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { exportSheets } from "@/lib/office/exportSheets";
import type { Grid } from "@/lib/office/sheets";

const g = (v: number): Grid => ({ columns: ["a", "b"], rows: [[v, "x, y"]] });

describe("exportSheets", () => {
  it("writes one csv for a single sheet", async () => {
    const out = await exportSheets([{ name: "S", grid: g(1) }], "csv", "book");
    expect(out.fileName).toBe("book.csv");
    expect(await out.blob.text()).toBe('a,b\n1,"x, y"');
  });

  it("zips several sheets with unique file names", async () => {
    const out = await exportSheets([{ name: "Sales/EU", grid: g(1) }, { name: "Sales/EU", grid: g(2) }, { name: "Other", grid: g(3) }], "json", "book");
    expect(out.fileName).toBe("book.zip");
    const zip = await JSZip.loadAsync(await out.blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(["Other.json", "Sales_EU (2).json", "Sales_EU.json"]);
    expect(JSON.parse(await zip.file("Other.json")!.async("string"))[0].a).toBe(3);
  });

  it("writes every sheet into one xlsx workbook that reads back", async () => {
    const out = await exportSheets([{ name: "One", grid: g(1) }, { name: "Two", grid: g(2) }], "xlsx", "book");
    expect(out.fileName).toBe("book.xlsx");
    const wb = XLSX.read(await out.blob.arrayBuffer(), { type: "array" });
    expect(wb.SheetNames).toEqual(["One", "Two"]);
    expect(XLSX.utils.sheet_to_json(wb.Sheets.Two)).toEqual([{ a: 2, b: "x, y" }]);
  });

  it("supports the BOM and rejects empty selections", async () => {
    const out = await exportSheets([{ name: "S", grid: g(1) }], "csv", "b", { bom: true });
    expect((await out.blob.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect(new Uint8Array(await out.blob.arrayBuffer()).slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));
    await expect(exportSheets([], "csv", "b")).rejects.toThrow(/at least one/);
  });
});

import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { detectDelimiter, gridsToWorkbook, gridToText, readAnyWorkbook, sheetToGrid, workbookToBlocks, type Grid } from "@/lib/office/sheets";
import { dedupeRows, mergeAppend, matchingRowIndices, moveColumn, removeColumns, removeEmptyRows, renameColumn, sortRows, trimCells } from "@/lib/office/sheetOps";

const grid = (columns: string[], rows: (string | number | null)[][]): Grid => ({ columns, rows });

describe("detectDelimiter", () => {
  it("finds comma, semicolon, tab and pipe", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
    expect(detectDelimiter("a|b|c\n1|2|3")).toBe("|");
  });
  it("ignores delimiters inside quotes and defaults to comma", () => {
    expect(detectDelimiter('name;note\n"x, y, z";ok')).toBe(";");
    expect(detectDelimiter("single column\nnext")).toBe(",");
    expect(detectDelimiter("")).toBe(",");
  });
});

describe("readAnyWorkbook", () => {
  it("parses quoted CSV fields containing commas (the old split(',') bug)", async () => {
    const file = new File(['name,city\n"Smith, John","New York, NY"\nAda,London'], "people.csv");
    const { workbook, kind } = await readAnyWorkbook(file);
    expect(kind).toBe("csv");
    const g = sheetToGrid(workbook.Sheets[workbook.SheetNames[0]]);
    expect(g.columns).toEqual(["name", "city"]);
    expect(g.rows[0]).toEqual(["Smith, John", "New York, NY"]);
    expect(g.rows).toHaveLength(2);
  });

  it("auto-detects semicolons and honors an explicit delimiter", async () => {
    const text = "a;b\n1;2";
    const auto = await readAnyWorkbook(new File([text], "x.csv"));
    expect(auto.delimiter).toBe(";");
    expect(sheetToGrid(auto.workbook.Sheets[auto.workbook.SheetNames[0]]).columns).toEqual(["a", "b"]);
    const forced = await readAnyWorkbook(new File([text], "x.csv"), { delimiter: "," });
    expect(sheetToGrid(forced.workbook.Sheets[forced.workbook.SheetNames[0]]).columns).toEqual(["a;b"]);
  });

  it("keeps leading zeros when asked to treat values as text", async () => {
    const file = new File(["id,v\n007,1"], "ids.csv");
    const { workbook } = await readAnyWorkbook(file, { asText: true });
    expect(sheetToGrid(workbook.Sheets[workbook.SheetNames[0]]).rows[0][0]).toBe("007");
  });

  it("reads JSON arrays of objects and of rows, and rejects other JSON", async () => {
    const objs = await readAnyWorkbook(new File([JSON.stringify([{ a: 1, b: { x: 2 } }, { a: 3, b: "t" }])], "d.json"));
    const g = sheetToGrid(objs.workbook.Sheets.Sheet1);
    expect(g.columns).toEqual(["a", "b"]);
    expect(g.rows[0][1]).toBe('{"x":2}');
    const rows = await readAnyWorkbook(new File([JSON.stringify([["h"], ["v"]])], "r.json"));
    expect(sheetToGrid(rows.workbook.Sheets.Sheet1).rows[0][0]).toBe("v");
    await expect(readAnyWorkbook(new File(['{"a":1}'], "o.json"))).rejects.toThrow(/array/);
    await expect(readAnyWorkbook(new File(["{nope"], "b.json"))).rejects.toThrow(/valid JSON/);
  });

  it("reads HTML tables", async () => {
    const { workbook } = await readAnyWorkbook(new File(["<table><tr><th>h</th></tr><tr><td>v</td></tr></table>"], "t.html"));
    expect(sheetToGrid(workbook.Sheets[workbook.SheetNames[0]]).rows[0][0]).toBe("v");
  });
});

describe("sheetToGrid", () => {
  it("names blank and duplicate headers, and pads short rows", () => {
    const sheet = XLSX.utils.aoa_to_sheet([["a", "a", ""], [1, 2], [3, 4, 5]]);
    const g = sheetToGrid(sheet);
    expect(g.columns).toEqual(["a", "a (2)", "Column 3"]);
    expect(g.rows).toEqual([[1, 2, null], [3, 4, 5]]);
  });
  it("can treat the first row as data", () => {
    const g = sheetToGrid(XLSX.utils.aoa_to_sheet([["x", "y"], [1, 2]]), false);
    expect(g.columns).toEqual(["Column 1", "Column 2"]);
    expect(g.rows).toHaveLength(2);
  });
});

describe("gridToText", () => {
  const g = grid(["name", "note"], [["Smith, John", 'say "hi"'], ["Ada", null]]);
  it("quotes CSV correctly, supports delimiters, no-header and BOM", () => {
    expect(gridToText(g, "csv")).toBe('name,note\n"Smith, John","say ""hi"""\nAda,');
    expect(gridToText(g, "csv", { delimiter: ";" })).toContain("name;note");
    expect(gridToText(g, "csv", { includeHeader: false }).startsWith("name")).toBe(false);
    expect(gridToText(g, "csv", { bom: true }).charCodeAt(0)).toBe(0xfeff);
    expect(gridToText(g, "tsv")).toContain("name\tnote");
  });
  it("produces JSON objects, escaped HTML and a Markdown table", () => {
    expect(JSON.parse(gridToText(g, "json"))[0]).toEqual({ name: "Smith, John", note: 'say "hi"' });
    expect(gridToText(grid(["a"], [["<b>&"]]), "html")).toContain("&lt;b&gt;&amp;");
    expect(gridToText(grid(["a|b"], [["x|y"]]), "md")).toContain("a\\|b");
  });
});

describe("gridsToWorkbook and workbookToBlocks", () => {
  it("makes valid, unique sheet names", () => {
    const wb = gridsToWorkbook([
      { name: "Report: Q1/2", grid: grid(["a"], [[1]]) },
      { name: "Report: Q1/2", grid: grid(["a"], [[2]]) },
      { name: "x".repeat(50), grid: grid(["a"], [[3]]) },
    ]);
    expect(wb.SheetNames[0]).toBe("Report  Q1 2");
    expect(new Set(wb.SheetNames.map((n) => n.toLowerCase())).size).toBe(3);
    expect(wb.SheetNames.every((n) => n.length <= 31)).toBe(true);
  });
  it("turns sheets into table blocks and caps long ones", () => {
    const wb = gridsToWorkbook([{ name: "S", grid: grid(["a"], Array.from({ length: 10 }, (_, i) => [i])) }]);
    const { blocks, truncated } = workbookToBlocks(wb, ["S"], 4);
    expect(truncated).toBe(true);
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as { rows: unknown[] }).rows).toHaveLength(4);
  });
});

describe("sheetOps", () => {
  const g = grid(["id", "name", "city"], [[1, "Ann", "Rome"], [2, "ann ", "rome"], [3, "Bob", "Oslo"], [null, null, null]]);

  it("removes, renames and moves columns", () => {
    expect(removeColumns(g, [1]).columns).toEqual(["id", "city"]);
    expect(removeColumns(g, [1]).rows[0]).toEqual([1, "Rome"]);
    expect(renameColumn(g, 0, "ID").columns[0]).toBe("ID");
    const moved = moveColumn(g, 2, 0);
    expect(moved.columns).toEqual(["city", "id", "name"]);
    expect(moved.rows[0]).toEqual(["Rome", 1, "Ann"]);
  });

  it("dedupes by chosen columns, ignoring case and whitespace on request", () => {
    expect(dedupeRows(g).removed).toBe(0);
    const byName = dedupeRows(g, { columns: [1], ignoreCase: true, trim: true });
    expect(byName.removed).toBe(1);
    expect(byName.grid.rows.map((r) => r[0])).toEqual([1, 3, null]);
  });

  it("removes empty rows and trims cells", () => {
    expect(removeEmptyRows(g)).toMatchObject({ removed: 1 });
    expect(trimCells(g).rows[1][1]).toBe("ann");
  });

  it("sorts numerically and naturally, keeping blanks last either way", () => {
    const n = grid(["v"], [[10], [2], [null], [33]]);
    expect(sortRows(n, 0, "asc").rows.map((r) => r[0])).toEqual([2, 10, 33, null]);
    expect(sortRows(n, 0, "desc").rows.map((r) => r[0])).toEqual([33, 10, 2, null]);
    const t = grid(["v"], [["item10"], ["item2"], ["Item1"]]);
    expect(sortRows(t, 0, "asc").rows.map((r) => r[0])).toEqual(["Item1", "item2", "item10"]);
  });

  it("filters rows for the view and merges grids by column name", () => {
    expect(matchingRowIndices(g, "ROME", null)).toEqual([0, 1]);
    expect(matchingRowIndices(g, "oslo", 1)).toEqual([]);
    expect(matchingRowIndices(g, "", null)).toHaveLength(4);
    const merged = mergeAppend([grid(["a", "b"], [[1, 2]]), grid(["b", "c"], [[3, 4]])]);
    expect(merged.columns).toEqual(["a", "b", "c"]);
    expect(merged.rows).toEqual([[1, 2, null], [null, 3, 4]]);
  });
});

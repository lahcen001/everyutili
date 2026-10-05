import { cellToString, type Cell, type Grid } from "@/lib/office/sheets";

const clone = (grid: Grid): Grid => ({ columns: [...grid.columns], rows: grid.rows.map((r) => [...r]) });

export function removeColumns(grid: Grid, indices: number[]): Grid {
  const drop = new Set(indices);
  return {
    columns: grid.columns.filter((_, i) => !drop.has(i)),
    rows: grid.rows.map((row) => row.filter((_, i) => !drop.has(i))),
  };
}

export function renameColumn(grid: Grid, index: number, name: string): Grid {
  const next = clone(grid);
  if (index >= 0 && index < next.columns.length) next.columns[index] = name;
  return next;
}

/** Moves the column at `from` so it ends up at index `to`. */
export function moveColumn(grid: Grid, from: number, to: number): Grid {
  if (from === to || from < 0 || to < 0 || from >= grid.columns.length || to >= grid.columns.length) return clone(grid);
  const order = grid.columns.map((_, i) => i);
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  return { columns: order.map((i) => grid.columns[i]), rows: grid.rows.map((row) => order.map((i) => row[i] ?? null)) };
}

export interface DedupeOptions {
  /** Column indices that define a duplicate; every column when omitted. */
  columns?: number[];
  ignoreCase?: boolean;
  trim?: boolean;
}

/** Keeps the first row of each duplicate group. */
export function dedupeRows(grid: Grid, options: DedupeOptions = {}): { grid: Grid; removed: number } {
  const cols = options.columns && options.columns.length > 0 ? options.columns : grid.columns.map((_, i) => i);
  const seen = new Set<string>();
  const rows: Cell[][] = [];
  for (const row of grid.rows) {
    const key = JSON.stringify(
      cols.map((i) => {
        let v = cellToString(row[i] ?? null);
        if (options.trim) v = v.trim();
        if (options.ignoreCase) v = v.toLowerCase();
        return v;
      })
    );
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return { grid: { columns: grid.columns, rows }, removed: grid.rows.length - rows.length };
}

export function removeEmptyRows(grid: Grid): { grid: Grid; removed: number } {
  const rows = grid.rows.filter((row) => row.some((cell) => cellToString(cell).trim() !== ""));
  return { grid: { columns: grid.columns, rows }, removed: grid.rows.length - rows.length };
}

export function trimCells(grid: Grid): Grid {
  return {
    columns: grid.columns.map((c) => c.trim()),
    rows: grid.rows.map((row) => row.map((cell) => (typeof cell === "string" ? cell.trim() : cell))),
  };
}

function compareCells(a: Cell, b: Cell): number {
  const aEmpty = a === null || a === "";
  const bEmpty = b === null || b === "";
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1; // blanks always last
  if (typeof a === "number" && typeof b === "number") return a - b;
  return cellToString(a).localeCompare(cellToString(b), undefined, { numeric: true, sensitivity: "base" });
}

export function sortRows(grid: Grid, column: number, direction: "asc" | "desc"): Grid {
  const sign = direction === "asc" ? 1 : -1;
  const rows = [...grid.rows].sort((x, y) => {
    const a = x[column] ?? null;
    const b = y[column] ?? null;
    const blank = (v: Cell) => v === null || v === "";
    // Keep blanks last in both directions.
    if (blank(a) || blank(b)) return compareCells(a, b);
    return sign * compareCells(a, b);
  });
  return { columns: grid.columns, rows };
}

/** Indices of rows containing `query` (case-insensitive) in one column, or any column when `column` is null. */
export function matchingRowIndices(grid: Grid, query: string, column: number | null): number[] {
  const q = query.trim().toLowerCase();
  if (q === "") return grid.rows.map((_, i) => i);
  const out: number[] = [];
  grid.rows.forEach((row, i) => {
    const hit = column === null ? row.some((c) => cellToString(c).toLowerCase().includes(q)) : cellToString(row[column] ?? null).toLowerCase().includes(q);
    if (hit) out.push(i);
  });
  return out;
}

/** Stacks grids; columns are matched by name, and missing cells are empty. */
export function mergeAppend(grids: Grid[]): Grid {
  const columns: string[] = [];
  for (const g of grids) for (const c of g.columns) if (!columns.includes(c)) columns.push(c);
  const rows: Cell[][] = [];
  for (const g of grids) {
    const index = columns.map((c) => g.columns.indexOf(c));
    for (const row of g.rows) rows.push(index.map((i) => (i === -1 ? null : row[i] ?? null)));
  }
  return { columns, rows };
}

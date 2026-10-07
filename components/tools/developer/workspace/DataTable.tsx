"use client";

const ROW_LIMIT = 500;
const COLUMN_LIMIT = 60;

function show(v: unknown): string {
  if (v === undefined) return "";
  if (v === null) return "null";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** A scrolling preview table with a sticky header, capped so huge files stay fast. */
export function DataTable({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  const cols = columns.slice(0, COLUMN_LIMIT);
  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th className="border-b border-border px-2 py-1.5 text-left font-medium text-muted-foreground">#</th>
            {cols.map((c) => (
              <th key={c} className="border-b border-border px-2 py-1.5 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, ROW_LIMIT).map((r, i) => (
            <tr key={i} className="odd:bg-muted/20">
              <td className="border-b border-border/60 px-2 py-1 text-muted-foreground">{i + 1}</td>
              {cols.map((_, j) => (
                <td key={j} className="max-w-64 truncate border-b border-border/60 px-2 py-1 font-mono">
                  {show(r[j])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {(rows.length > ROW_LIMIT || columns.length > COLUMN_LIMIT) && (
        <p className="p-2 text-xs text-muted-foreground">
          Showing the first {Math.min(rows.length, ROW_LIMIT)} of {rows.length.toLocaleString()} rows and {cols.length} of {columns.length} columns.
        </p>
      )}
    </div>
  );
}

function flatten(obj: unknown, prefix = "", result: Record<string, unknown> = {}) {
  if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, result);
    }
  } else {
    result[prefix] = obj;
  }
  return result;
}

export function jsonToCsv(json: unknown): string {
  const rows: Record<string, unknown>[] = Array.isArray(json)
    ? json.map((item) => flatten(item))
    : [flatten(json)];

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

  const escape = (value: unknown) => {
    if (value === undefined || value === null) return "";
    const str = String(value);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const header = columns.map(escape).join(",");
  const body = rows.map((row) => columns.map((col) => escape(row[col])).join(","));

  return [header, ...body].join("\n");
}

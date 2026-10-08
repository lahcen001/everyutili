export interface KeyOptions {
  decimal?: boolean;
  negative?: boolean;
  /** extra characters this field accepts (for example "/" or " ") */
  extra?: string;
  maxLength?: number;
}

/** Applies one on-screen key ("5", ".", "±", "BACK", "C", or an extra character) to a text field value. */
export function applyKey(current: string, key: string, opts: KeyOptions = {}): string {
  const { decimal = true, negative = true, extra = "", maxLength = 24 } = opts;
  if (key === "C" || key === "AC") return "";
  if (key === "BACK") return current.slice(0, -1);
  if (key === "±") {
    if (!negative) return current;
    return current.startsWith("-") ? current.slice(1) : current === "" ? "-" : "-" + current;
  }
  if (current.length >= maxLength) return current;
  if (/^[0-9]$/.test(key)) return current + key;
  if (key === ".") {
    if (!decimal) return current;
    const last = current.split(/[^0-9.]/).pop() ?? "";
    return last.includes(".") ? current : current + (last === "" ? "0." : ".");
  }
  if (key === "-" && negative && current === "") return "-";
  if (extra.includes(key) && key.length === 1) return current + key;
  return current;
}

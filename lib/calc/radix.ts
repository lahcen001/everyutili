export type Base = 2 | 8 | 10 | 16;
export type Width = 8 | 16 | 32 | 64;

const DIGITS = "0123456789ABCDEF";

export function parseInBase(text: string, base: Base): bigint | null {
  const clean = text.replace(/[\s_]/g, "").toUpperCase();
  if (!clean) return null;
  let neg = false;
  let s = clean;
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  }
  if (!s) return null;
  let v = BigInt(0);
  const b = BigInt(base);
  for (const ch of s) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= base) return null;
    v = v * b + BigInt(d);
  }
  return neg ? -v : v;
}

/** Wraps to a signed two's-complement integer of the given width. */
export function wrap(v: bigint, width: Width): bigint {
  const mod = BigInt(1) << BigInt(width);
  let r = ((v % mod) + mod) % mod;
  if (r >= mod >> BigInt(1)) r -= mod;
  return r;
}

export const toUnsigned = (v: bigint, width: Width): bigint => ((v % (BigInt(1) << BigInt(width))) + (BigInt(1) << BigInt(width))) % (BigInt(1) << BigInt(width));

/** Text in the base. Negative values show as two's complement for the given width (except decimal). */
export function format(v: bigint, base: Base, width: Width): string {
  if (base === 10) return wrap(v, width).toString();
  return toUnsigned(v, width).toString(base).toUpperCase();
}

export function groupBits(bin: string, width: Width): string {
  return bin.padStart(width, "0").replace(/(.{4})(?=.)/g, "$1 ");
}

export type BitOp = "AND" | "OR" | "XOR" | "NAND" | "NOR" | "SHL" | "SHR" | "ADD" | "SUB" | "MUL" | "DIV" | "MOD";

export function apply(op: BitOp, a: bigint, b: bigint, width: Width): bigint {
  switch (op) {
    case "AND": return wrap(a & b, width);
    case "OR": return wrap(a | b, width);
    case "XOR": return wrap(a ^ b, width);
    case "NAND": return wrap(~(a & b), width);
    case "NOR": return wrap(~(a | b), width);
    case "SHL": return wrap(a << b, width);
    case "SHR": return wrap(a >> b, width);
    case "ADD": return wrap(a + b, width);
    case "SUB": return wrap(a - b, width);
    case "MUL": return wrap(a * b, width);
    case "DIV":
      if (b === BigInt(0)) throw new Error("Can't divide by zero");
      return wrap(a / b, width);
    case "MOD":
      if (b === BigInt(0)) throw new Error("Can't divide by zero");
      return wrap(a % b, width);
  }
}

export const not = (a: bigint, width: Width): bigint => wrap(~a, width);

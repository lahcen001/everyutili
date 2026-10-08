export interface Frac {
  n: number;
  d: number;
}

export const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

export function frac(n: number, d = 1): Frac {
  if (d === 0) throw new Error("The denominator can't be zero");
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

/** Builds a fraction from a mixed number: whole + num/den (sign applies to the whole value). */
export function mixed(whole: number, num: number, den: number, negative = false): Frac {
  if (den === 0) throw new Error("The denominator can't be zero");
  const value = frac(Math.abs(whole) * den + num, den);
  return negative ? { n: -value.n, d: value.d } : value;
}

export const add = (a: Frac, b: Frac): Frac => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Frac, b: Frac): Frac => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d);
export function div(a: Frac, b: Frac): Frac {
  if (b.n === 0) throw new Error("Can't divide by zero");
  return frac(a.n * b.d, a.d * b.n);
}

export const toDecimal = (f: Frac): number => f.n / f.d;

export function toMixedString(f: Frac): string {
  if (f.d === 1) return String(f.n);
  const whole = Math.trunc(f.n / f.d);
  const rest = Math.abs(f.n) - Math.abs(whole) * f.d;
  if (whole === 0) return `${f.n}/${f.d}`;
  return `${whole} ${rest}/${f.d}`;
}

export const toString = (f: Frac): string => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`);

/** Parses "3/4", "-2 1/3", "5" or "0.75" into a fraction. */
export function parse(text: string): Frac {
  const s = text.trim();
  const m = /^(-?)\s*(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) return mixed(m[2] ? Number(m[2]) : 0, Number(m[3]), Number(m[4]), m[1] === "-");
  if (/^-?\d+$/.test(s)) return frac(Number(s));
  if (/^-?\d*\.\d+$/.test(s)) {
    const decimals = s.split(".")[1].length;
    return frac(Math.round(Number(s) * 10 ** decimals), 10 ** decimals);
  }
  throw new Error("Enter a fraction like 3/4, a mixed number like 2 1/3, or a whole number");
}

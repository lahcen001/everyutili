export interface QuadraticResult {
  discriminant: number;
  kind: "two-real" | "one-real" | "complex";
  /** real parts and imaginary parts of the two roots (imag 0 for real roots) */
  roots: { re: number; im: number }[];
  vertex: { x: number; y: number };
  axis: number;
}

const tidy = (v: number) => (Math.abs(v) < 1e-12 ? 0 : Number(v.toPrecision(12)));

export function solveQuadratic(a: number, b: number, c: number): QuadraticResult {
  if (a === 0) throw new Error("a can't be 0 — that is not a quadratic equation");
  const d = b * b - 4 * a * c;
  const vx = -b / (2 * a);
  const vy = a * vx * vx + b * vx + c;
  const base = { discriminant: tidy(d), vertex: { x: tidy(vx), y: tidy(vy) }, axis: tidy(vx) };
  if (d > 0) {
    const s = Math.sqrt(d);
    // numerically stable form avoids cancellation when b is large
    const q = -0.5 * (b + Math.sign(b || 1) * s);
    const r1 = q / a;
    const r2 = c / q;
    const [lo, hi] = r1 < r2 ? [r1, r2] : [r2, r1];
    return { ...base, kind: "two-real", roots: [{ re: tidy(lo), im: 0 }, { re: tidy(hi), im: 0 }] };
  }
  if (d === 0) return { ...base, kind: "one-real", roots: [{ re: tidy(vx), im: 0 }] };
  const im = Math.sqrt(-d) / (2 * Math.abs(a));
  return { ...base, kind: "complex", roots: [{ re: tidy(vx), im: tidy(im) }, { re: tidy(vx), im: tidy(-im) }] };
}

export function formatRoot(r: { re: number; im: number }): string {
  if (r.im === 0) return String(r.re);
  const imAbs = Math.abs(r.im);
  const im = imAbs === 1 ? "i" : `${imAbs}i`;
  if (r.re === 0) return r.im < 0 ? `−${im}` : im;
  return `${r.re} ${r.im < 0 ? "−" : "+"} ${im}`;
}

export type Matrix = number[][];

export const dims = (m: Matrix): [number, number] => [m.length, m[0]?.length ?? 0];

export function create(rows: number, cols: number, fill = 0): Matrix {
  return Array.from({ length: rows }, () => Array<number>(cols).fill(fill));
}
export const identity = (n: number): Matrix => create(n, n).map((r, i) => r.map((_, j) => (i === j ? 1 : 0)));

const same = (a: Matrix, b: Matrix) => {
  const [ar, ac] = dims(a);
  const [br, bc] = dims(b);
  if (ar !== br || ac !== bc) throw new Error("Both matrices need the same size");
};

export function add(a: Matrix, b: Matrix): Matrix {
  same(a, b);
  return a.map((r, i) => r.map((v, j) => v + b[i][j]));
}
export function subtract(a: Matrix, b: Matrix): Matrix {
  same(a, b);
  return a.map((r, i) => r.map((v, j) => v - b[i][j]));
}
export function multiply(a: Matrix, b: Matrix): Matrix {
  const [, ac] = dims(a);
  const [br, bc] = dims(b);
  if (ac !== br) throw new Error(`Columns of A (${ac}) must equal rows of B (${br})`);
  return a.map((row) => Array.from({ length: bc }, (_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)));
}
export const scale = (a: Matrix, k: number): Matrix => a.map((r) => r.map((v) => v * k));
export const transpose = (a: Matrix): Matrix => a[0].map((_, j) => a.map((r) => r[j]));

const square = (a: Matrix) => {
  const [r, c] = dims(a);
  if (r !== c) throw new Error("This needs a square matrix");
  return r;
};

export function determinant(a: Matrix): number {
  const n = square(a);
  const m = a.map((r) => [...r]);
  let det = 1;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(m[r][i]) > Math.abs(m[p][i])) p = r;
    if (Math.abs(m[p][i]) < 1e-12) return 0;
    if (p !== i) {
      [m[p], m[i]] = [m[i], m[p]];
      det = -det;
    }
    det *= m[i][i];
    for (let r = i + 1; r < n; r++) {
      const f = m[r][i] / m[i][i];
      for (let c = i; c < n; c++) m[r][c] -= f * m[i][c];
    }
  }
  return Math.abs(det) < 1e-10 ? 0 : Number(det.toPrecision(12));
}

export function inverse(a: Matrix): Matrix {
  const n = square(a);
  if (determinant(a) === 0) throw new Error("This matrix has no inverse (its determinant is 0)");
  const m = a.map((r, i) => [...r, ...identity(n)[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(m[r][i]) > Math.abs(m[p][i])) p = r;
    [m[p], m[i]] = [m[i], m[p]];
    const pivot = m[i][i];
    for (let c = 0; c < 2 * n; c++) m[i][c] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = m[r][i];
      for (let c = 0; c < 2 * n; c++) m[r][c] -= f * m[i][c];
    }
  }
  return m.map((r) => r.slice(n).map((v) => (Math.abs(v) < 1e-12 ? 0 : Number(v.toPrecision(12)))));
}

export function trace(a: Matrix): number {
  const n = square(a);
  return Array.from({ length: n }, (_, i) => a[i][i]).reduce((s, v) => s + v, 0);
}

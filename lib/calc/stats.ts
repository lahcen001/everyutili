export interface Stats {
  count: number;
  sum: number;
  mean: number;
  median: number;
  modes: number[];
  min: number;
  max: number;
  range: number;
  q1: number;
  q3: number;
  iqr: number;
  variance: number;
  stdDev: number;
  sumSquares: number;
  geometricMean: number | null;
  outliers: number[];
}

/** Numbers from free text: separated by spaces, commas, semicolons or new lines. */
export function parseNumbers(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

function quantile(sorted: number[], p: number): number {
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const tidy = (v: number) => Number(v.toPrecision(12));

export function describe(values: number[], population = false): Stats {
  if (values.length === 0) throw new Error("Enter at least one number");
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  const sum = values.reduce((s, v) => s + v, 0);
  const mean = sum / n;
  const ss = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  const denom = population ? n : n - 1;
  const variance = denom > 0 ? ss / denom : 0;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const top = Math.max(...counts.values());
  const modes = top > 1 ? [...counts.entries()].filter(([, c]) => c === top).map(([v]) => v).sort((a, b) => a - b) : [];
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  return {
    count: n,
    sum: tidy(sum),
    mean: tidy(mean),
    median: tidy(quantile(sorted, 0.5)),
    modes,
    min: sorted[0],
    max: sorted[n - 1],
    range: tidy(sorted[n - 1] - sorted[0]),
    q1: tidy(q1),
    q3: tidy(q3),
    iqr: tidy(iqr),
    variance: tidy(variance),
    stdDev: tidy(Math.sqrt(variance)),
    sumSquares: tidy(values.reduce((s, v) => s + v * v, 0)),
    geometricMean: values.every((v) => v > 0) ? tidy(Math.exp(values.reduce((s, v) => s + Math.log(v), 0) / n)) : null,
    outliers: sorted.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr),
  };
}

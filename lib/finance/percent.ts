/** All functions return NaN when the answer is undefined (for example dividing by zero) so the UI can say so. */

export const percentOf = (percent: number, base: number): number => (percent / 100) * base;

/** What percent `part` is of `whole`. */
export const whatPercent = (part: number, whole: number): number => (whole === 0 ? NaN : (part / whole) * 100);

/** Percent change from `from` to `to`; relative to the size of `from`, so it is still meaningful for negatives. */
export const percentChange = (from: number, to: number): number => (from === 0 ? NaN : ((to - from) / Math.abs(from)) * 100);

export const increaseBy = (value: number, percent: number): number => value * (1 + percent / 100);
export const decreaseBy = (value: number, percent: number): number => value * (1 - percent / 100);

/** `part` is `percent`% of what? */
export const findWhole = (part: number, percent: number): number => (percent === 0 ? NaN : part / (percent / 100));

/** The value before it was raised (or lowered) by `percent`% to reach `result`. */
export const beforeChange = (result: number, percent: number, direction: "increase" | "decrease"): number => {
  const factor = direction === "increase" ? 1 + percent / 100 : 1 - percent / 100;
  return factor === 0 ? NaN : result / factor;
};

/** Parses a text field; empty or invalid text is NaN rather than silently becoming 0. */
export const parseNumber = (text: string): number => {
  const trimmed = text.trim().replace(/,/g, "");
  return trimmed === "" ? NaN : Number(trimmed);
};

export function formatNumber(value: number, maxDigits = 4): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: maxDigits }).format(value);
}

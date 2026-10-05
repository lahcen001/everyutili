export interface StackedResult {
  finalPrice: number;
  saved: number;
  /** Equivalent single discount, in percent */
  effectivePercent: number;
  steps: { percent: number; price: number }[];
}

/** Apply discounts one after another (20% then 10% is 28% off, not 30%). */
export function stackDiscounts(price: number, percents: number[]): StackedResult {
  let current = price;
  const steps: { percent: number; price: number }[] = [];
  for (const p of percents) {
    const pct = Math.min(Math.max(p, 0), 100);
    current = current * (1 - pct / 100);
    steps.push({ percent: pct, price: current });
  }
  return { finalPrice: current, saved: price - current, effectivePercent: price > 0 ? (1 - current / price) * 100 : 0, steps };
}

/** Percent off between an original and a sale price. NaN if original is 0. */
export function percentOff(original: number, sale: number): number {
  return original === 0 ? NaN : ((original - sale) / original) * 100;
}

/** Original price that gave `sale` after `percent` off. NaN at 100%. */
export function originalFromSale(sale: number, percent: number): number {
  return percent >= 100 ? NaN : sale / (1 - percent / 100);
}

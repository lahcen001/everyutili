import { describe, expect, it } from "vitest";
import { calculatePaycheck, federalIncomeTax, type PaycheckInput } from "@/lib/finance/paycheck";
import { BRACKETS } from "@/lib/finance/taxData";

const base: PaycheckInput = {
  annualGross: 60000,
  payPeriods: 26,
  filingStatus: "single",
  retirementPercent: 0,
  benefitsPerPeriod: 0,
  postTaxPerPeriod: 0,
  stateRatePercent: 0,
  extraWithholdingPerPeriod: 0,
};

describe("federalIncomeTax (2026, IRS Rev. Proc. 2025-32)", () => {
  it("matches the published bracket cumulative amounts at each threshold", () => {
    // "Tax is" column of the IRS tables at the top of the bracket below.
    expect(federalIncomeTax(12400, "single").tax).toBeCloseTo(1240);
    expect(federalIncomeTax(50400, "single").tax).toBeCloseTo(5800);
    expect(federalIncomeTax(105700, "single").tax).toBeCloseTo(17966);
    expect(federalIncomeTax(201775, "single").tax).toBeCloseTo(41024);
    expect(federalIncomeTax(256225, "single").tax).toBeCloseTo(58448);
    // IRS: $58,448 plus 35% of the excess over $256,225 → 58,448 + 0.35 × 384,375
    expect(federalIncomeTax(640600, "single").tax).toBeCloseTo(192979.25);
    expect(federalIncomeTax(24800, "married").tax).toBeCloseTo(2480);
    expect(federalIncomeTax(100800, "married").tax).toBeCloseTo(11600);
    expect(federalIncomeTax(211400, "married").tax).toBeCloseTo(35932);
    expect(federalIncomeTax(403550, "married").tax).toBeCloseTo(82048);
    expect(federalIncomeTax(512450, "married").tax).toBeCloseTo(116896);
    expect(federalIncomeTax(768700, "married").tax).toBeCloseTo(206583.5);
    expect(federalIncomeTax(17700, "head").tax).toBeCloseTo(1770);
    expect(federalIncomeTax(67450, "head").tax).toBeCloseTo(7740);
    expect(federalIncomeTax(105700, "head").tax).toBeCloseTo(16155);
    expect(federalIncomeTax(201750, "head").tax).toBeCloseTo(39207);
    expect(federalIncomeTax(256200, "head").tax).toBeCloseTo(56631);
  });
  it("is zero for no income and reports the marginal rate", () => {
    expect(federalIncomeTax(0, "single")).toEqual({ tax: 0, marginalRate: 0.1 });
    expect(federalIncomeTax(60000, "single").marginalRate).toBe(0.22);
    expect(federalIncomeTax(1_000_000, "single").marginalRate).toBe(0.37);
  });
  it("has brackets in increasing order for every status", () => {
    for (const status of Object.keys(BRACKETS) as (keyof typeof BRACKETS)[]) {
      const ups = BRACKETS[status].map((b) => b.upTo);
      expect([...ups].sort((a, b) => a - b)).toEqual(ups);
    }
  });
});

describe("calculatePaycheck", () => {
  it("computes a plain $60,000 single salary by hand", () => {
    const r = calculatePaycheck(base);
    // taxable = 60,000 − 16,100 = 43,900 → 1,240 + 12% × 31,500 = 5,020
    expect(r.taxableIncome).toBe(43900);
    expect(r.annual.federal).toBeCloseTo(5020);
    expect(r.annual.socialSecurity).toBeCloseTo(3720);
    expect(r.annual.medicare).toBeCloseTo(870);
    expect(r.annual.net).toBeCloseTo(50390);
    expect(r.perPeriod.net).toBeCloseTo(50390 / 26);
    expect(r.marginalRate).toBe(0.12);
  });

  it("uses each filing status's standard deduction and brackets", () => {
    expect(calculatePaycheck({ ...base, annualGross: 100000, filingStatus: "married" }).annual.federal).toBeCloseTo(7640);
    expect(calculatePaycheck({ ...base, filingStatus: "head" }).annual.federal).toBeCloseTo(3948);
  });

  it("caps Social Security at the wage base and adds the additional Medicare tax", () => {
    const r = calculatePaycheck({ ...base, annualGross: 250000 });
    expect(r.annual.socialSecurity).toBeCloseTo(184500 * 0.062);
    expect(r.annual.medicare).toBeCloseTo(250000 * 0.0145);
    expect(r.annual.additionalMedicare).toBeCloseTo(50000 * 0.009);
    expect(r.annual.federal).toBeCloseTo(51304);
  });

  it("treats 401(k) as income-tax-free but not FICA-free, and benefits as free of both", () => {
    const k = calculatePaycheck({ ...base, annualGross: 100000, retirementPercent: 10 });
    expect(k.annual.retirement).toBe(10000);
    expect(k.annual.socialSecurity).toBeCloseTo(6200);
    expect(k.taxableIncome).toBe(100000 - 10000 - 16100);
    const h = calculatePaycheck({ ...base, annualGross: 100000, benefitsPerPeriod: 100 });
    expect(h.annual.benefits).toBe(2600);
    expect(h.annual.socialSecurity).toBeCloseTo((100000 - 2600) * 0.062);
  });

  it("caps the 401(k) at the IRS limit and ignores nonsense input", () => {
    expect(calculatePaycheck({ ...base, annualGross: 400000, retirementPercent: 50 }).annual.retirement).toBe(24500);
    const weird = calculatePaycheck({ ...base, annualGross: NaN, retirementPercent: -5, stateRatePercent: 999, payPeriods: 0 });
    expect(Number.isFinite(weird.annual.net)).toBe(true);
    expect(weird.annual.gross).toBe(0);
  });

  it("applies state tax, post-tax deductions and extra withholding", () => {
    const r = calculatePaycheck({ ...base, stateRatePercent: 5, postTaxPerPeriod: 50, extraWithholdingPerPeriod: 20 });
    expect(r.annual.state).toBeCloseTo(3000);
    expect(r.annual.postTax).toBe(1300);
    expect(r.annual.federal).toBeCloseTo(5020 + 520);
  });

  it("reconciles: per-period lines add up to the net", () => {
    const r = calculatePaycheck({ ...base, annualGross: 123456, retirementPercent: 6, benefitsPerPeriod: 85, stateRatePercent: 4, postTaxPerPeriod: 30, extraWithholdingPerPeriod: 10 });
    const p = r.perPeriod;
    expect(p.gross - p.retirement - p.benefits - p.federal - p.socialSecurity - p.medicare - p.additionalMedicare - p.state - p.postTax).toBeCloseTo(p.net);
    expect(r.totalTaxRate).toBeGreaterThan(r.federalEffectiveRate);
  });
});

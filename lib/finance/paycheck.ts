import {
  ADDITIONAL_MEDICARE_RATE,
  ADDITIONAL_MEDICARE_THRESHOLD,
  BRACKETS,
  MEDICARE_RATE,
  RETIREMENT_DEFERRAL_LIMIT,
  SOCIAL_SECURITY_RATE,
  SOCIAL_SECURITY_WAGE_BASE,
  STANDARD_DEDUCTION,
  type FilingStatus,
} from "@/lib/finance/taxData";

export interface PaycheckInput {
  annualGross: number;
  /** Pay periods per year: 52, 26, 24 or 12. */
  payPeriods: number;
  filingStatus: FilingStatus;
  /** Traditional 401(k) contribution as a percent of gross pay (capped at the annual IRS limit). */
  retirementPercent: number;
  /** Section 125 benefits (health, dental, FSA…) per paycheck — reduce income tax and FICA wages. */
  benefitsPerPeriod: number;
  /** Deductions taken after tax per paycheck (Roth 401(k), union dues, garnishments…). */
  postTaxPerPeriod: number;
  /** Flat state + local income tax estimate, percent of income-tax wages. */
  stateRatePercent: number;
  /** Extra federal withholding per paycheck (Form W-4 step 4(c)). */
  extraWithholdingPerPeriod: number;
}

export interface PaycheckLines {
  gross: number;
  retirement: number;
  benefits: number;
  federal: number;
  socialSecurity: number;
  medicare: number;
  additionalMedicare: number;
  state: number;
  postTax: number;
  net: number;
}

export interface PaycheckResult {
  perPeriod: PaycheckLines;
  annual: PaycheckLines;
  taxableIncome: number;
  marginalRate: number;
  /** Federal income tax as a share of gross pay. */
  federalEffectiveRate: number;
  /** All taxes (federal, FICA, state) as a share of gross pay. */
  totalTaxRate: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : 0));

/** Progressive tax on `taxable` for a filing status, plus the marginal rate that applies. */
export function federalIncomeTax(taxable: number, status: FilingStatus): { tax: number; marginalRate: number } {
  let tax = 0;
  let previous = 0;
  let marginalRate = BRACKETS[status][0].rate;
  for (const { upTo, rate } of BRACKETS[status]) {
    if (taxable <= previous) break;
    tax += (Math.min(taxable, upTo) - previous) * rate;
    marginalRate = rate;
    previous = upTo;
  }
  return { tax, marginalRate };
}

/** Estimates a paycheck using 2026 US federal rules. State tax is a flat estimate; W-4 credits and other adjustments are not modeled. */
export function calculatePaycheck(input: PaycheckInput): PaycheckResult {
  const periods = Math.max(1, Math.round(input.payPeriods));
  const gross = Math.max(0, Number.isFinite(input.annualGross) ? input.annualGross : 0);
  const retirement = Math.min(gross * (clamp(input.retirementPercent, 0, 100) / 100), RETIREMENT_DEFERRAL_LIMIT);
  const benefits = Math.min(Math.max(0, input.benefitsPerPeriod) * periods, gross);
  const postTax = Math.max(0, input.postTaxPerPeriod) * periods;
  const extra = Math.max(0, input.extraWithholdingPerPeriod) * periods;

  const incomeTaxWages = Math.max(0, gross - retirement - benefits);
  const taxableIncome = Math.max(0, incomeTaxWages - STANDARD_DEDUCTION[input.filingStatus]);
  const { tax: bracketTax, marginalRate } = federalIncomeTax(taxableIncome, input.filingStatus);
  const federal = bracketTax + extra;

  // 401(k) deferrals are still subject to FICA; Section 125 benefits are not.
  const ficaWages = Math.max(0, gross - benefits);
  const socialSecurity = Math.min(ficaWages, SOCIAL_SECURITY_WAGE_BASE) * SOCIAL_SECURITY_RATE;
  const medicare = ficaWages * MEDICARE_RATE;
  const additionalMedicare = Math.max(0, ficaWages - ADDITIONAL_MEDICARE_THRESHOLD) * ADDITIONAL_MEDICARE_RATE;
  const state = incomeTaxWages * (clamp(input.stateRatePercent, 0, 100) / 100);

  const net = gross - retirement - benefits - federal - socialSecurity - medicare - additionalMedicare - state - postTax;
  const annual: PaycheckLines = { gross, retirement, benefits, federal, socialSecurity, medicare, additionalMedicare, state, postTax, net };
  const perPeriod = Object.fromEntries(Object.entries(annual).map(([key, value]) => [key, value / periods])) as unknown as PaycheckLines;
  const taxes = federal + socialSecurity + medicare + additionalMedicare + state;

  return {
    perPeriod,
    annual,
    taxableIncome,
    marginalRate,
    federalEffectiveRate: gross > 0 ? federal / gross : 0,
    totalTaxRate: gross > 0 ? taxes / gross : 0,
  };
}

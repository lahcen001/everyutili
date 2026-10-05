/**
 * US federal figures for tax year 2026. Review and update every year.
 * Sources: IRS Rev. Proc. 2025-32 (brackets, standard deduction), SSA contribution and benefit base
 * ($184,500), IRS retirement plan limits ($24,500 401(k) deferral). Rates for Social Security and
 * Medicare are set by statute.
 */
export const TAX_YEAR = 2026;

export type FilingStatus = "single" | "married" | "head";

export interface Bracket {
  /** Taxable income up to this amount is taxed at `rate` (Infinity for the top bracket). */
  upTo: number;
  rate: number;
}

export const FILING_STATUSES: { id: FilingStatus; label: string }[] = [
  { id: "single", label: "Single" },
  { id: "married", label: "Married filing jointly" },
  { id: "head", label: "Head of household" },
];

export const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 16100,
  married: 32200,
  head: 24150,
};

export const BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: [
    { upTo: 12400, rate: 0.1 },
    { upTo: 50400, rate: 0.12 },
    { upTo: 105700, rate: 0.22 },
    { upTo: 201775, rate: 0.24 },
    { upTo: 256225, rate: 0.32 },
    { upTo: 640600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  married: [
    { upTo: 24800, rate: 0.1 },
    { upTo: 100800, rate: 0.12 },
    { upTo: 211400, rate: 0.22 },
    { upTo: 403550, rate: 0.24 },
    { upTo: 512450, rate: 0.32 },
    { upTo: 768700, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  head: [
    { upTo: 17700, rate: 0.1 },
    { upTo: 67450, rate: 0.12 },
    { upTo: 105700, rate: 0.22 },
    { upTo: 201750, rate: 0.24 },
    { upTo: 256200, rate: 0.32 },
    { upTo: 640600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
};

export const SOCIAL_SECURITY_RATE = 0.062;
export const SOCIAL_SECURITY_WAGE_BASE = 184500;
export const MEDICARE_RATE = 0.0145;
export const ADDITIONAL_MEDICARE_RATE = 0.009;
/** Employers start withholding the additional Medicare tax above this amount of wages, whatever the filing status. */
export const ADDITIONAL_MEDICARE_THRESHOLD = 200000;
export const RETIREMENT_DEFERRAL_LIMIT = 24500;

export type PayBasis = "annual" | "hourly";

export interface SalaryInput {
  basis: PayBasis;
  amount: number;
  hoursPerWeek: number;
  daysPerWeek: number;
  /** Unpaid weeks off per year (paid vacation is already inside the salary). */
  unpaidWeeksOff: number;
  paidVacationDays: number;
  paidHolidays: number;
  overtimeHoursPerWeek: number;
  overtimeMultiplier: number;
}

export interface SalaryResult {
  annual: number;
  hourly: number;
  daily: number;
  weekly: number;
  biweekly: number;
  monthly: number;
  /** Hours actually worked per year */
  workedHours: number;
  /** Hours paid per year, including paid leave */
  paidHours: number;
}

const WEEKS = 52;

/**
 * Annual ↔ hourly with paid time off and overtime.
 * Salary → hourly divides by hours actually worked (paid leave is not worked).
 * Hourly → annual pays regular hours for every week not unpaid, plus overtime at the multiplier.
 */
export function convertSalary(i: SalaryInput): SalaryResult {
  const hoursPerDay = i.daysPerWeek > 0 ? i.hoursPerWeek / i.daysPerWeek : 0;
  const unpaidWeeks = Math.min(Math.max(i.unpaidWeeksOff, 0), WEEKS);
  const paidWeeks = WEEKS - unpaidWeeks;
  const paidLeaveHours = (Math.max(i.paidVacationDays, 0) + Math.max(i.paidHolidays, 0)) * hoursPerDay;
  const paidHours = Math.max(0, paidWeeks * i.hoursPerWeek);
  const workedRegular = Math.max(0, paidHours - paidLeaveHours);
  const ot = Math.max(i.overtimeHoursPerWeek, 0);
  const otWeeks = Math.max(0, paidWeeks - paidLeaveHours / (i.hoursPerWeek || 1));
  const otHours = ot * otWeeks;
  const otMult = Math.max(i.overtimeMultiplier, 1);

  let annual: number;
  let hourly: number;
  if (i.basis === "hourly") {
    hourly = i.amount;
    annual = hourly * paidHours + hourly * otMult * otHours;
  } else {
    annual = i.amount;
    // Overtime-equivalent hours weigh in at the multiplier when solving for the base rate.
    const weighted = paidHours + otMult * otHours;
    hourly = weighted > 0 ? annual / weighted : 0;
  }
  const workedHours = workedRegular + otHours;
  return {
    annual,
    hourly,
    daily: hourly * hoursPerDay,
    weekly: annual / WEEKS,
    biweekly: annual / 26,
    monthly: annual / 12,
    workedHours,
    paidHours,
  };
}

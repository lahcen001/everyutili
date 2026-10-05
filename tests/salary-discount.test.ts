import { describe, expect, it } from "vitest";
import { convertSalary, type SalaryInput } from "@/lib/finance/salary";
import { originalFromSale, percentOff, stackDiscounts } from "@/lib/finance/discount";

const base: SalaryInput = { basis: "annual", amount: 52000, hoursPerWeek: 40, daysPerWeek: 5, unpaidWeeksOff: 0, paidVacationDays: 0, paidHolidays: 0, overtimeHoursPerWeek: 0, overtimeMultiplier: 1.5 };

describe("salary", () => {
  it("annual to hourly basic", () => {
    const r = convertSalary(base);
    expect(r.hourly).toBeCloseTo(25);
    expect(r.daily).toBeCloseTo(200);
    expect(r.weekly).toBeCloseTo(1000);
    expect(r.monthly).toBeCloseTo(52000 / 12);
  });
  it("unpaid weeks raise hourly rate", () => {
    expect(convertSalary({ ...base, unpaidWeeksOff: 2 }).hourly).toBeCloseTo(52000 / 2000);
  });
  it("hourly to annual round trip", () => {
    const r = convertSalary({ ...base, basis: "hourly", amount: 25 });
    expect(r.annual).toBeCloseTo(52000);
  });
  it("overtime adds pay for hourly", () => {
    const r = convertSalary({ ...base, basis: "hourly", amount: 20, overtimeHoursPerWeek: 5 });
    expect(r.annual).toBeCloseTo(20 * 2080 + 20 * 1.5 * 5 * 52);
  });
  it("paid leave counts as paid but not worked", () => {
    const r = convertSalary({ ...base, paidVacationDays: 10 });
    expect(r.paidHours).toBe(2080);
    expect(r.workedHours).toBe(2080 - 80);
  });
});

describe("discount", () => {
  it("stacks multiplicatively", () => {
    const r = stackDiscounts(100, [20, 10]);
    expect(r.finalPrice).toBeCloseTo(72);
    expect(r.effectivePercent).toBeCloseTo(28);
  });
  it("percentOff and originalFromSale", () => {
    expect(percentOff(80, 60)).toBe(25);
    expect(percentOff(0, 10)).toBeNaN();
    expect(originalFromSale(75, 25)).toBeCloseTo(100);
    expect(originalFromSale(75, 100)).toBeNaN();
  });
});

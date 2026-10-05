"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { convertSalary, type PayBasis } from "@/lib/finance/salary";
import { NumField, money, num } from "@/components/tools/financial/NumField";
import { cn } from "@/lib/utils";

export default function SalaryToHourly() {
  useTrackTool("salary-to-hourly");
  const [basis, setBasis] = React.useState<PayBasis>("annual");
  const [amount, setAmount] = React.useState("60000");
  const [hoursPerWeek, setHoursPerWeek] = React.useState("40");
  const [daysPerWeek, setDaysPerWeek] = React.useState("5");
  const [unpaidWeeks, setUnpaidWeeks] = React.useState("0");
  const [vacationDays, setVacationDays] = React.useState("0");
  const [holidays, setHolidays] = React.useState("0");
  const [otHours, setOtHours] = React.useState("0");
  const [otMult, setOtMult] = React.useState("1.5");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const r = convertSalary({
    basis,
    amount: num(amount),
    hoursPerWeek: num(hoursPerWeek),
    daysPerWeek: num(daysPerWeek),
    unpaidWeeksOff: num(unpaidWeeks),
    paidVacationDays: num(vacationDays),
    paidHolidays: num(holidays),
    overtimeHoursPerWeek: num(otHours),
    overtimeMultiplier: num(otMult),
  });
  const invalid = num(hoursPerWeek) <= 0 || num(daysPerWeek) <= 0;

  const handleSave = async () => {
    await saveToolResult("salary-to-hourly", {
      title: `${money(r.annual, 0)}/yr = ${money(r.hourly)}/hr`,
      summary: `${hoursPerWeek} hrs/wk · daily ${money(r.daily)} · weekly ${money(r.weekly)} · monthly ${money(r.monthly)}`,
    });
    historyRef.current?.refresh();
  };

  const tiles = [
    { label: basis === "annual" ? "Hourly" : "Annual", value: basis === "annual" ? money(r.hourly) : money(r.annual, 0), primary: true },
    { label: "Daily", value: money(r.daily) },
    { label: "Weekly", value: money(r.weekly) },
    { label: "Biweekly", value: money(r.biweekly) },
    { label: "Monthly", value: money(r.monthly) },
    { label: basis === "annual" ? "Annual" : "Hourly", value: basis === "annual" ? money(r.annual, 0) : money(r.hourly) },
  ];

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="flex overflow-hidden rounded-lg border border-border text-sm sm:w-fit" role="group" aria-label="Convert from">
          {([["annual", "I know my annual salary"], ["hourly", "I know my hourly rate"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setBasis(id)} aria-pressed={basis === id} className={cn("flex-1 px-3 py-1.5 font-medium transition-colors", basis === id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField label={basis === "annual" ? "Annual salary ($)" : "Hourly rate ($)"} value={amount} onChange={setAmount} />
          <NumField label="Hours per week" value={hoursPerWeek} onChange={setHoursPerWeek} />
          <NumField label="Days per week" value={daysPerWeek} onChange={setDaysPerWeek} />
        </div>
        <details className="rounded-lg border border-border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Time off &amp; overtime</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <NumField label="Unpaid weeks off per year" value={unpaidWeeks} onChange={setUnpaidWeeks} />
            <NumField label="Paid vacation days" value={vacationDays} onChange={setVacationDays} />
            <NumField label="Paid holidays" value={holidays} onChange={setHolidays} />
            <NumField label="Overtime hours per week" value={otHours} onChange={setOtHours} />
            <NumField label="Overtime multiplier" value={otMult} onChange={setOtMult} hint="1.5 = time and a half" />
          </div>
        </details>
        {invalid && <p role="alert" className="text-sm text-destructive">Hours and days per week must be above zero.</p>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((item) => (
          <Card key={item.label} className="p-5 text-center">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className={cn("mt-1 text-2xl font-bold tabular-nums", item.primary && "text-primary")}>{item.value}</p>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {Math.round(r.paidHours).toLocaleString()} paid hours a year, {Math.round(r.workedHours).toLocaleString()} worked. Paid leave is included in your pay but not worked, so the hourly rate on a salary is taken over paid hours. Before tax.
      </p>

      <Button size="sm" variant="outline" onClick={handleSave} disabled={invalid}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="salary-to-hourly" />
    </div>
  );
}

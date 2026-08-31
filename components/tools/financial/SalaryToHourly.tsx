"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function SalaryToHourly() {
  useTrackTool("salary-to-hourly");
  const [salary, setSalary] = React.useState(60000);
  const [hoursPerWeek, setHoursPerWeek] = React.useState(40);
  const [weeksPerYear, setWeeksPerYear] = React.useState(52);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const totalHours = hoursPerWeek * weeksPerYear;
  const hourly = totalHours > 0 ? salary / totalHours : 0;
  const daily = hourly * (hoursPerWeek / 5);
  const weekly = hourly * hoursPerWeek;
  const monthly = salary / 12;

  const handleSave = async () => {
    await saveToolResult("salary-to-hourly", {
      title: `${formatCurrency(salary)}/yr → ${formatCurrency(hourly)}/hr`,
      summary: `${hoursPerWeek} hrs/wk, ${weeksPerYear} wks/yr — daily ${formatCurrency(daily)}, weekly ${formatCurrency(weekly)}, monthly ${formatCurrency(monthly)}`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Annual salary ($)</span>
            <input
              type="number"
              min={0}
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Hours per week</span>
            <input
              type="number"
              min={1}
              max={168}
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Weeks per year</span>
            <input
              type="number"
              min={1}
              max={52}
              value={weeksPerYear}
              onChange={(e) => setWeeksPerYear(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Hourly", value: hourly },
          { label: "Daily", value: daily },
          { label: "Weekly", value: weekly },
          { label: "Monthly", value: monthly },
        ].map((item) => (
          <Card key={item.label} className="p-5 text-center">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(item.value)}</p>
          </Card>
        ))}
      </div>

      <Button size="sm" variant="outline" onClick={handleSave}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="salary-to-hourly" />
    </div>
  );
}

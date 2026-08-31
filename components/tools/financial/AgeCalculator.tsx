"use client";

import * as React from "react";
import { Cake, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

function todayIsoDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

interface AgeBreakdown {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalWeeks: number;
  totalMonths: number;
  daysUntilNextBirthday: number;
}

function computeAge(birthDate: Date, asOfDate: Date): AgeBreakdown | null {
  if (Number.isNaN(birthDate.getTime()) || Number.isNaN(asOfDate.getTime())) return null;
  if (birthDate.getTime() > asOfDate.getTime()) return null;

  let years = asOfDate.getFullYear() - birthDate.getFullYear();
  let months = asOfDate.getMonth() - birthDate.getMonth();
  let days = asOfDate.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const msPerDay = 86400000;
  const totalDays = Math.floor((asOfDate.getTime() - birthDate.getTime()) / msPerDay);
  const totalWeeks = Math.floor(totalDays / 7);
  const totalMonths = years * 12 + months;

  let nextBirthday = new Date(asOfDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (nextBirthday.getTime() < asOfDate.getTime()) {
    nextBirthday = new Date(asOfDate.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate());
  }
  const daysUntilNextBirthday = Math.round((nextBirthday.getTime() - asOfDate.getTime()) / msPerDay);

  return { years, months, days, totalDays, totalWeeks, totalMonths, daysUntilNextBirthday };
}

export default function AgeCalculator() {
  useTrackTool("age-calculator");
  const [birthDateInput, setBirthDateInput] = React.useState("2000-01-01");
  const [asOfInput, setAsOfInput] = React.useState(() => todayIsoDate());
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const age = React.useMemo(() => {
    if (!birthDateInput || !asOfInput) return null;
    const birthDate = new Date(`${birthDateInput}T00:00:00`);
    const asOfDate = new Date(`${asOfInput}T00:00:00`);
    return computeAge(birthDate, asOfDate);
  }, [birthDateInput, asOfInput]);

  const handleSave = async () => {
    if (!age) return;
    await saveToolResult("age-calculator", {
      title: `Age: ${age.years} years, ${age.months} months, ${age.days} days`,
      summary: `Born ${birthDateInput} · ${age.daysUntilNextBirthday} days until next birthday`,
      data: JSON.stringify(
        {
          birthDate: birthDateInput,
          asOf: asOfInput,
          years: age.years,
          months: age.months,
          days: age.days,
          totalDays: age.totalDays,
          totalWeeks: age.totalWeeks,
          totalMonths: age.totalMonths,
          daysUntilNextBirthday: age.daysUntilNextBirthday,
        },
        null,
        2
      ),
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Date of birth</span>
          <input
            type="date"
            value={birthDateInput}
            max={asOfInput}
            onChange={(e) => setBirthDateInput(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Calculate age as of</span>
          <input
            type="date"
            value={asOfInput}
            onChange={(e) => setAsOfInput(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
      </Card>

      {age ? (
        <>
          <Card className="flex flex-col items-center gap-3 p-6 text-center">
            <Cake className="h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground">Your age</p>
            <p className="text-3xl font-extrabold tabular-nums">
              {age.years} <span className="text-lg font-medium text-muted-foreground">years</span>{" "}
              {age.months} <span className="text-lg font-medium text-muted-foreground">months</span>{" "}
              {age.days} <span className="text-lg font-medium text-muted-foreground">days</span>
            </p>
            <Button size="sm" variant="outline" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Total days lived</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{age.totalDays.toLocaleString()}</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Total weeks</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{age.totalWeeks.toLocaleString()}</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Total months</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{age.totalMonths.toLocaleString()}</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Next birthday in</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
                {age.daysUntilNextBirthday} day{age.daysUntilNextBirthday === 1 ? "" : "s"}
              </p>
            </Card>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Date of birth must be a valid date on or before the &quot;as of&quot; date.
        </div>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="age-calculator" />
    </div>
  );
}

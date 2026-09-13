"use client";

import * as React from "react";
import { CalendarDays, Save } from "lucide-react";
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

interface DateDiff {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalWeeks: number;
  totalMonths: number;
  businessDays: number;
}

function computeDiff(start: Date, end: Date): DateDiff | null {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const [earlier, later] = start.getTime() <= end.getTime() ? [start, end] : [end, start];

  let years = later.getFullYear() - earlier.getFullYear();
  let months = later.getMonth() - earlier.getMonth();
  let days = later.getDate() - earlier.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(later.getFullYear(), later.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const msPerDay = 86400000;
  const totalDays = Math.round((later.getTime() - earlier.getTime()) / msPerDay);
  const totalWeeks = Math.floor(totalDays / 7);
  const totalMonths = years * 12 + months;

  let businessDays = 0;
  const cursor = new Date(earlier);
  for (let i = 0; i < totalDays; i++) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) businessDays++;
    cursor.setDate(cursor.getDate() + 1);
  }

  return { years, months, days, totalDays, totalWeeks, totalMonths, businessDays };
}

export default function DateDifferenceCalculator() {
  useTrackTool("date-difference-calculator");
  const [startInput, setStartInput] = React.useState(() => todayIsoDate());
  const [endInput, setEndInput] = React.useState("2026-12-31");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const diff = React.useMemo(() => {
    if (!startInput || !endInput) return null;
    const start = new Date(`${startInput}T00:00:00`);
    const end = new Date(`${endInput}T00:00:00`);
    return computeDiff(start, end);
  }, [startInput, endInput]);

  const handleSave = async () => {
    if (!diff) return;
    await saveToolResult("date-difference-calculator", {
      title: `${diff.totalDays} days between ${startInput} and ${endInput}`,
      summary: `${diff.years}y ${diff.months}m ${diff.days}d · ${diff.businessDays} business days`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Start date</span>
          <input
            type="date"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">End date</span>
          <input
            type="date"
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
      </Card>

      {diff ? (
        <>
          <Card className="flex flex-col items-center gap-3 p-6 text-center">
            <CalendarDays className="h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground">Difference</p>
            <p className="text-3xl font-extrabold tabular-nums">
              {diff.years} <span className="text-lg font-medium text-muted-foreground">years</span>{" "}
              {diff.months} <span className="text-lg font-medium text-muted-foreground">months</span>{" "}
              {diff.days} <span className="text-lg font-medium text-muted-foreground">days</span>
            </p>
            <Button size="sm" variant="outline" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Total days</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{diff.totalDays.toLocaleString()}</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Total weeks</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{diff.totalWeeks.toLocaleString()}</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Total months</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{diff.totalMonths.toLocaleString()}</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Business days</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
                {diff.businessDays.toLocaleString()}
              </p>
            </Card>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Both dates must be valid.
        </div>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="date-difference-calculator" />
    </div>
  );
}

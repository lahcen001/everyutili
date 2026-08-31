"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { SliderInput, SvgAreaChart } from "@/components/tools/financial/InteractiveCalculatorShell";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    value
  );
}

const FREQUENCIES = [
  { value: 1, label: "Annually" },
  { value: 4, label: "Quarterly" },
  { value: 12, label: "Monthly" },
  { value: 365, label: "Daily" },
];

export default function CompoundInterestCalculator() {
  useTrackTool("compound-interest-calculator");
  const [principal, setPrincipal] = React.useState(10000);
  const [annualRate, setAnnualRate] = React.useState(6);
  const [years, setYears] = React.useState(10);
  const [frequency, setFrequency] = React.useState(12);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const rate = annualRate / 100;
  const futureValue = principal * Math.pow(1 + rate / frequency, frequency * years);
  const totalInterest = futureValue - principal;

  const yearlyPoints = React.useMemo(() => {
    const span = Math.max(years, 1);
    return Array.from({ length: span + 1 }, (_, year) =>
      principal * Math.pow(1 + rate / frequency, frequency * year)
    );
  }, [principal, rate, frequency, years]);

  const chartLabels = React.useMemo(
    () => yearlyPoints.map((_, year) => `Y${year}`),
    [yearlyPoints]
  );

  const chartSeries = React.useMemo(
    () => [
      {
        label: "Principal",
        color: "var(--primary)",
        points: yearlyPoints.map(() => principal),
      },
      {
        label: "Accrued interest",
        color: "#059669",
        points: yearlyPoints.map((value) => Math.max(value - principal, 0)),
      },
    ],
    [yearlyPoints, principal]
  );

  const handleSave = async () => {
    await saveToolResult("compound-interest-calculator", {
      title: `Future value: ${formatCurrency(futureValue)}`,
      summary: `${formatCurrency(principal)} at ${annualRate}% for ${years}y, interest: ${formatCurrency(totalInterest)}`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <SliderInput
            label="Initial principal ($)"
            value={principal}
            onChange={setPrincipal}
            min={0}
            max={500000}
            step={100}
            formatValue={(v) => `$${v.toLocaleString("en-US")}`}
          />
          <SliderInput
            label="Annual interest rate (%)"
            value={annualRate}
            onChange={setAnnualRate}
            min={0}
            max={30}
            step={0.1}
            unit="%"
          />
          <SliderInput
            label="Time (years)"
            value={years}
            onChange={setYears}
            min={0}
            max={40}
            step={1}
            unit="y"
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium">Compounding frequency</span>
          <div className="flex flex-wrap overflow-hidden rounded-lg border border-border w-fit">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                onClick={() => setFrequency(f.value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  frequency === f.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold">Growth over time</h3>
        <SvgAreaChart series={chartSeries} xLabels={chartLabels} />
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Future value</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{formatCurrency(futureValue)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Total interest earned</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalInterest)}
          </p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Starting principal</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(principal)}</p>
        </Card>
      </div>

      <Button size="sm" variant="outline" onClick={handleSave}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="compound-interest-calculator" />
    </div>
  );
}

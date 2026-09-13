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

export default function InvestmentReturnCalculator() {
  useTrackTool("investment-return-calculator");
  const [initial, setInitial] = React.useState(5000);
  const [monthlyContribution, setMonthlyContribution] = React.useState(300);
  const [annualReturn, setAnnualReturn] = React.useState(8);
  const [years, setYears] = React.useState(15);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const monthlyRate = annualReturn / 100 / 12;

  const yearlyPoints = React.useMemo(() => {
    const span = Math.max(years, 1);
    const points: { balance: number; contributed: number }[] = [];
    let balance = initial;
    let contributed = initial;
    points.push({ balance, contributed });
    for (let year = 1; year <= span; year++) {
      for (let month = 0; month < 12; month++) {
        balance = balance * (1 + monthlyRate) + monthlyContribution;
        contributed += monthlyContribution;
      }
      points.push({ balance, contributed });
    }
    return points;
  }, [initial, monthlyContribution, monthlyRate, years]);

  const finalValue = yearlyPoints[yearlyPoints.length - 1]?.balance ?? initial;
  const totalContributed = yearlyPoints[yearlyPoints.length - 1]?.contributed ?? initial;
  const totalGrowth = finalValue - totalContributed;

  const chartLabels = React.useMemo(() => yearlyPoints.map((_, year) => `Y${year}`), [yearlyPoints]);

  const chartSeries = React.useMemo(
    () => [
      {
        label: "Contributed",
        color: "var(--primary)",
        points: yearlyPoints.map((p) => p.contributed),
      },
      {
        label: "Growth",
        color: "#059669",
        points: yearlyPoints.map((p) => Math.max(p.balance - p.contributed, 0)),
      },
    ],
    [yearlyPoints]
  );

  const handleSave = async () => {
    await saveToolResult("investment-return-calculator", {
      title: `Future value: ${formatCurrency(finalValue)}`,
      summary: `${formatCurrency(initial)} initial + ${formatCurrency(monthlyContribution)}/mo at ${annualReturn}% for ${years}y, growth: ${formatCurrency(totalGrowth)}`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <SliderInput
            label="Initial investment ($)"
            value={initial}
            onChange={setInitial}
            min={0}
            max={500000}
            step={500}
            formatValue={(v) => `$${v.toLocaleString("en-US")}`}
          />
          <SliderInput
            label="Monthly contribution ($)"
            value={monthlyContribution}
            onChange={setMonthlyContribution}
            min={0}
            max={10000}
            step={50}
            formatValue={(v) => `$${v.toLocaleString("en-US")}`}
          />
          <SliderInput
            label="Expected annual return (%)"
            value={annualReturn}
            onChange={setAnnualReturn}
            min={0}
            max={20}
            step={0.1}
            unit="%"
          />
          <SliderInput
            label="Time horizon (years)"
            value={years}
            onChange={(v) => setYears(Math.max(v, 1))}
            min={1}
            max={40}
            step={1}
            unit="y"
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold">Growth over time</h3>
        <SvgAreaChart series={chartSeries} xLabels={chartLabels} />
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Future value</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{formatCurrency(finalValue)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Total contributed</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(totalContributed)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Total growth</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalGrowth)}
          </p>
        </Card>
      </div>

      <Button size="sm" variant="outline" onClick={handleSave}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="investment-return-calculator" />
    </div>
  );
}

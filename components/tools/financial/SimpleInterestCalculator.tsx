"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { SliderInput } from "@/components/tools/financial/InteractiveCalculatorShell";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    value
  );
}

export default function SimpleInterestCalculator() {
  useTrackTool("simple-interest-calculator");
  const [principal, setPrincipal] = React.useState(10000);
  const [annualRate, setAnnualRate] = React.useState(5);
  const [years, setYears] = React.useState(3);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const interest = principal * (annualRate / 100) * years;
  const total = principal + interest;

  const handleSave = async () => {
    await saveToolResult("simple-interest-calculator", {
      title: `Simple interest: ${formatCurrency(interest)}`,
      summary: `${formatCurrency(principal)} at ${annualRate}% for ${years}y, total: ${formatCurrency(total)}`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <SliderInput
            label="Principal ($)"
            value={principal}
            onChange={setPrincipal}
            min={0}
            max={500000}
            step={500}
            formatValue={(v) => `$${v.toLocaleString("en-US")}`}
          />
          <SliderInput
            label="Annual interest rate (%)"
            value={annualRate}
            onChange={setAnnualRate}
            min={0}
            max={25}
            step={0.1}
            unit="%"
          />
          <SliderInput
            label="Time (years)"
            value={years}
            onChange={(v) => setYears(Math.max(v, 0))}
            min={0}
            max={30}
            step={1}
            unit="y"
          />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Interest earned</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{formatCurrency(interest)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Principal</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(principal)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Total amount</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(total)}</p>
        </Card>
      </div>

      <Button size="sm" variant="outline" onClick={handleSave}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="simple-interest-calculator" />
    </div>
  );
}

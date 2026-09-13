"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { SliderInput, SvgDonutChart } from "@/components/tools/financial/InteractiveCalculatorShell";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    value
  );
}

const FREQUENCIES = [
  { value: 52, label: "Weekly" },
  { value: 26, label: "Biweekly" },
  { value: 24, label: "Semi-monthly" },
  { value: 12, label: "Monthly" },
];

export default function PaycheckCalculator() {
  useTrackTool("paycheck-calculator");
  const [annualSalary, setAnnualSalary] = React.useState(65000);
  const [payFrequency, setPayFrequency] = React.useState(26);
  const [preTaxDeductions, setPreTaxDeductions] = React.useState(3000);
  const [effectiveTaxRate, setEffectiveTaxRate] = React.useState(22);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const grossPerPeriod = annualSalary / payFrequency;
  const preTaxPerPeriod = preTaxDeductions / payFrequency;
  const taxablePerPeriod = Math.max(grossPerPeriod - preTaxPerPeriod, 0);
  const taxPerPeriod = taxablePerPeriod * (effectiveTaxRate / 100);
  const netPerPeriod = taxablePerPeriod - taxPerPeriod;
  const netAnnual = netPerPeriod * payFrequency;

  const handleSave = async () => {
    const freqLabel = FREQUENCIES.find((f) => f.value === payFrequency)?.label ?? "";
    await saveToolResult("paycheck-calculator", {
      title: `Net pay: ${formatCurrency(netPerPeriod)}/${freqLabel.toLowerCase()}`,
      summary: `${formatCurrency(annualSalary)}/yr gross, ${effectiveTaxRate}% tax rate, net annual: ${formatCurrency(netAnnual)}`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <SliderInput
            label="Annual salary ($)"
            value={annualSalary}
            onChange={setAnnualSalary}
            min={0}
            max={500000}
            step={500}
            formatValue={(v) => `$${v.toLocaleString("en-US")}`}
          />
          <SliderInput
            label="Pre-tax deductions ($/yr)"
            value={preTaxDeductions}
            onChange={setPreTaxDeductions}
            min={0}
            max={50000}
            step={100}
            formatValue={(v) => `$${v.toLocaleString("en-US")}`}
          />
          <SliderInput
            label="Effective tax rate (%)"
            value={effectiveTaxRate}
            onChange={setEffectiveTaxRate}
            min={0}
            max={50}
            step={0.5}
            unit="%"
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium">Pay frequency</span>
          <div className="flex flex-wrap overflow-hidden rounded-lg border border-border w-fit">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                onClick={() => setPayFrequency(f.value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  payFrequency === f.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold">Per-paycheck breakdown</h3>
        <SvgDonutChart
          segments={[
            { label: "Net pay", value: Math.max(netPerPeriod, 0), color: "var(--primary)" },
            { label: "Taxes", value: Math.max(taxPerPeriod, 0), color: "#dc2626" },
            { label: "Pre-tax deductions", value: preTaxPerPeriod, color: "#d97706" },
          ]}
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Net pay per period</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{formatCurrency(netPerPeriod)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Gross pay per period</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(grossPerPeriod)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Net annual pay</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(netAnnual)}</p>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Estimate only — uses a single effective tax rate you set, not real federal/state/FICA
        brackets. Check a payroll provider or tax professional for exact figures.
      </p>

      <Button size="sm" variant="outline" onClick={handleSave}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="paycheck-calculator" />
    </div>
  );
}

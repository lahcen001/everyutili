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

export default function MortgageCalculator() {
  useTrackTool("mortgage-calculator");
  const [homePrice, setHomePrice] = React.useState(400000);
  const [downPayment, setDownPayment] = React.useState(80000);
  const [annualRate, setAnnualRate] = React.useState(6.5);
  const [termYears, setTermYears] = React.useState(30);
  const [annualTax, setAnnualTax] = React.useState(4800);
  const [annualInsurance, setAnnualInsurance] = React.useState(1500);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const principal = Math.max(homePrice - downPayment, 0);
  const monthlyRate = annualRate / 100 / 12;
  const months = termYears * 12;
  const principalAndInterest =
    monthlyRate === 0
      ? principal / months
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
        (Math.pow(1 + monthlyRate, months) - 1);
  const monthlyTax = annualTax / 12;
  const monthlyInsurance = annualInsurance / 12;
  const monthlyPayment = principalAndInterest + monthlyTax + monthlyInsurance;
  const totalPayment = principalAndInterest * months;
  const totalInterest = totalPayment - principal;

  const handleSave = async () => {
    await saveToolResult("mortgage-calculator", {
      title: `Mortgage: ${formatCurrency(monthlyPayment)}/mo`,
      summary: `${formatCurrency(principal)} loan at ${annualRate}% for ${termYears}y, total interest: ${formatCurrency(totalInterest)}`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <SliderInput
            label="Home price ($)"
            value={homePrice}
            onChange={setHomePrice}
            min={0}
            max={2000000}
            step={5000}
            formatValue={(v) => `$${v.toLocaleString("en-US")}`}
          />
          <SliderInput
            label="Down payment ($)"
            value={downPayment}
            onChange={(v) => setDownPayment(Math.min(v, homePrice))}
            min={0}
            max={homePrice}
            step={5000}
            formatValue={(v) => `$${v.toLocaleString("en-US")}`}
          />
          <SliderInput
            label="Annual interest rate (%)"
            value={annualRate}
            onChange={setAnnualRate}
            min={0}
            max={15}
            step={0.05}
            unit="%"
          />
          <SliderInput
            label="Loan term (years)"
            value={termYears}
            onChange={(v) => setTermYears(Math.max(v, 1))}
            min={5}
            max={30}
            step={5}
            unit="y"
          />
          <SliderInput
            label="Annual property tax ($)"
            value={annualTax}
            onChange={setAnnualTax}
            min={0}
            max={30000}
            step={100}
            formatValue={(v) => `$${v.toLocaleString("en-US")}`}
          />
          <SliderInput
            label="Annual home insurance ($)"
            value={annualInsurance}
            onChange={setAnnualInsurance}
            min={0}
            max={10000}
            step={50}
            formatValue={(v) => `$${v.toLocaleString("en-US")}`}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold">Monthly payment breakdown</h3>
        <SvgDonutChart
          segments={[
            { label: "Principal & interest", value: principalAndInterest, color: "var(--primary)" },
            { label: "Property tax", value: monthlyTax, color: "#059669" },
            { label: "Home insurance", value: monthlyInsurance, color: "#d97706" },
          ]}
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Monthly payment</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{formatCurrency(monthlyPayment)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Loan amount</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(principal)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Total interest</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(totalInterest)}</p>
        </Card>
      </div>

      <Button size="sm" variant="outline" onClick={handleSave}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="mortgage-calculator" />
    </div>
  );
}

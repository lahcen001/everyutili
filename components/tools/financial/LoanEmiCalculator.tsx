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

export default function LoanEmiCalculator() {
  useTrackTool("loan-emi-calculator");
  const [principal, setPrincipal] = React.useState(20000);
  const [annualRate, setAnnualRate] = React.useState(7.5);
  const [termYears, setTermYears] = React.useState(5);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const monthlyRate = annualRate / 100 / 12;
  const months = termYears * 12;
  const emi =
    monthlyRate === 0
      ? principal / months
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
        (Math.pow(1 + monthlyRate, months) - 1);
  const totalPayment = emi * months;
  const totalInterest = totalPayment - principal;

  const amortizationSchedule = React.useMemo(() => {
    const rows: {
      month: number;
      payment: number;
      principalPortion: number;
      interestPortion: number;
      balance: number;
    }[] = [];
    let balance = principal;
    for (let month = 1; month <= months; month++) {
      // Interest accrues on the remaining balance each month; the rest of
      // the fixed EMI payment goes toward paying down principal.
      const interestPortion = balance * monthlyRate;
      const principalPortion = Math.min(emi - interestPortion, balance);
      balance = Math.max(balance - principalPortion, 0);
      rows.push({ month, payment: emi, principalPortion, interestPortion, balance });
    }
    return rows;
  }, [principal, monthlyRate, months, emi]);

  const handleSave = async () => {
    await saveToolResult("loan-emi-calculator", {
      title: `EMI: ${formatCurrency(emi)}/mo`,
      summary: `${formatCurrency(principal)} at ${annualRate}% for ${termYears}y, total interest: ${formatCurrency(totalInterest)}`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <SliderInput
            label="Loan amount ($)"
            value={principal}
            onChange={setPrincipal}
            min={0}
            max={1000000}
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
            label="Loan term (years)"
            value={termYears}
            onChange={(v) => setTermYears(Math.max(v, 1))}
            min={1}
            max={30}
            step={1}
            unit="y"
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold">Principal vs. interest</h3>
        <SvgDonutChart
          segments={[
            { label: "Principal", value: principal, color: "var(--primary)" },
            { label: "Total interest", value: totalInterest, color: "#059669" },
          ]}
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Monthly payment (EMI)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{formatCurrency(emi)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Total interest</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(totalInterest)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Total payment</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(totalPayment)}</p>
        </Card>
      </div>

      <Button size="sm" variant="outline" onClick={handleSave}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <Card className="p-4">
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            Monthly amortization schedule ({months} months)
          </summary>
          <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Month</th>
                  <th className="px-3 py-2 text-right">Payment</th>
                  <th className="px-3 py-2 text-right">Principal</th>
                  <th className="px-3 py-2 text-right">Interest</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {amortizationSchedule.map((row) => (
                  <tr key={row.month} className="border-t border-border">
                    <td className="px-3 py-1.5 tabular-nums">{row.month}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.payment)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.principalPortion)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.interestPortion)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="loan-emi-calculator" />
    </div>
  );
}

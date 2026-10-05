"use client";

import * as React from "react";
import { Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { SliderInput, SvgDonutChart } from "@/components/tools/financial/InteractiveCalculatorShell";
import { calculatePaycheck } from "@/lib/finance/paycheck";
import { FILING_STATUSES, RETIREMENT_DEFERRAL_LIMIT, TAX_YEAR, type FilingStatus } from "@/lib/finance/taxData";
import { cn } from "@/lib/utils";

const money = (value: number, digits = 2) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

const FREQUENCIES = [
  { value: 52, label: "Weekly" },
  { value: 26, label: "Biweekly" },
  { value: 24, label: "Semi-monthly" },
  { value: 12, label: "Monthly" },
];

export default function PaycheckCalculator() {
  useTrackTool("paycheck-calculator");
  const [annualGross, setAnnualGross] = React.useState(65000);
  const [payPeriods, setPayPeriods] = React.useState(26);
  const [filingStatus, setFilingStatus] = React.useState<FilingStatus>("single");
  const [retirementPercent, setRetirementPercent] = React.useState(5);
  const [benefitsPerPeriod, setBenefitsPerPeriod] = React.useState(75);
  const [stateRatePercent, setStateRatePercent] = React.useState(4);
  const [postTaxPerPeriod, setPostTaxPerPeriod] = React.useState(0);
  const [extraWithholdingPerPeriod, setExtraWithholdingPerPeriod] = React.useState(0);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const result = calculatePaycheck({ annualGross, payPeriods, filingStatus, retirementPercent, benefitsPerPeriod, postTaxPerPeriod, stateRatePercent, extraWithholdingPerPeriod });
  const p = result.perPeriod;
  const a = result.annual;
  const frequencyLabel = FREQUENCIES.find((f) => f.value === payPeriods)?.label.toLowerCase() ?? "";

  const rows: { label: string; period: number; annual: number; kind: "pay" | "deduction" | "tax" }[] = [
    { label: "Gross pay", period: p.gross, annual: a.gross, kind: "pay" },
    { label: "401(k) contribution", period: -p.retirement, annual: -a.retirement, kind: "deduction" },
    { label: "Pre-tax benefits", period: -p.benefits, annual: -a.benefits, kind: "deduction" },
    { label: "Federal income tax", period: -p.federal, annual: -a.federal, kind: "tax" },
    { label: "Social Security (6.2%)", period: -p.socialSecurity, annual: -a.socialSecurity, kind: "tax" },
    { label: "Medicare (1.45%)", period: -p.medicare, annual: -a.medicare, kind: "tax" },
    ...(a.additionalMedicare > 0 ? [{ label: "Additional Medicare (0.9%)", period: -p.additionalMedicare, annual: -a.additionalMedicare, kind: "tax" as const }] : []),
    { label: "State & local income tax", period: -p.state, annual: -a.state, kind: "tax" },
    { label: "Post-tax deductions", period: -p.postTax, annual: -a.postTax, kind: "deduction" },
  ];

  const handleSave = async () => {
    await saveToolResult("paycheck-calculator", {
      title: `Take-home: ${money(p.net)} ${frequencyLabel}`,
      summary: `${money(annualGross, 0)}/yr gross · ${FILING_STATUSES.find((f) => f.id === filingStatus)?.label} · federal ${(result.federalEffectiveRate * 100).toFixed(1)}% · net ${money(a.net, 0)}/yr`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SliderInput label="Annual salary ($)" value={annualGross} onChange={setAnnualGross} min={0} max={500000} step={500} formatValue={(v) => `$${v.toLocaleString("en-US")}`} />
          <SliderInput label="401(k) contribution (% of pay)" value={retirementPercent} onChange={setRetirementPercent} min={0} max={50} step={0.5} unit="%" />
          <SliderInput label="Health & benefits per paycheck ($)" value={benefitsPerPeriod} onChange={setBenefitsPerPeriod} min={0} max={1500} step={5} formatValue={(v) => `$${v.toLocaleString("en-US")}`} />
          <SliderInput label="State & local income tax (%)" value={stateRatePercent} onChange={setStateRatePercent} min={0} max={15} step={0.1} unit="%" />
          <SliderInput label="Post-tax deductions per paycheck ($)" value={postTaxPerPeriod} onChange={setPostTaxPerPeriod} min={0} max={2000} step={5} formatValue={(v) => `$${v.toLocaleString("en-US")}`} />
          <SliderInput label="Extra federal withholding per paycheck ($)" value={extraWithholdingPerPeriod} onChange={setExtraWithholdingPerPeriod} min={0} max={1000} step={5} formatValue={(v) => `$${v.toLocaleString("en-US")}`} />
        </div>

        <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Filing status</span>
            <div className="flex flex-wrap overflow-hidden rounded-lg border border-border" role="group" aria-label="Filing status">
              {FILING_STATUSES.map((f) => (
                <button key={f.id} onClick={() => setFilingStatus(f.id)} aria-pressed={filingStatus === f.id} className={cn("px-3 py-1.5 text-sm font-medium transition-colors", filingStatus === f.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Pay frequency</span>
            <div className="flex flex-wrap overflow-hidden rounded-lg border border-border" role="group" aria-label="Pay frequency">
              {FREQUENCIES.map((f) => (
                <button key={f.value} onClick={() => setPayPeriods(f.value)} aria-pressed={payPeriods === f.value} className={cn("px-3 py-1.5 text-sm font-medium transition-colors", payPeriods === f.value ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {a.retirement >= RETIREMENT_DEFERRAL_LIMIT && (
          <p className="text-xs text-amber-600 dark:text-amber-400">401(k) contributions are capped at the {TAX_YEAR} IRS limit of {money(RETIREMENT_DEFERRAL_LIMIT, 0)}.</p>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Take-home per paycheck</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-primary">{money(p.net)}</p>
          <p className="text-xs text-muted-foreground">{frequencyLabel}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Take-home per year</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{money(a.net, 0)}</p>
          <p className="text-xs text-muted-foreground">{money(a.net / 12, 0)} per month</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Taxes as a share of gross</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{(result.totalTaxRate * 100).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">
            federal {(result.federalEffectiveRate * 100).toFixed(1)}% · top bracket {Math.round(result.marginalRate * 100)}%
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Card className="overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Where your pay goes</th>
                <th className="py-2 text-right font-medium">Per paycheck</th>
                <th className="py-2 text-right font-medium">Per year</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-border/60">
                  <td className="py-1.5">{row.label}</td>
                  <td className={cn("py-1.5 text-right tabular-nums", row.kind === "tax" && "text-red-600 dark:text-red-400")}>{money(row.period)}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">{money(row.annual, 0)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2">Net pay</td>
                <td className="py-2 text-right tabular-nums text-primary">{money(p.net)}</td>
                <td className="py-2 text-right tabular-nums">{money(a.net, 0)}</td>
              </tr>
            </tbody>
          </table>
        </Card>
        <Card className="p-4">
          <SvgDonutChart
            segments={[
              { label: "Net pay", value: Math.max(p.net, 0), color: "var(--primary)" },
              { label: "Federal tax", value: p.federal, color: "#dc2626" },
              { label: "Social Security & Medicare", value: p.socialSecurity + p.medicare + p.additionalMedicare, color: "#f97316" },
              { label: "State tax", value: p.state, color: "#8b5cf6" },
              { label: "401(k) & benefits", value: p.retirement + p.benefits, color: "#d97706" },
              { label: "Post-tax deductions", value: p.postTax, color: "#64748b" },
            ]}
          />
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Estimate using {TAX_YEAR} US federal rules (IRS Rev. Proc. 2025-32): standard deduction, progressive brackets, Social Security up to the $184,500 wage base, Medicare and the 0.9% additional Medicare tax above $200,000.
        State tax is a flat rate you choose. W-4 credits, other income, local taxes and your employer&apos;s exact payroll method are not included — your real paycheck can differ.
      </p>

      <Button size="sm" variant="outline" onClick={handleSave}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="paycheck-calculator" />
    </div>
  );
}

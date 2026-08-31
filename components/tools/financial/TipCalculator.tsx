"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    value
  );
}

const TIP_PRESETS = [10, 15, 18, 20, 25];

export default function TipCalculator() {
  useTrackTool("tip-calculator");
  const [bill, setBill] = React.useState(85);
  const [tipPct, setTipPct] = React.useState(18);
  const [people, setPeople] = React.useState(2);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const tipAmount = bill * (tipPct / 100);
  const total = bill + tipAmount;
  const perPerson = people > 0 ? total / people : total;

  const handleSave = async () => {
    await saveToolResult("tip-calculator", {
      title: `Tip: ${formatCurrency(tipAmount)} on ${formatCurrency(bill)}`,
      summary: `${tipPct}% tip, ${people} ${people === 1 ? "person" : "people"}, ${formatCurrency(perPerson)}/person`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Bill amount ($)</span>
            <input
              type="number"
              min={0}
              value={bill}
              onChange={(e) => setBill(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Number of people</span>
            <input
              type="number"
              min={1}
              value={people}
              onChange={(e) => setPeople(Number(e.target.value) || 1)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">Tip percentage</span>
          <div className="flex flex-wrap items-center gap-2">
            {TIP_PRESETS.map((pct) => (
              <button
                key={pct}
                onClick={() => setTipPct(pct)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  tipPct === pct
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary"
                }`}
              >
                {pct}%
              </button>
            ))}
            <input
              type="number"
              min={0}
              max={100}
              value={tipPct}
              onChange={(e) => setTipPct(Number(e.target.value) || 0)}
              className="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Tip amount</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(tipAmount)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Total bill</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(total)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Per person</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{formatCurrency(perPerson)}</p>
        </Card>
      </div>

      <Button size="sm" variant="outline" onClick={handleSave}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="tip-calculator" />
    </div>
  );
}

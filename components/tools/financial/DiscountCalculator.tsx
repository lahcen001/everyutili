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

export default function DiscountCalculator() {
  useTrackTool("discount-calculator");
  const [originalPrice, setOriginalPrice] = React.useState(120);
  const [discountPct, setDiscountPct] = React.useState(25);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const amountSaved = originalPrice * (discountPct / 100);
  const finalPrice = originalPrice - amountSaved;

  const handleSave = async () => {
    await saveToolResult("discount-calculator", {
      title: `Final price: ${formatCurrency(finalPrice)}`,
      summary: `${discountPct}% off ${formatCurrency(originalPrice)}, saved ${formatCurrency(amountSaved)}`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Original price ($)</span>
            <input
              type="number"
              min={0}
              value={originalPrice}
              onChange={(e) => setOriginalPrice(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Discount (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={discountPct}
              onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">You save</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(amountSaved)}
          </p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Final price</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(finalPrice)}</p>
        </Card>
      </div>

      <Button size="sm" variant="outline" onClick={handleSave}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="discount-calculator" />
    </div>
  );
}

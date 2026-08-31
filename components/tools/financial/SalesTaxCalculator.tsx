"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    value
  );
}

export default function SalesTaxCalculator() {
  useTrackTool("sales-tax-calculator");
  const [preTaxPrice, setPreTaxPrice] = React.useState(100);
  const [taxRate, setTaxRate] = React.useState(8.25);

  const [totalPrice, setTotalPrice] = React.useState(108.25);
  const [reverseTaxRate, setReverseTaxRate] = React.useState(8.25);

  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const taxAmount = preTaxPrice * (taxRate / 100);
  const total = preTaxPrice + taxAmount;

  const reversePreTax = totalPrice / (1 + reverseTaxRate / 100);
  const reverseTaxAmount = totalPrice - reversePreTax;

  const saveResult = async (title: string, summary: string) => {
    await saveToolResult("sales-tax-calculator", { title, summary });
    historyRef.current?.refresh();
  };

  const handleSaveForward = () =>
    saveResult(
      `Total: ${formatCurrency(total)}`,
      `${formatCurrency(preTaxPrice)} + ${taxRate}% tax = ${formatCurrency(taxAmount)} tax`
    );
  const handleSaveReverse = () =>
    saveResult(
      `Price before tax: ${formatCurrency(reversePreTax)}`,
      `${formatCurrency(totalPrice)} total at ${reverseTaxRate}% tax = ${formatCurrency(reverseTaxAmount)} tax`
    );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="forward">
        <TabsList>
          <TabsTrigger value="forward">Price → Total</TabsTrigger>
          <TabsTrigger value="reverse">Total → Price</TabsTrigger>
        </TabsList>

        <TabsContent value="forward" className="space-y-6">
          <Card className="space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Price before tax ($)</span>
                <input
                  type="number"
                  min={0}
                  value={preTaxPrice}
                  onChange={(e) => setPreTaxPrice(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Tax rate (%)</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Tax amount</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(taxAmount)}</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Total price</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{formatCurrency(total)}</p>
            </Card>
          </div>
          <Button size="sm" variant="outline" onClick={handleSaveForward}>
            <Save className="h-3.5 w-3.5" /> Save result
          </Button>
        </TabsContent>

        <TabsContent value="reverse" className="space-y-6">
          <Card className="space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Total price paid ($)</span>
                <input
                  type="number"
                  min={0}
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Tax rate (%)</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={reverseTaxRate}
                  onChange={(e) => setReverseTaxRate(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Price before tax</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{formatCurrency(reversePreTax)}</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Tax amount</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(reverseTaxAmount)}</p>
            </Card>
          </div>
          <Button size="sm" variant="outline" onClick={handleSaveReverse}>
            <Save className="h-3.5 w-3.5" /> Save result
          </Button>
        </TabsContent>
      </Tabs>

      <ToolHistoryList ref={historyRef} toolSlug="sales-tax-calculator" />
    </div>
  );
}

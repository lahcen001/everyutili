"use client";

import * as React from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { originalFromSale, percentOff, stackDiscounts } from "@/lib/finance/discount";
import { NumField, money, num } from "@/components/tools/financial/NumField";

export default function DiscountCalculator() {
  useTrackTool("discount-calculator");
  const [price, setPrice] = React.useState("120");
  const [discounts, setDiscounts] = React.useState(["25"]);
  const [taxRate, setTaxRate] = React.useState("0");
  const [orig2, setOrig2] = React.useState("80");
  const [sale2, setSale2] = React.useState("60");
  const [sale3, setSale3] = React.useState("75");
  const [pct3, setPct3] = React.useState("25");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const stack = stackDiscounts(num(price), discounts.map(num));
  const tax = stack.finalPrice * (num(taxRate) / 100);
  const off = percentOff(num(orig2), num(sale2));
  const orig3 = originalFromSale(num(sale3), num(pct3));

  const save = async (title: string, summary: string) => {
    await saveToolResult("discount-calculator", { title, summary });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="price">
        <TabsList className="flex-wrap">
          <TabsTrigger value="price">Final price</TabsTrigger>
          <TabsTrigger value="percent">Find % off</TabsTrigger>
          <TabsTrigger value="original">Find original price</TabsTrigger>
        </TabsList>

        <TabsContent value="price" className="space-y-6">
          <Card className="space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumField label="Original price ($)" value={price} onChange={setPrice} />
              <NumField label="Sales tax after discount (%)" value={taxRate} onChange={setTaxRate} hint="Optional" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Discounts (applied one after another)</p>
              {discounts.map((d, i) => (
                <div key={i} className="flex items-end gap-2">
                  <NumField label={`Discount ${i + 1} (%)`} value={d} onChange={(v) => setDiscounts((prev) => prev.map((x, j) => (j === i ? v : x)))} className="w-40" />
                  <button onClick={() => setDiscounts((prev) => prev.filter((_, j) => j !== i))} disabled={discounts.length <= 1} aria-label="Remove discount" className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setDiscounts((prev) => [...prev, "10"])} disabled={discounts.length >= 5}>
                <Plus className="h-3.5 w-3.5" /> Add another discount
              </Button>
            </div>
            {discounts.some((d) => num(d) > 100) && <p role="alert" className="text-sm text-destructive">A discount above 100% is treated as 100%.</p>}
          </Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">You save</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{money(stack.saved)}</p>
              <p className="text-xs text-muted-foreground">{stack.effectivePercent.toFixed(2)}% off overall</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Final price</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{money(stack.finalPrice)}</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">With tax</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{money(stack.finalPrice + tax)}</p>
              <p className="text-xs text-muted-foreground">{money(tax)} tax</p>
            </Card>
          </div>
          {discounts.length > 1 && (
            <p className="text-center text-xs text-muted-foreground">
              Stacked discounts multiply, so {discounts.map((d) => `${num(d)}%`).join(" then ")} is {stack.effectivePercent.toFixed(2)}% off, not {discounts.reduce((s, d) => s + num(d), 0)}%.
            </p>
          )}
          <Button size="sm" variant="outline" onClick={() => save(`Final price: ${money(stack.finalPrice)}`, `${discounts.map((d) => `${num(d)}%`).join(" + ")} off ${money(num(price))}, saved ${money(stack.saved)}`)}>
            <Save className="h-3.5 w-3.5" /> Save result
          </Button>
        </TabsContent>

        <TabsContent value="percent" className="space-y-6">
          <Card className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumField label="Original price ($)" value={orig2} onChange={setOrig2} />
              <NumField label="Sale price ($)" value={sale2} onChange={setSale2} />
            </div>
          </Card>
          <Card className="p-5 text-center" role="status">
            <p className="text-sm text-muted-foreground">Discount</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{Number.isFinite(off) ? `${off.toFixed(2)}%` : "—"}</p>
            <p className="text-xs text-muted-foreground">{Number.isFinite(off) ? `You save ${money(num(orig2) - num(sale2))}` : "The original price can't be zero."}</p>
          </Card>
          <Button size="sm" variant="outline" disabled={!Number.isFinite(off)} onClick={() => save(`${off.toFixed(2)}% off`, `${money(num(orig2))} → ${money(num(sale2))}`)}>
            <Save className="h-3.5 w-3.5" /> Save result
          </Button>
        </TabsContent>

        <TabsContent value="original" className="space-y-6">
          <Card className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumField label="Sale price ($)" value={sale3} onChange={setSale3} />
              <NumField label="Discount (%)" value={pct3} onChange={setPct3} />
            </div>
          </Card>
          <Card className="p-5 text-center" role="status">
            <p className="text-sm text-muted-foreground">Original price</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{money(orig3)}</p>
            <p className="text-xs text-muted-foreground">{Number.isFinite(orig3) ? `sale price ÷ (1 − ${num(pct3)}%)` : "A 100% discount can't be reversed."}</p>
          </Card>
          <Button size="sm" variant="outline" disabled={!Number.isFinite(orig3)} onClick={() => save(`Original: ${money(orig3)}`, `${money(num(sale3))} after ${num(pct3)}% off`)}>
            <Save className="h-3.5 w-3.5" /> Save result
          </Button>
        </TabsContent>
      </Tabs>

      <ToolHistoryList ref={historyRef} toolSlug="discount-calculator" />
    </div>
  );
}

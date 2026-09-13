"use client";

import * as React from "react";
import { ArrowLeftRight, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

// Fixed rates relative to 1 USD, captured 2026-01-01. This site runs 100%
// client-side with no outbound network calls, so rates here are a snapshot
// for estimates only, not live — flagged clearly in the UI below.
const RATES_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CAD: 1.36,
  AUD: 1.52,
  CHF: 0.88,
  CNY: 7.24,
  INR: 83.1,
  BRL: 4.98,
  MXN: 17.1,
  ZAR: 18.7,
  SEK: 10.4,
  NOK: 10.6,
  SGD: 1.34,
  NZD: 1.64,
  KRW: 1332,
  AED: 3.67,
  RUB: 92.5,
  TRY: 32.1,
};

const CURRENCIES = Object.keys(RATES_TO_USD);
const RATES_AS_OF = "January 2026";

function convert(value: number, from: string, to: string): number {
  const usd = value / RATES_TO_USD[from];
  return usd * RATES_TO_USD[to];
}

export default function CurrencyConverter() {
  useTrackTool("currency-converter");
  const [amount, setAmount] = React.useState(100);
  const [from, setFrom] = React.useState("USD");
  const [to, setTo] = React.useState("EUR");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const result = convert(amount, from, to);
  const rate = convert(1, from, to);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const handleSave = async () => {
    await saveToolResult("currency-converter", {
      title: `${amount} ${from} = ${result.toFixed(2)} ${to}`,
      summary: `1 ${from} = ${rate.toFixed(4)} ${to} (rates as of ${RATES_AS_OF})`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Amount</span>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <button
            onClick={swap}
            aria-label="Swap currencies"
            title="Swap currencies"
            className="mb-0.5 flex h-9 w-9 items-center justify-center justify-self-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>

          <label className="space-y-1.5">
            <span className="text-sm font-medium">Converted</span>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={result.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
              />
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>
      </Card>

      <Card className="p-5 text-center">
        <p className="text-sm text-muted-foreground">Exchange rate</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
          1 {from} = {rate.toLocaleString("en-US", { maximumFractionDigits: 4 })} {to}
        </p>
      </Card>

      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-700 dark:text-amber-400">
        Rates are a fixed snapshot as of {RATES_AS_OF} for estimates only — not live market rates. This
        tool runs entirely in your browser with no network requests.
      </p>

      <Button size="sm" variant="outline" onClick={handleSave}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="currency-converter" />
    </div>
  );
}

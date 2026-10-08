"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { CalcFrame } from "@/components/tools/calc/CalcFrame";
import { Keypad, type KeyDef } from "@/components/tools/calc/Keypad";
import { describe, parseNumbers } from "@/lib/calc/stats";
import { applyKey } from "@/lib/calc/keys";

const fmt = (v: number) => String(Number(v.toPrecision(10)));

export default function StatisticsCalculator() {
  useTrackTool("statistics-calculator");
  const [text, setText] = usePersisted<string>("everyutili_stats_data", "12, 15, 11, 18, 15, 22, 15, 9");
  const [population, setPopulation] = usePersisted<{ on: boolean }>("everyutili_stats_mode", { on: false });
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const press = (key: string) => {
    if (key === "SEP") setText((t) => (t && !/[\s,]$/.test(t) ? t + ", " : t));
    else if (key === "BACK") setText((t) => t.replace(/(, |.)$/, ""));
    else setText((t) => applyKey(t, key, { extra: ", ", maxLength: 4000, negative: true }).replace(/--/g, "-"));
    ref.current?.focus();
  };

  const nums = React.useMemo(() => parseNumbers(text), [text]);
  const stats = React.useMemo(() => (nums.length ? describe(nums, population.on) : null), [nums, population.on]);

  const bins = React.useMemo(() => {
    if (!stats || stats.max === stats.min) return [];
    const n = Math.min(8, Math.max(4, Math.round(Math.sqrt(nums.length))));
    const w = (stats.max - stats.min) / n;
    const counts = Array<number>(n).fill(0);
    for (const v of nums) counts[Math.min(n - 1, Math.floor((v - stats.min) / w))] += 1;
    return counts.map((c, i) => ({ c, from: stats.min + i * w, to: stats.min + (i + 1) * w }));
  }, [stats, nums]);
  const binMax = Math.max(1, ...bins.map((b) => b.c));

  const rows: KeyDef[][] = [
    [{ label: "7" }, { label: "8" }, { label: "9" }, { label: "⌫", value: "BACK", kind: "act", aria: "Backspace" }],
    [{ label: "4" }, { label: "5" }, { label: "6" }, { label: "C", kind: "act", aria: "Clear all" }],
    [{ label: "1" }, { label: "2" }, { label: "3" }, { label: "−", value: "-", kind: "fn", aria: "Minus" }],
    [{ label: "0" }, { label: "." }, { label: "Add ,", value: "SEP", kind: "op", span: 2, aria: "Add separator" }],
  ];

  const cards: [string, string][] = stats
    ? [
        ["Count", String(stats.count)], ["Sum", fmt(stats.sum)], ["Mean", fmt(stats.mean)], ["Median", fmt(stats.median)],
        ["Mode", stats.modes.length ? stats.modes.map(fmt).join(", ") : "none"], ["Min", fmt(stats.min)], ["Max", fmt(stats.max)], ["Range", fmt(stats.range)],
        ["Q1", fmt(stats.q1)], ["Q3", fmt(stats.q3)], ["IQR", fmt(stats.iqr)], [population.on ? "Variance (σ²)" : "Variance (s²)", fmt(stats.variance)],
        [population.on ? "Std dev (σ)" : "Std dev (s)", fmt(stats.stdDev)], ["Sum of squares", fmt(stats.sumSquares)], ["Geometric mean", stats.geometricMean === null ? "n/a" : fmt(stats.geometricMean)], ["Outliers", stats.outliers.length ? stats.outliers.map(fmt).join(", ") : "none"],
      ]
    : [];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
      <div className="space-y-4">
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="stats-data" className="text-sm font-semibold">Your numbers</label>
            <div className="ms-auto flex rounded-full bg-muted p-1" role="tablist" aria-label="Sample or population">
              {[{ on: false, label: "Sample (n−1)" }, { on: true, label: "Population (n)" }].map((m) => (
                <button key={String(m.on)} role="tab" aria-selected={population.on === m.on} onClick={() => setPopulation({ on: m.on })} className={cn("rounded-full px-3 py-1 text-xs font-semibold", population.on === m.on ? "bg-background shadow-sm" : "text-muted-foreground")}>{m.label}</button>
              ))}
            </div>
          </div>
          <textarea id="stats-data" ref={ref} value={text} onChange={(e) => setText(e.target.value)} inputMode="none" rows={4} placeholder="Type or paste numbers separated by commas, spaces or new lines" className="w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-primary" />
          <p className="text-xs text-muted-foreground">{nums.length} number{nums.length === 1 ? "" : "s"} read. Saved on this device.</p>
        </Card>
        {stats ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-live="polite">
              {cards.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="truncate font-mono text-lg font-extrabold" title={value}>{value}</p>
                </div>
              ))}
            </div>
            {bins.length > 0 && (
              <Card className="space-y-2 p-4">
                <h3 className="text-sm font-semibold">Distribution</h3>
                <div className="flex h-32 items-end gap-1.5">
                  {bins.map((b, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${fmt(b.from)} – ${fmt(b.to)}: ${b.c}`}>
                      <span className="text-[10px] font-semibold tabular-nums">{b.c}</span>
                      <div className="w-full rounded-t-md bg-primary/70" style={{ height: `${(b.c / binMax) * 100}%`, minHeight: b.c ? 4 : 0 }} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground"><span>{fmt(stats.min)}</span><span>{fmt(stats.max)}</span></div>
              </Card>
            )}
          </>
        ) : (
          <Card className="p-8 text-center text-sm text-muted-foreground">Enter some numbers to see the statistics.</Card>
        )}
      </div>
      <CalcFrame className="lg:self-start"><Keypad rows={rows} cols={4} onPress={press} /></CalcFrame>
    </div>
  );
}

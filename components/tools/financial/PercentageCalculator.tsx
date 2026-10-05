"use client";

import * as React from "react";
import { Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { beforeChange, decreaseBy, findWhole, formatNumber, increaseBy, parseNumber, percentChange, percentOf, whatPercent } from "@/lib/finance/percent";
import { cn } from "@/lib/utils";

function Field({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-32 rounded-lg border border-border bg-background px-3 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function Result({ value, suffix = "", signed = false, note }: { value: number; suffix?: string; signed?: boolean; note?: string }) {
  const undefinedResult = !Number.isFinite(value);
  return (
    <div role="status" className="space-y-1">
      <p className={cn("text-3xl font-bold tabular-nums", signed && !undefinedResult && (value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"))}>
        {undefinedResult ? "—" : `${signed && value > 0 ? "+" : ""}${formatNumber(value)}${suffix}`}
      </p>
      <p className="text-xs text-muted-foreground">{undefinedResult ? "Not defined for these numbers (it would need a division by zero) — check the inputs." : note}</p>
    </div>
  );
}

function SaveButton({ result, onSave }: { result: number; onSave: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onSave} disabled={!Number.isFinite(result)}>
      <Save className="h-3.5 w-3.5" /> Save result
    </Button>
  );
}

function Direction({ value, onChange }: { value: "increase" | "decrease"; onChange: (v: "increase" | "decrease") => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border text-sm" role="group" aria-label="Direction">
      {(["increase", "decrease"] as const).map((d) => (
        <button key={d} onClick={() => onChange(d)} aria-pressed={value === d} className={cn("px-3 py-1.5 font-medium capitalize transition-colors", value === d ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
          {d}
        </button>
      ))}
    </div>
  );
}

export default function PercentageCalculator() {
  useTrackTool("percentage-calculator");
  const [f, setF] = React.useState({ a1: "20", b1: "150", a2: "30", b2: "120", from: "80", to: "100", v4: "100", p4: "20", part5: "30", p5: "20", res6: "120", p6: "20" });
  const [dir4, setDir4] = React.useState<"increase" | "decrease">("increase");
  const [dir6, setDir6] = React.useState<"increase" | "decrease">("increase");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const set = (key: keyof typeof f) => (v: string) => setF((prev) => ({ ...prev, [key]: v }));
  const n = (key: keyof typeof f) => parseNumber(f[key]);

  const r1 = percentOf(n("a1"), n("b1"));
  const r2 = whatPercent(n("a2"), n("b2"));
  const r3 = percentChange(n("from"), n("to"));
  const r4 = dir4 === "increase" ? increaseBy(n("v4"), n("p4")) : decreaseBy(n("v4"), n("p4"));
  const r5 = findWhole(n("part5"), n("p5"));
  const r6 = beforeChange(n("res6"), n("p6"), dir6);

  const save = async (title: string, summary: string) => {
    await saveToolResult("percentage-calculator", { title, summary });
    historyRef.current?.refresh();
  };
  return (
    <div className="space-y-6">
      <Tabs defaultValue="of">
        <TabsList className="flex-wrap">
          <TabsTrigger value="of">X% of Y</TabsTrigger>
          <TabsTrigger value="is">X is what % of Y</TabsTrigger>
          <TabsTrigger value="change">% change</TabsTrigger>
          <TabsTrigger value="adjust">Increase / decrease</TabsTrigger>
          <TabsTrigger value="whole">X is P% of what</TabsTrigger>
          <TabsTrigger value="before">Before a change</TabsTrigger>
        </TabsList>

        <TabsContent value="of">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Percent" value={f.a1} onChange={set("a1")} suffix="%" />
              <Field label="of" value={f.b1} onChange={set("b1")} />
            </div>
            <Result value={r1} note={`${formatNumber(n("a1"))}% × ${formatNumber(n("b1"))} ÷ 100`} />
            <SaveButton result={r1} onSave={() => save(`${f.a1}% of ${f.b1} = ${formatNumber(r1)}`, "X% of Y")} />
          </Card>
        </TabsContent>

        <TabsContent value="is">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Number" value={f.a2} onChange={set("a2")} />
              <Field label="is what percent of" value={f.b2} onChange={set("b2")} />
            </div>
            <Result value={r2} suffix="%" note={`${formatNumber(n("a2"))} ÷ ${formatNumber(n("b2"))} × 100`} />
            <SaveButton result={r2} onSave={() => save(`${f.a2} is ${formatNumber(r2)}% of ${f.b2}`, "X is what % of Y")} />
          </Card>
        </TabsContent>

        <TabsContent value="change">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="From" value={f.from} onChange={set("from")} />
              <Field label="To" value={f.to} onChange={set("to")} />
            </div>
            <Result value={r3} suffix="%" signed note="(new − old) ÷ |old| × 100. A change from zero has no percentage." />
            <SaveButton result={r3} onSave={() => save(`${f.from} → ${f.to}: ${formatNumber(r3)}%`, "% change")} />
          </Card>
        </TabsContent>

        <TabsContent value="adjust">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Start with" value={f.v4} onChange={set("v4")} />
              <Direction value={dir4} onChange={setDir4} />
              <Field label="by" value={f.p4} onChange={set("p4")} suffix="%" />
            </div>
            <Result value={r4} note={`${formatNumber(n("v4"))} ${dir4 === "increase" ? "×" : "×"} ${formatNumber(dir4 === "increase" ? 1 + n("p4") / 100 : 1 - n("p4") / 100, 6)}`} />
            <SaveButton result={r4} onSave={() => save(`${f.v4} ${dir4}d by ${f.p4}% = ${formatNumber(r4)}`, "Increase / decrease")} />
          </Card>
        </TabsContent>

        <TabsContent value="whole">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Number" value={f.part5} onChange={set("part5")} />
              <Field label="is" value={f.p5} onChange={set("p5")} suffix="% of what?" />
            </div>
            <Result value={r5} note="number ÷ (percent ÷ 100)" />
            <SaveButton result={r5} onSave={() => save(`${f.part5} is ${f.p5}% of ${formatNumber(r5)}`, "X is P% of what")} />
          </Card>
        </TabsContent>

        <TabsContent value="before">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="After the change it is" value={f.res6} onChange={set("res6")} />
              <Field label="following a" value={f.p6} onChange={set("p6")} suffix="%" />
              <Direction value={dir6} onChange={setDir6} />
            </div>
            <Result value={r6} note="Original value = result ÷ (1 ± percent ÷ 100). Note that +20% then −20% does not get you back to the start." />
            <SaveButton result={r6} onSave={() => save(`Before a ${f.p6}% ${dir6}: ${formatNumber(r6)}`, "Original value")} />
          </Card>
        </TabsContent>
      </Tabs>

      <ToolHistoryList ref={historyRef} toolSlug="percentage-calculator" />
    </div>
  );
}

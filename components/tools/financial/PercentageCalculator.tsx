"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export default function PercentageCalculator() {
  useTrackTool("percentage-calculator");

  const [x1, setX1] = React.useState(20);
  const [y1, setY1] = React.useState(150);

  const [x2, setX2] = React.useState(30);
  const [y2, setY2] = React.useState(120);

  const [from, setFrom] = React.useState(80);
  const [to, setTo] = React.useState(100);

  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const xOfY = (x1 / 100) * y1;
  const xIsWhatPercentOfY = y2 !== 0 ? (x2 / y2) * 100 : 0;
  const percentChange = from !== 0 ? ((to - from) / Math.abs(from)) * 100 : 0;

  const saveResult = async (title: string, summary: string) => {
    await saveToolResult("percentage-calculator", { title, summary });
    historyRef.current?.refresh();
  };

  const handleSaveOf = () => saveResult(`${x1}% of ${y1} = ${formatNumber(xOfY)}`, "X% of Y");
  const handleSaveIs = () =>
    saveResult(`${x2} is ${formatNumber(xIsWhatPercentOfY)}% of ${y2}`, "X is what % of Y");
  const handleSaveChange = () =>
    saveResult(
      `${from} → ${to}: ${percentChange >= 0 ? "+" : ""}${formatNumber(percentChange)}%`,
      "% change"
    );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="of">
        <TabsList>
          <TabsTrigger value="of">X% of Y</TabsTrigger>
          <TabsTrigger value="is">X is what % of Y</TabsTrigger>
          <TabsTrigger value="change">% change</TabsTrigger>
        </TabsList>

        <TabsContent value="of">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <input
                type="number"
                value={x1}
                onChange={(e) => setX1(Number(e.target.value) || 0)}
                className="w-24 rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span>% of</span>
              <input
                type="number"
                value={y1}
                onChange={(e) => setY1(Number(e.target.value) || 0)}
                className="w-28 rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span>=</span>
              <span className="text-lg font-bold tabular-nums">{formatNumber(xOfY)}</span>
            </div>
            <Button size="sm" variant="outline" onClick={handleSaveOf}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="is">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <input
                type="number"
                value={x2}
                onChange={(e) => setX2(Number(e.target.value) || 0)}
                className="w-24 rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span>is what % of</span>
              <input
                type="number"
                value={y2}
                onChange={(e) => setY2(Number(e.target.value) || 0)}
                className="w-28 rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span>=</span>
              <span className="text-lg font-bold tabular-nums">{formatNumber(xIsWhatPercentOfY)}%</span>
            </div>
            <Button size="sm" variant="outline" onClick={handleSaveIs}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="change">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>From</span>
              <input
                type="number"
                value={from}
                onChange={(e) => setFrom(Number(e.target.value) || 0)}
                className="w-28 rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span>to</span>
              <input
                type="number"
                value={to}
                onChange={(e) => setTo(Number(e.target.value) || 0)}
                className="w-28 rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span>=</span>
              <span
                className={`text-lg font-bold tabular-nums ${
                  percentChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                }`}
              >
                {percentChange >= 0 ? "+" : ""}
                {formatNumber(percentChange)}%
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={handleSaveChange}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      <ToolHistoryList ref={historyRef} toolSlug="percentage-calculator" />
    </div>
  );
}

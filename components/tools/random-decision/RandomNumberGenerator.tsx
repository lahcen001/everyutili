"use client";

import * as React from "react";
import { Dices, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RandomStage, type Reveal } from "@/components/tools/random-decision/RandomStage";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

function generateNumbers(min: number, max: number, count: number, allowDuplicates: boolean): number[] {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const rangeSize = hi - lo + 1;

  if (!allowDuplicates && count <= rangeSize) {
    const pool = Array.from({ length: rangeSize }, (_, i) => lo + i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  return Array.from({ length: count }, () => lo + Math.floor(Math.random() * rangeSize));
}

export default function RandomNumberGenerator() {
  useTrackTool("random-number-generator");
  const [min, setMin] = React.useState(1);
  const [max, setMax] = React.useState(100);
  const [count, setCount] = React.useState(1);
  const [allowDuplicates, setAllowDuplicates] = React.useState(true);
  const [results, setResults] = React.useState<number[]>([]);
  const [reveal, setReveal] = React.useState<Reveal | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const rangeSize = Math.abs(max - min) + 1;
  const tooFewForUnique = !allowDuplicates && count > rangeSize;

  const generate = () => {
    const nums = generateNumbers(min, max, count, allowDuplicates);
    setResults(nums);
    setReveal({
      id: Date.now(),
      items: nums.slice(0, 24).map(String),
      label: nums.length === 1 ? "Your number" : `${nums.length} numbers`,
      sub: nums.length > 24 ? `+${nums.length - 24} more in the list` : `Range ${Math.min(min, max)}–${Math.max(min, max)}`,
      icon: <Dices />,
    });
  };

  const handleSave = async () => {
    if (results.length === 0) return;
    await saveToolResult("random-number-generator", {
      title: results.length === 1 ? `${results[0]}` : `${results.length} numbers`,
      summary: `Range ${Math.min(min, max)}–${Math.max(min, max)}: ${results.join(", ")}`,
      data: results.join(", "),
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Minimum</span>
            <input
              type="number"
              value={min}
              onChange={(e) => setMin(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Maximum</span>
            <input
              type="number"
              value={max}
              onChange={(e) => setMax(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">How many numbers</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={(e) => setCount(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))}
            className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowDuplicates}
            onChange={(e) => setAllowDuplicates(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          Allow duplicate numbers
        </label>

        {tooFewForUnique && (
          <p className="text-xs text-destructive">
            The range only has {rangeSize} possible number{rangeSize === 1 ? "" : "s"} — reduce the
            count or allow duplicates.
          </p>
        )}

        <Button onClick={generate} disabled={tooFewForUnique}>
          <Dices className="h-4 w-4" />
          Generate
        </Button>
      </Card>

      <RandomStage reveal={reveal} onAgain={tooFewForUnique ? undefined : generate} againLabel="Generate again" onSave={handleSave}>
        {(isFs) => (
          <div className="w-full space-y-4 p-6">
            {results.length > 0 ? (
              <>
                <div className="flex flex-wrap justify-center gap-2">
                  {results.map((n, i) => (
                    <span
                      key={i}
                      className={
                        isFs
                          ? "flex h-20 min-w-20 items-center justify-center rounded-2xl border-2 border-primary bg-primary/10 px-5 text-4xl font-extrabold text-primary"
                          : "flex h-12 min-w-12 items-center justify-center rounded-xl border border-primary bg-primary/10 px-3 text-lg font-bold text-primary"
                      }
                    >
                      {n}
                    </span>
                  ))}
                </div>
                <div className="flex justify-center gap-2">
                  <CopyButton value={results.join(", ")} size="sm" variant="outline" />
                  <Button size="sm" variant="outline" onClick={handleSave}>
                    <Save className="h-3.5 w-3.5" />
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-center text-sm text-muted-foreground">Press Generate to see your numbers here.</p>
            )}
          </div>
        )}
      </RandomStage>

      <ToolHistoryList ref={historyRef} toolSlug="random-number-generator" />
    </div>
  );
}

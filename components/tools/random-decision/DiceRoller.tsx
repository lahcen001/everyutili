"use client";

import * as React from "react";
import { Dices, Save, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const DIE_SIZES = [4, 6, 8, 10, 12, 20] as const;
type DieSize = (typeof DIE_SIZES)[number];

interface Roll {
  values: number[];
  total: number;
  sides: DieSize;
}

export default function DiceRoller() {
  useTrackTool("dice-roller");
  const [sides, setSides] = React.useState<DieSize>(6);
  const [count, setCount] = React.useState(2);
  const [rolling, setRolling] = React.useState(false);
  const [current, setCurrent] = React.useState<Roll | null>(null);
  const [rolls, setRolls] = React.useState<Roll[]>([]);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    window.setTimeout(() => {
      const values = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
      const result: Roll = { values, total: values.reduce((a, b) => a + b, 0), sides };
      setCurrent(result);
      setRolls((prev) => [result, ...prev].slice(0, 20));
      setRolling(false);
    }, 400);
  };

  const handleSave = async () => {
    if (!current) return;
    await saveToolResult("dice-roller", {
      title: `${count}d${sides}: ${current.values.join(", ")}`,
      summary: `Total: ${current.total}`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Die size</span>
            <div className="flex overflow-hidden rounded-lg border border-border">
              {DIE_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSides(size)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium transition-colors",
                    sides === size ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                >
                  d{size}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">Number of dice</span>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
              className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap justify-center gap-3 rounded-lg border border-border bg-muted/20 p-6">
          {current ? (
            current.values.map((v, i) => (
              <div
                key={i}
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-lg border-2 border-primary bg-background text-xl font-bold text-primary shadow-sm transition-transform",
                  rolling && "animate-bounce"
                )}
              >
                {v}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Roll to see your results</p>
          )}
        </div>

        {current && (
          <p className="text-center text-sm font-medium">
            Total: <span className="text-lg text-primary">{current.total}</span>
          </p>
        )}

        <div className="flex justify-center gap-2">
          <Button onClick={roll} disabled={rolling}>
            <Dices className="h-4 w-4" />
            {rolling ? "Rolling…" : `Roll ${count}d${sides}`}
          </Button>
          {current && (
            <Button variant="outline" onClick={handleSave}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          )}
        </div>
      </Card>

      {rolls.length > 0 && (
        <Card className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Recent rolls</p>
            <button
              type="button"
              onClick={() => setRolls([])}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {rolls.map((r, i) => (
              <li key={i}>
                {r.values.length}d{r.sides}: {r.values.join(", ")} — total {r.total}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="dice-roller" />
    </div>
  );
}

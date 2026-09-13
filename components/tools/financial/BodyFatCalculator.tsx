"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

type Sex = "male" | "female";

// U.S. Navy circumference method, in inches — log10-based formula.
function computeBodyFat(sex: Sex, heightIn: number, neckIn: number, waistIn: number, hipIn: number): number | null {
  if (heightIn <= 0 || neckIn <= 0 || waistIn <= 0) return null;
  if (sex === "male") {
    const diff = waistIn - neckIn;
    if (diff <= 0) return null;
    return 86.01 * Math.log10(diff) - 70.041 * Math.log10(heightIn) + 36.76;
  }
  if (hipIn <= 0) return null;
  const diff = waistIn + hipIn - neckIn;
  if (diff <= 0) return null;
  return 163.205 * Math.log10(diff) - 97.684 * Math.log10(heightIn) - 78.387;
}

function category(sex: Sex, bodyFat: number): { label: string; variant: "success" | "default" | "outline" } {
  const ranges = sex === "male"
    ? [
        { max: 6, label: "Essential fat", variant: "outline" as const },
        { max: 14, label: "Athletic", variant: "success" as const },
        { max: 18, label: "Fitness", variant: "success" as const },
        { max: 25, label: "Average", variant: "default" as const },
        { max: Infinity, label: "Above average", variant: "default" as const },
      ]
    : [
        { max: 14, label: "Essential fat", variant: "outline" as const },
        { max: 21, label: "Athletic", variant: "success" as const },
        { max: 25, label: "Fitness", variant: "success" as const },
        { max: 32, label: "Average", variant: "default" as const },
        { max: Infinity, label: "Above average", variant: "default" as const },
      ];
  return ranges.find((r) => bodyFat <= r.max) ?? ranges[ranges.length - 1];
}

export default function BodyFatCalculator() {
  useTrackTool("body-fat-calculator");
  const [sex, setSex] = React.useState<Sex>("male");
  const [heightIn, setHeightIn] = React.useState(70);
  const [neckIn, setNeckIn] = React.useState(15);
  const [waistIn, setWaistIn] = React.useState(34);
  const [hipIn, setHipIn] = React.useState(40);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const bodyFat = React.useMemo(
    () => computeBodyFat(sex, heightIn, neckIn, waistIn, hipIn),
    [sex, heightIn, neckIn, waistIn, hipIn]
  );

  const handleSave = async () => {
    if (bodyFat === null) return;
    const cat = category(sex, bodyFat);
    await saveToolResult("body-fat-calculator", {
      title: `Body fat: ${bodyFat.toFixed(1)}% (${cat.label})`,
      summary: `${sex === "male" ? "Male" : "Female"}, height ${heightIn}in, waist ${waistIn}in`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="flex overflow-hidden rounded-lg border border-border w-fit">
          <button
            onClick={() => setSex("male")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              sex === "male" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Male
          </button>
          <button
            onClick={() => setSex("female")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              sex === "female" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Female
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Height (in)</span>
            <input
              type="number"
              min={0}
              value={heightIn}
              onChange={(e) => setHeightIn(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Neck (in)</span>
            <input
              type="number"
              min={0}
              value={neckIn}
              onChange={(e) => setNeckIn(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Waist (in)</span>
            <input
              type="number"
              min={0}
              value={waistIn}
              onChange={(e) => setWaistIn(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          {sex === "female" && (
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Hip (in)</span>
              <input
                type="number"
                min={0}
                value={hipIn}
                onChange={(e) => setHipIn(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          )}
        </div>
      </Card>

      {bodyFat !== null ? (
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">Estimated body fat</p>
          <p className="text-4xl font-extrabold tabular-nums">{bodyFat.toFixed(1)}%</p>
          <Badge variant={category(sex, bodyFat).variant}>{category(sex, bodyFat).label}</Badge>
          <Button size="sm" variant="outline" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" /> Save result
          </Button>
        </Card>
      ) : (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Enter valid measurements — waist must be greater than neck (plus hip for female).
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Estimated using the U.S. Navy circumference method — for reference only, not a medical
        measurement.
      </p>

      <ToolHistoryList ref={historyRef} toolSlug="body-fat-calculator" />
    </div>
  );
}

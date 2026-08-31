"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

type Unit = "metric" | "imperial";

function bmiCategory(bmi: number): { label: string; variant: "success" | "default" | "outline" } {
  if (bmi < 18.5) return { label: "Underweight", variant: "outline" };
  if (bmi < 25) return { label: "Healthy weight", variant: "success" };
  if (bmi < 30) return { label: "Overweight", variant: "default" };
  return { label: "Obese", variant: "default" };
}

export default function BmiCalculator() {
  useTrackTool("bmi-calculator");
  const [unit, setUnit] = React.useState<Unit>("metric");
  const [heightCm, setHeightCm] = React.useState(175);
  const [weightKg, setWeightKg] = React.useState(70);
  const [heightFt, setHeightFt] = React.useState(5);
  const [heightIn, setHeightIn] = React.useState(9);
  const [weightLb, setWeightLb] = React.useState(154);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const bmi = React.useMemo(() => {
    if (unit === "metric") {
      const heightM = heightCm / 100;
      if (heightM <= 0) return 0;
      return weightKg / (heightM * heightM);
    }
    const totalInches = heightFt * 12 + heightIn;
    if (totalInches <= 0) return 0;
    return (weightLb / (totalInches * totalInches)) * 703;
  }, [unit, heightCm, weightKg, heightFt, heightIn, weightLb]);

  const category = bmiCategory(bmi);

  const handleSave = async () => {
    if (bmi <= 0) return;
    await saveToolResult("bmi-calculator", {
      title: `BMI: ${bmi.toFixed(1)} (${category.label})`,
      summary:
        unit === "metric"
          ? `${heightCm} cm, ${weightKg} kg`
          : `${heightFt} ft ${heightIn} in, ${weightLb} lb`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="flex overflow-hidden rounded-lg border border-border w-fit">
          <button
            onClick={() => setUnit("metric")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              unit === "metric" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Metric
          </button>
          <button
            onClick={() => setUnit("imperial")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              unit === "imperial" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Imperial
          </button>
        </div>

        {unit === "metric" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Height (cm)</span>
              <input
                type="number"
                min={0}
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Weight (kg)</span>
              <input
                type="number"
                min={0}
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Height (ft)</span>
              <input
                type="number"
                min={0}
                value={heightFt}
                onChange={(e) => setHeightFt(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Height (in)</span>
              <input
                type="number"
                min={0}
                max={11}
                value={heightIn}
                onChange={(e) => setHeightIn(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Weight (lb)</span>
              <input
                type="number"
                min={0}
                value={weightLb}
                onChange={(e) => setWeightLb(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </div>
        )}
      </Card>

      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">Your BMI</p>
        <p className="text-4xl font-extrabold tabular-nums">{bmi > 0 ? bmi.toFixed(1) : "—"}</p>
        <Badge variant={category.variant}>{category.label}</Badge>
        <Button size="sm" variant="outline" onClick={handleSave} disabled={bmi <= 0}>
          <Save className="h-3.5 w-3.5" /> Save result
        </Button>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="bmi-calculator" />
    </div>
  );
}

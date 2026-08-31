"use client";

import * as React from "react";
import { Proportions, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

type TargetField = "width" | "height";

interface Preset {
  label: string;
  width: number;
  height: number;
}

const PRESETS: Preset[] = [
  { label: "16:9", width: 16, height: 9 },
  { label: "4:3", width: 4, height: 3 },
  { label: "1:1", width: 1, height: 1 },
  { label: "21:9", width: 21, height: 9 },
  { label: "9:16", width: 9, height: 16 },
  { label: "3:2", width: 3, height: 2 },
];

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

function simplifiedRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return "—";
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function formatDimension(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function AspectRatioCalculator() {
  useTrackTool("aspect-ratio-calculator");
  const [originalWidth, setOriginalWidth] = React.useState(1920);
  const [originalHeight, setOriginalHeight] = React.useState(1080);
  const [targetField, setTargetField] = React.useState<TargetField>("width");
  const [targetWidth, setTargetWidth] = React.useState(1280);
  const [targetHeight, setTargetHeight] = React.useState(720);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const ratio = React.useMemo(
    () => simplifiedRatio(originalWidth, originalHeight),
    [originalWidth, originalHeight]
  );

  const computedHeight = React.useMemo(() => {
    if (originalWidth <= 0 || originalHeight <= 0) return 0;
    return (targetWidth * originalHeight) / originalWidth;
  }, [originalWidth, originalHeight, targetWidth]);

  const computedWidth = React.useMemo(() => {
    if (originalWidth <= 0 || originalHeight <= 0) return 0;
    return (targetHeight * originalWidth) / originalHeight;
  }, [originalWidth, originalHeight, targetHeight]);

  const resultWidth = targetField === "width" ? targetWidth : computedWidth;
  const resultHeight = targetField === "height" ? targetHeight : computedHeight;

  const applyPreset = (preset: Preset) => {
    setOriginalWidth(preset.width);
    setOriginalHeight(preset.height);
  };

  const handleSave = async () => {
    if (originalWidth <= 0 || originalHeight <= 0) return;
    await saveToolResult("aspect-ratio-calculator", {
      title: `${originalWidth}x${originalHeight} (${ratio})`,
      summary: `Scaled to ${formatDimension(resultWidth)}x${formatDimension(resultHeight)}`,
      data: JSON.stringify(
        {
          originalWidth,
          originalHeight,
          ratio,
          targetField,
          resultWidth,
          resultHeight,
        },
        null,
        2
      ),
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <p className="text-sm font-medium">Original size</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Width</span>
            <input
              type="number"
              min={0}
              value={originalWidth}
              onChange={(e) => setOriginalWidth(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Height</span>
            <input
              type="number"
              min={0}
              value={originalHeight}
              onChange={(e) => setOriginalHeight(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <p className="text-sm font-medium">Scale to</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-medium">
              <input
                type="radio"
                name="target-field"
                checked={targetField === "width"}
                onChange={() => setTargetField("width")}
              />
              Target width
            </span>
            <input
              type="number"
              min={0}
              value={targetWidth}
              onChange={(e) => {
                setTargetWidth(Number(e.target.value) || 0);
                setTargetField("width");
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-medium">
              <input
                type="radio"
                name="target-field"
                checked={targetField === "height"}
                onChange={() => setTargetField("height")}
              />
              Target height
            </span>
            <input
              type="number"
              min={0}
              value={targetHeight}
              onChange={(e) => {
                setTargetHeight(Number(e.target.value) || 0);
                setTargetField("height");
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>
      </Card>

      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <Proportions className="h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">Simplified ratio</p>
        <p className="text-3xl font-extrabold tabular-nums">{ratio}</p>
        <p className="text-sm text-muted-foreground">Computed size</p>
        <p className="text-2xl font-bold tabular-nums">
          {formatDimension(resultWidth)} <span className="text-base font-medium text-muted-foreground">x</span>{" "}
          {formatDimension(resultHeight)}
        </p>
        <Button size="sm" variant="outline" onClick={handleSave} disabled={originalWidth <= 0 || originalHeight <= 0}>
          <Save className="h-3.5 w-3.5" /> Save result
        </Button>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="aspect-ratio-calculator" />
    </div>
  );
}

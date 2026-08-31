"use client";

import * as React from "react";
import { Contrast, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const HEX_SHORTHAND_PATTERN = /^#?([0-9a-f]{3})$/i;
const HEX_FULL_PATTERN = /^#?([0-9a-f]{6})$/i;

function normalizeHex(value: string): string | null {
  const shorthand = HEX_SHORTHAND_PATTERN.exec(value);
  if (shorthand) {
    const [r, g, b] = shorthand[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const full = HEX_FULL_PATTERN.exec(value);
  if (full) {
    return `#${full[1]}`.toLowerCase();
  }
  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return { r, g, b };
}

// WCAG 2.x relative luminance formula: each sRGB channel is gamma-corrected
// before being weighted by human luminance perception (0.2126/0.7152/0.0722).
function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(hex1: string, hex2: string): number | null {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  if (l1 === null || l2 === null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

interface Threshold {
  label: string;
  minRatio: number;
}

const THRESHOLDS: Threshold[] = [
  { label: "AA Normal Text", minRatio: 4.5 },
  { label: "AA Large Text", minRatio: 3 },
  { label: "AAA Normal Text", minRatio: 7 },
  { label: "AAA Large Text", minRatio: 4.5 },
];

interface SavedColors {
  fg: string;
  bg: string;
}

export default function WcagContrastChecker() {
  useTrackTool("wcag-contrast-checker");
  const [fg, setFg] = React.useState("#000000");
  const [bg, setBg] = React.useState("#ffffff");
  const [fgInput, setFgInput] = React.useState("#000000");
  const [bgInput, setBgInput] = React.useState("#ffffff");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const ratio = React.useMemo(() => getContrastRatio(fg, bg), [fg, bg]);

  const handleFgTextChange = (value: string) => {
    setFgInput(value);
    const normalized = normalizeHex(value);
    if (normalized) setFg(normalized);
  };

  const handleBgTextChange = (value: string) => {
    setBgInput(value);
    const normalized = normalizeHex(value);
    if (normalized) setBg(normalized);
  };

  const handleFgPickerChange = (value: string) => {
    setFg(value);
    setFgInput(value);
  };

  const handleBgPickerChange = (value: string) => {
    setBg(value);
    setBgInput(value);
  };

  const handleSave = async () => {
    if (ratio === null) return;
    const savedColors: SavedColors = { fg, bg };
    await saveToolResult("wcag-contrast-checker", {
      title: `${ratio.toFixed(2)}:1 contrast`,
      summary: `${fg} on ${bg}`,
      data: JSON.stringify(savedColors),
    });
    historyRef.current?.refresh();
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (!item.data) return;
    try {
      const parsed = JSON.parse(item.data) as SavedColors;
      const normalizedFg = normalizeHex(parsed.fg);
      const normalizedBg = normalizeHex(parsed.bg);
      if (normalizedFg) {
        setFg(normalizedFg);
        setFgInput(normalizedFg);
      }
      if (normalizedBg) {
        setBg(normalizedBg);
        setBgInput(normalizedBg);
      }
    } catch {
      // Ignore malformed stored data.
    }
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Foreground (text) color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={fg}
                onChange={(e) => handleFgPickerChange(e.target.value)}
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-1"
                aria-label="Foreground color picker"
              />
              <input
                type="text"
                value={fgInput}
                onChange={(e) => handleFgTextChange(e.target.value)}
                placeholder="#000000"
                className="w-full rounded-lg border border-border bg-background p-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Background color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bg}
                onChange={(e) => handleBgPickerChange(e.target.value)}
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-1"
                aria-label="Background color picker"
              />
              <input
                type="text"
                value={bgInput}
                onChange={(e) => handleBgTextChange(e.target.value)}
                placeholder="#ffffff"
                className="w-full rounded-lg border border-border bg-background p-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </label>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Contrast className="h-4 w-4 text-muted-foreground" /> Contrast ratio
          </p>
          <Button size="sm" onClick={handleSave} disabled={ratio === null}>
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>

        <p className="text-3xl font-semibold">
          {ratio !== null ? `${ratio.toFixed(2)}:1` : "Invalid color"}
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {THRESHOLDS.map((threshold) => {
            const passes = ratio !== null && ratio >= threshold.minRatio;
            return (
              <div
                key={threshold.label}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{threshold.label}</p>
                  <p className="text-xs text-muted-foreground">Min {threshold.minRatio}:1</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    ratio === null
                      ? "bg-muted text-muted-foreground"
                      : passes
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {ratio === null ? "N/A" : passes ? "Pass" : "Fail"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <p className="text-sm font-medium">Live preview</p>
        <div
          className="space-y-3 rounded-lg border border-border p-6"
          style={{ backgroundColor: bg, color: fg }}
        >
          <p className="text-base">The quick brown fox jumps over the lazy dog</p>
          <p className="text-2xl font-bold">The quick brown fox jumps over the lazy dog</p>
        </div>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="wcag-contrast-checker" onRestore={restoreResult} />
    </div>
  );
}

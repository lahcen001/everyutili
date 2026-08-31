"use client";

import * as React from "react";
import { ArrowLeftRight, Ruler, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

type Category = "length" | "weight" | "temperature";

const LENGTH_UNITS = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
} as const;

const WEIGHT_UNITS = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
} as const;

type LengthUnit = keyof typeof LENGTH_UNITS;
type WeightUnit = keyof typeof WEIGHT_UNITS;
type TemperatureUnit = "celsius" | "fahrenheit" | "kelvin";

const TEMPERATURE_LABELS: Record<TemperatureUnit, string> = {
  celsius: "°C",
  fahrenheit: "°F",
  kelvin: "K",
};

function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  return (value * LENGTH_UNITS[from]) / LENGTH_UNITS[to];
}

function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  return (value * WEIGHT_UNITS[from]) / WEIGHT_UNITS[to];
}

function toCelsius(value: number, unit: TemperatureUnit): number {
  if (unit === "celsius") return value;
  if (unit === "fahrenheit") return ((value - 32) * 5) / 9;
  return value - 273.15;
}

function fromCelsius(value: number, unit: TemperatureUnit): number {
  if (unit === "celsius") return value;
  if (unit === "fahrenheit") return (value * 9) / 5 + 32;
  return value + 273.15;
}

function convertTemperature(value: number, from: TemperatureUnit, to: TemperatureUnit): number {
  return fromCelsius(toCelsius(value, from), to);
}

function formatResult(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 1e6) / 1e6;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "length", label: "Length" },
  { id: "weight", label: "Weight" },
  { id: "temperature", label: "Temperature" },
];

export default function UnitConverter() {
  useTrackTool("unit-converter");
  const [category, setCategory] = React.useState<Category>("length");
  const [inputValue, setInputValue] = React.useState(10);

  const [lengthFrom, setLengthFrom] = React.useState<LengthUnit>("km");
  const [lengthTo, setLengthTo] = React.useState<LengthUnit>("mi");
  const [weightFrom, setWeightFrom] = React.useState<WeightUnit>("kg");
  const [weightTo, setWeightTo] = React.useState<WeightUnit>("lb");
  const [tempFrom, setTempFrom] = React.useState<TemperatureUnit>("celsius");
  const [tempTo, setTempTo] = React.useState<TemperatureUnit>("fahrenheit");

  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const { result, fromLabel, toLabel } = React.useMemo(() => {
    if (category === "length") {
      return {
        result: convertLength(inputValue, lengthFrom, lengthTo),
        fromLabel: lengthFrom,
        toLabel: lengthTo,
      };
    }
    if (category === "weight") {
      return {
        result: convertWeight(inputValue, weightFrom, weightTo),
        fromLabel: weightFrom,
        toLabel: weightTo,
      };
    }
    return {
      result: convertTemperature(inputValue, tempFrom, tempTo),
      fromLabel: TEMPERATURE_LABELS[tempFrom],
      toLabel: TEMPERATURE_LABELS[tempTo],
    };
  }, [category, inputValue, lengthFrom, lengthTo, weightFrom, weightTo, tempFrom, tempTo]);

  const handleSwap = () => {
    if (category === "length") {
      setLengthFrom(lengthTo);
      setLengthTo(lengthFrom);
    } else if (category === "weight") {
      setWeightFrom(weightTo);
      setWeightTo(weightFrom);
    } else {
      setTempFrom(tempTo);
      setTempTo(tempFrom);
    }
  };

  const handleSave = async () => {
    const title = `${formatResult(inputValue)} ${fromLabel} = ${formatResult(result)} ${toLabel}`;
    await saveToolResult("unit-converter", {
      title,
      summary: `${category.charAt(0).toUpperCase()}${category.slice(1)} conversion`,
      data: JSON.stringify(
        { category, input: inputValue, from: fromLabel, to: toLabel, result },
        null,
        2
      ),
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="flex overflow-hidden rounded-lg border border-border w-fit">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                category === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">From</span>
            <div className="flex gap-2">
              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {category === "length" && (
                <select
                  value={lengthFrom}
                  onChange={(e) => setLengthFrom(e.target.value as LengthUnit)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {Object.keys(LENGTH_UNITS).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              )}
              {category === "weight" && (
                <select
                  value={weightFrom}
                  onChange={(e) => setWeightFrom(e.target.value as WeightUnit)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {Object.keys(WEIGHT_UNITS).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              )}
              {category === "temperature" && (
                <select
                  value={tempFrom}
                  onChange={(e) => setTempFrom(e.target.value as TemperatureUnit)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {(Object.keys(TEMPERATURE_LABELS) as TemperatureUnit[]).map((u) => (
                    <option key={u} value={u}>
                      {TEMPERATURE_LABELS[u]}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </label>

          <button
            onClick={handleSwap}
            aria-label="Swap units"
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center justify-self-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:mb-0"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>

          <label className="space-y-1.5">
            <span className="text-sm font-medium">To</span>
            {category === "length" && (
              <select
                value={lengthTo}
                onChange={(e) => setLengthTo(e.target.value as LengthUnit)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Object.keys(LENGTH_UNITS).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            )}
            {category === "weight" && (
              <select
                value={weightTo}
                onChange={(e) => setWeightTo(e.target.value as WeightUnit)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Object.keys(WEIGHT_UNITS).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            )}
            {category === "temperature" && (
              <select
                value={tempTo}
                onChange={(e) => setTempTo(e.target.value as TemperatureUnit)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {(Object.keys(TEMPERATURE_LABELS) as TemperatureUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {TEMPERATURE_LABELS[u]}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>
      </Card>

      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <Ruler className="h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">
          {formatResult(inputValue)} {fromLabel} equals
        </p>
        <p className="text-3xl font-extrabold tabular-nums">
          {formatResult(result)} <span className="text-lg font-medium text-muted-foreground">{toLabel}</span>
        </p>
        <Button size="sm" variant="outline" onClick={handleSave}>
          <Save className="h-3.5 w-3.5" /> Save result
        </Button>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="unit-converter" />
    </div>
  );
}

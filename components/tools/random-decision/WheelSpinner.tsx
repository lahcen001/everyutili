"use client";

import * as React from "react";
import { RotateCw, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const WHEEL_COLORS = [
  "#7c74ff",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
  "#a855f7",
];

const WHEEL_SIZE = 280;
const CENTER = WHEEL_SIZE / 2;
const RADIUS = WHEEL_SIZE / 2 - 4;
const SPIN_DURATION_MS = 4000;

function parseEntries(input: string): string[] {
  return input
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function polarToCartesian(angleDeg: number, radius: number): { x: number; y: number } {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(angleRad), y: CENTER + radius * Math.sin(angleRad) };
}

function wedgePath(startAngle: number, endAngle: number): string {
  const start = polarToCartesian(startAngle, RADIUS);
  const end = polarToCartesian(endAngle, RADIUS);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export default function WheelSpinner() {
  useTrackTool("wheel-spinner");
  const [input, setInput] = React.useState("Pizza\nSushi\nTacos\nBurgers\nSalad\nPasta");
  const [rotation, setRotation] = React.useState(0);
  const [spinning, setSpinning] = React.useState(false);
  const [winner, setWinner] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const entries = React.useMemo(() => parseEntries(input), [input]);
  const wedgeAngle = entries.length > 0 ? 360 / entries.length : 0;

  const spin = () => {
    if (spinning || entries.length < 2) return;
    setSpinning(true);
    setWinner(null);

    const winnerIndex = Math.floor(Math.random() * entries.length);
    // The wheel's 0deg mark (top, pointer position) starts at the first
    // wedge's center. To land the chosen wedge under the pointer, rotate so
    // that wedge's center ends up at the top, plus several full spins for
    // visual effect and a small random jitter within the wedge so it
    // doesn't always land dead-center.
    const wedgeCenter = winnerIndex * wedgeAngle + wedgeAngle / 2;
    const jitter = (Math.random() - 0.5) * wedgeAngle * 0.6;
    const extraSpins = 5 * 360;
    const targetRotation = rotation + extraSpins + (360 - wedgeCenter - jitter);

    setRotation(targetRotation);
    window.setTimeout(() => {
      setSpinning(false);
      setWinner(entries[winnerIndex]);
    }, SPIN_DURATION_MS);
  };

  const handleSave = async () => {
    if (!winner) return;
    await saveToolResult("wheel-spinner", {
      title: winner,
      summary: `Spun from ${entries.length} options: ${entries.join(", ")}`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Wheel entries</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            placeholder="One entry per line…"
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          {entries.length} entr{entries.length === 1 ? "y" : "ies"} — at least 2 needed to spin
        </p>
      </Card>

      <Card className="flex flex-col items-center gap-6 p-8">
        <div className="relative" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
          <div
            className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 -translate-y-1"
            style={{
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderTop: "16px solid var(--color-foreground, #111)",
            }}
          />
          <svg
            width={WHEEL_SIZE}
            height={WHEEL_SIZE}
            viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)` : undefined,
            }}
          >
            {entries.length === 0 ? (
              <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="var(--color-muted, #e5e7eb)" />
            ) : (
              entries.map((entry, i) => {
                const startAngle = i * wedgeAngle;
                const endAngle = startAngle + wedgeAngle;
                const labelAngle = startAngle + wedgeAngle / 2;
                const labelPos = polarToCartesian(labelAngle, RADIUS * 0.65);
                return (
                  <g key={i}>
                    <path
                      d={wedgePath(startAngle, endAngle)}
                      fill={WHEEL_COLORS[i % WHEEL_COLORS.length]}
                    />
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      fill="#fff"
                      fontSize={12}
                      fontWeight={600}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${labelAngle}, ${labelPos.x}, ${labelPos.y})`}
                    >
                      {entry.length > 14 ? `${entry.slice(0, 13)}…` : entry}
                    </text>
                  </g>
                );
              })
            )}
          </svg>
        </div>

        {winner && !spinning && (
          <p className="text-lg font-semibold text-primary">🎉 {winner}</p>
        )}

        <div className="flex gap-2">
          <Button onClick={spin} disabled={spinning || entries.length < 2}>
            <RotateCw className="h-4 w-4" />
            {spinning ? "Spinning…" : "Spin the wheel"}
          </Button>
          {winner && !spinning && (
            <Button variant="outline" onClick={handleSave}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          )}
        </div>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="wheel-spinner" />
    </div>
  );
}

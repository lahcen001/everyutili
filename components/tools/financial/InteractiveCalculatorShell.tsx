"use client";

import * as React from "react";

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  formatValue?: (value: number) => string;
  unit?: string;
}

export function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  formatValue,
  unit,
}: SliderInputProps) {
  const display = formatValue ? formatValue(value) : `${value}${unit ?? ""}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-primary">{display}</span>
      </div>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function thinLabels(labels: string[], maxCount: number): { label: string; index: number }[] {
  if (labels.length <= maxCount) return labels.map((label, index) => ({ label, index }));
  const step = (labels.length - 1) / (maxCount - 1);
  return Array.from({ length: maxCount }, (_, i) => {
    const index = Math.round(i * step);
    return { label: labels[index], index };
  });
}

export interface AreaChartSeries {
  label: string;
  /** CSS color value, e.g. "var(--primary)" or a hex string. */
  color: string;
  points: number[];
}

interface SvgAreaChartProps {
  series: AreaChartSeries[];
  xLabels: string[];
  height?: number;
}

export function SvgAreaChart({ series, xLabels, height = 220 }: SvgAreaChartProps) {
  const width = 600;
  const padding = 8;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxValue = React.useMemo(() => {
    const totals = series[0]?.points.map((_, i) =>
      series.reduce((sum, s) => sum + (s.points[i] ?? 0), 0)
    ) ?? [0];
    return Math.max(...totals, 1);
  }, [series]);

  const count = series[0]?.points.length ?? 0;

  const toPoint = (index: number, cumulativeValue: number) => {
    const x = padding + (count > 1 ? (index / (count - 1)) * chartWidth : chartWidth / 2);
    const y = padding + chartHeight - (cumulativeValue / maxValue) * chartHeight;
    return { x, y };
  };

  const layers = series.reduce<{
    rendered: { areaPath: string; linePath: string; color: string; label: string }[];
    base: number[];
  }>(
    (acc, s) => {
      const topPoints = s.points.map((v, i) => {
        const cumulative = acc.base[i] + v;
        return { ...toPoint(i, cumulative), base: acc.base[i] };
      });
      const basePoints = acc.base.map((v, i) => toPoint(i, v));
      const nextBase = topPoints.map((p, i) => p.base + s.points[i]);

      const topPath = topPoints.map((p) => `${p.x},${p.y}`).join(" ");
      const bottomPath = [...basePoints].reverse().map((p) => `${p.x},${p.y}`).join(" ");
      const areaPath = `${topPath} ${bottomPath}`;
      const linePath = topPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

      return {
        rendered: [...acc.rendered, { areaPath, linePath, color: s.color, label: s.label }],
        base: nextBase,
      };
    },
    { rendered: [], base: new Array(count).fill(0) }
  ).rendered;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Value growth chart"
      >
        {layers.map((layer) => (
          <polygon
            key={layer.label}
            points={layer.areaPath}
            fill={layer.color}
            fillOpacity={0.25}
          />
        ))}
        {layers.map((layer) => (
          <path
            key={layer.label}
            d={layer.linePath}
            fill="none"
            stroke={layer.color}
            strokeWidth={2}
          />
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        {thinLabels(xLabels, 8).map(({ label, index }) => (
          <span key={index}>{label}</span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-4">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  /** CSS color value, e.g. "var(--primary)" or a hex string. */
  color: string;
}

interface SvgDonutChartProps {
  segments: DonutSegment[];
  size?: number;
}

export function SvgDonutChart({ segments, size = 180 }: SvgDonutChartProps) {
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  // Each segment is drawn as a full-circle stroke whose dash pattern only
  // "paints" its proportional share of the circumference; offsetting the
  // dash by the running total of prior segments makes them line up end to end.
  const arcs = segments.reduce<{
    rendered: (DonutSegment & { dashLength: number; offset: number; fraction: number })[];
    cumulative: number;
  }>(
    (acc, segment) => {
      const fraction = segment.value / total;
      const dashLength = fraction * circumference;
      const offset = acc.cumulative * circumference;
      return {
        rendered: [...acc.rendered, { ...segment, dashLength, offset, fraction }],
        cumulative: acc.cumulative + fraction,
      };
    },
    { rendered: [], cumulative: 0 }
  ).rendered;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Breakdown donut chart">
        <g transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
          <circle r={radius} fill="none" stroke="var(--border)" strokeWidth={14} />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={14}
              strokeDasharray={`${arc.dashLength} ${circumference - arc.dashLength}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="butt"
            />
          ))}
        </g>
      </svg>
      <div className="space-y-2">
        {arcs.map((arc) => (
          <div key={arc.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: arc.color }} />
            <span className="text-muted-foreground">{arc.label}</span>
            <span className="font-semibold tabular-nums">{Math.round(arc.fraction * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { Cpu, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";

interface FileMetricsHUDProps {
  /** Total input size in bytes, summed across all files if batched. */
  inputBytes: number;
  /** Total output size in bytes, summed across all files if batched. */
  outputBytes: number;
  /** Wall-clock processing time in milliseconds, if known. */
  durationMs?: number;
  className?: string;
}

export function FileMetricsHUD({ inputBytes, outputBytes, durationMs, className }: FileMetricsHUDProps) {
  const savingsPercent =
    inputBytes > 0 ? Math.round((1 - outputBytes / inputBytes) * 100) : 0;
  const isSmaller = outputBytes < inputBytes;
  const inputRatio = Math.max(inputBytes, outputBytes) > 0
    ? (inputBytes / Math.max(inputBytes, outputBytes)) * 100
    : 0;
  const outputRatio = Math.max(inputBytes, outputBytes) > 0
    ? (outputBytes / Math.max(inputBytes, outputBytes)) * 100
    : 0;

  return (
    <div
      className={cn(
        "glass flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {formatBytes(inputBytes)} <span className="text-muted-foreground/60">original</span>
          </span>
          <span className="font-medium">
            {formatBytes(outputBytes)} <span className="font-normal text-muted-foreground/60">output</span>
          </span>
        </div>
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted/40">
          <div
            className="h-full rounded-full bg-muted-foreground/40 transition-all"
            style={{ width: `${inputRatio}%` }}
          />
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isSmaller ? "bg-emerald-500" : "bg-amber-500"
            )}
            style={{ width: `${outputRatio}%` }}
          />
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {inputBytes > 0 && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              isSmaller
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            )}
          >
            {isSmaller ? "-" : "+"}
            {Math.abs(savingsPercent)}%
          </span>
        )}
        <span className="flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          <Cpu className="h-3 w-3" />
          {durationMs !== undefined ? `Processed locally in ${Math.round(durationMs)}ms` : "Processed locally"}
        </span>
        <span className="flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3" />0 bytes uploaded
        </span>
      </div>
    </div>
  );
}

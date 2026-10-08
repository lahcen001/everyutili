"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type KeyKind = "num" | "op" | "fn" | "act" | "eq" | "mod";

export interface KeyDef {
  /** what the button shows */
  label: React.ReactNode;
  /** what it sends to onPress (defaults to the label when that is a string) */
  value?: string;
  kind?: KeyKind;
  /** number of columns it spans */
  span?: number;
  /** spoken name for screen readers */
  aria?: string;
  /** small legend above the key, such as the 2nd function */
  sub?: string;
  active?: boolean;
  disabled?: boolean;
}

/** Tactile, colour-coded keys with a solid "edge" that presses down. Designed for the dark CalcFrame. */
const STYLE: Record<KeyKind, string> = {
  num: "bg-gradient-to-b from-slate-500 to-slate-600 text-white text-xl font-semibold shadow-[0_4px_0_#1e293b,inset_0_1px_0_rgba(255,255,255,0.25)]",
  fn: "bg-gradient-to-b from-slate-600 to-slate-700 text-slate-100 text-sm font-semibold shadow-[0_4px_0_#0f172a,inset_0_1px_0_rgba(255,255,255,0.18)]",
  op: "bg-gradient-to-b from-indigo-400 to-indigo-500 text-white text-xl font-bold shadow-[0_4px_0_#312e81,inset_0_1px_0_rgba(255,255,255,0.3)]",
  act: "bg-gradient-to-b from-rose-400 to-rose-500 text-white text-base font-bold shadow-[0_4px_0_#881337,inset_0_1px_0_rgba(255,255,255,0.3)]",
  eq: "bg-gradient-to-b from-fuchsia-400 via-violet-500 to-indigo-500 text-white text-2xl font-black shadow-[0_4px_0_#4c1d95,0_0_24px_rgba(168,85,247,0.5),inset_0_1px_0_rgba(255,255,255,0.35)]",
  mod: "bg-gradient-to-b from-amber-300 to-amber-400 text-slate-900 text-sm font-bold shadow-[0_4px_0_#92400e,inset_0_1px_0_rgba(255,255,255,0.5)]",
};

const buzz = () => {
  try {
    navigator.vibrate?.(6);
  } catch {
    /* not supported */
  }
};

/** A grid of calculator keys. Rows are arrays of keys; `cols` is the width of the grid. */
export function Keypad({ rows, cols, onPress, className }: { rows: KeyDef[][]; cols: number; onPress: (value: string) => void; className?: string }) {
  return (
    <div className={cn("grid gap-x-2 gap-y-2.5 sm:gap-x-2.5 sm:gap-y-3", className)} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role="group" aria-label="Calculator keys">
      {rows.flat().map((k, i) => {
        const value = k.value ?? (typeof k.label === "string" ? k.label : "");
        return (
          <button
            key={i}
            type="button"
            // keep the caret in the display field when a key is tapped
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              buzz();
              onPress(value);
            }}
            disabled={k.disabled}
            aria-label={k.aria}
            aria-pressed={k.active}
            className={cn(
              "relative flex h-12 select-none items-center justify-center rounded-2xl outline-none transition-[transform,box-shadow,filter] duration-75 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white/80 active:translate-y-[3px] active:shadow-none disabled:pointer-events-none disabled:opacity-30 sm:h-14",
              STYLE[k.kind ?? "num"],
              k.active && "ring-2 ring-white/90 brightness-110"
            )}
            style={k.span && k.span > 1 ? { gridColumn: `span ${k.span}` } : undefined}
          >
            {k.sub && <span className="pointer-events-none absolute right-1.5 top-0.5 text-[9px] font-semibold leading-none text-white/55">{k.sub}</span>}
            {k.label}
          </button>
        );
      })}
    </div>
  );
}

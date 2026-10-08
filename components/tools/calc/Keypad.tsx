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

/**
 * Flat, calm keys that follow the site's light/dark theme. One accent colour (the site's primary) marks
 * operators and equals; everything else is neutral.
 */
const STYLE: Record<KeyKind, string> = {
  num: "bg-card text-foreground text-xl font-medium border border-border hover:bg-muted",
  fn: "bg-muted/60 text-foreground/80 text-[15px] font-medium hover:bg-muted",
  op: "bg-primary/10 text-primary text-xl font-semibold hover:bg-primary/20",
  act: "bg-muted/60 text-destructive text-base font-semibold hover:bg-destructive/10",
  eq: "bg-primary text-primary-foreground text-2xl font-semibold hover:bg-primary/90",
  mod: "bg-transparent text-muted-foreground text-xs font-semibold border border-dashed border-border hover:bg-muted/60 hover:text-foreground",
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
    <div className={cn("grid gap-2", className)} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role="group" aria-label="Calculator keys">
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
              "relative flex h-12 min-w-0 select-none items-center justify-center rounded-2xl outline-none transition-[transform,background-color,color] duration-100 focus-visible:ring-2 focus-visible:ring-primary active:scale-95 disabled:pointer-events-none disabled:opacity-35 sm:h-14",
              STYLE[k.kind ?? "num"],
              k.active && "!border-primary !bg-primary !text-primary-foreground"
            )}
            style={k.span && k.span > 1 ? { gridColumn: `span ${k.span}` } : undefined}
          >
            {k.sub && <span className="pointer-events-none absolute right-2 top-1 text-[9px] font-medium leading-none text-muted-foreground">{k.sub}</span>}
            {k.label}
          </button>
        );
      })}
    </div>
  );
}

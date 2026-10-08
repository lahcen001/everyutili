"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useFitFont } from "@/components/tools/calc/useFitFont";

/** One line of big text that shrinks to fit its box instead of overflowing. */
export function FitText({ children, max = 32, min = 13, className }: { children: string; max?: number; min?: number; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  useFitFont(ref, children, max, min);
  return (
    <div ref={ref} className={cn("w-full overflow-hidden whitespace-nowrap", className)} title={children}>
      {children}
    </div>
  );
}

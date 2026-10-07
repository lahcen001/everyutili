"use client";

import * as React from "react";

import { useFitScale } from "@/components/tools/shared/useFitScale";
import { cn } from "@/lib/utils";

interface FitStageProps {
  /** natural size of what is shown, in pixels */
  width: number;
  height: number;
  /** drawn inside a box of exactly the fitted size; receives the scale (≤ 1) */
  children: React.ReactNode | ((scale: number) => React.ReactNode);
  className?: string;
  boxClassName?: string;
}

/** Fits a picture or canvas entirely inside the available area — both width and height — and centres it. */
export function FitStage({ width, height, children, className, boxClassName }: FitStageProps) {
  const { ref, scale } = useFitScale(width, height);
  return (
    <div ref={ref} className={cn("flex h-full w-full items-center justify-center", className)}>
      <div className={cn("relative shrink-0", boxClassName)} style={{ width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) }}>
        {typeof children === "function" ? children(scale) : children}
      </div>
    </div>
  );
}

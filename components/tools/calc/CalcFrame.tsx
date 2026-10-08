import type * as React from "react";

import { cn } from "@/lib/utils";

/** The calculator body: a clean card that follows the site's theme. */
export function CalcFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-3xl border border-border bg-card p-3 shadow-sm sm:p-4", className)}>{children}</div>;
}

/** The calculator screen: a quiet, softly tinted panel. */
export function CalcScreen({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-w-0 rounded-2xl bg-muted/50 px-4 py-3 text-right", className)}>{children}</div>;
}

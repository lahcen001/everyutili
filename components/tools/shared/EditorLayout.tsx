import type * as React from "react";

import { cn } from "@/lib/utils";

interface EditorLayoutProps {
  /** The picture or canvas. It is centred and scaled to fit, so it never needs scrolling. */
  stage: React.ReactNode;
  /** Controls. This column scrolls on its own, beside the picture. */
  sidebar: React.ReactNode;
  /** Buttons pinned to the bottom of the sidebar (Export, New image…). */
  footer?: React.ReactNode;
  /** A strip above the picture (zoom, undo…). */
  stageToolbar?: React.ReactNode;
  /** Sidebar width on large screens. */
  sidebarWidth?: "sm" | "md" | "lg";
  className?: string;
}

const WIDTH = { sm: "lg:grid-cols-[minmax(0,1fr)_18rem]", md: "lg:grid-cols-[minmax(0,1fr)_21rem]", lg: "lg:grid-cols-[minmax(0,1fr)_25rem]" } as const;

/**
 * Side-by-side editor: the image fills the left area at a fixed screen height (fit to view, no scrolling),
 * the controls sit in a sidebar on the right. On small screens the picture comes first, then the controls.
 * Children that draw the image should use `max-w-full max-h-full` (see `StageImage`).
 */
export function EditorLayout({ stage, sidebar, footer, stageToolbar, sidebarWidth = "md", className }: EditorLayoutProps) {
  return (
    <div className={cn("grid gap-3 lg:h-[78vh] lg:min-h-[520px]", WIDTH[sidebarWidth], className)}>
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/30">
        {stageToolbar && <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background/60 px-3 py-1.5">{stageToolbar}</div>}
        <div className="relative flex h-[58vh] min-h-[300px] flex-1 items-center justify-center overflow-hidden bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)] bg-[length:20px_20px] p-3 dark:bg-[repeating-conic-gradient(#1f2937_0%_25%,#111827_0%_50%)] lg:h-auto">{stage}</div>
      </div>
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">{sidebar}</div>
        {footer && <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 p-3">{footer}</div>}
      </aside>
    </div>
  );
}

/** A labelled group of controls inside the sidebar. */
export function SidebarSection({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A slider row: label and value on top, the slider underneath. */
export function SliderRow({ label, value, min, max, step = 1, unit = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value}
          {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-primary" />
    </label>
  );
}

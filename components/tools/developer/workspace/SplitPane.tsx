"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  /** starting width of the left pane, in percent */
  initial?: number;
  className?: string;
}

/** Two panes with a draggable, keyboard-accessible divider. Side by side from `lg` up, stacked below. */
export function SplitPane({ left, right, initial = 50, className }: SplitPaneProps) {
  const [ratio, setRatio] = React.useState(initial);
  const [dragging, setDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const clamp = (n: number) => Math.min(80, Math.max(20, n));

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setRatio(clamp(((e.clientX - rect.left) / rect.width) * 100));
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") setRatio((r) => clamp(r - 3));
    else if (e.key === "ArrowRight") setRatio((r) => clamp(r + 3));
    else if (e.key === "Home") setRatio(initial);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={containerRef} className={cn("flex h-full min-h-0 flex-col gap-3 lg:flex-row lg:gap-0", dragging && "select-none", className)} style={{ "--split": `${ratio}%` } as React.CSSProperties}>
      <div className="min-h-[360px] min-w-0 flex-1 lg:min-h-0 lg:flex-none lg:basis-[var(--split)]">{left}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        aria-valuenow={Math.round(ratio)}
        aria-valuemin={20}
        aria-valuemax={80}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragging(false)}
        onKeyDown={onKeyDown}
        onDoubleClick={() => setRatio(initial)}
        className={cn("group relative hidden w-3 shrink-0 cursor-col-resize items-center justify-center outline-none lg:flex", dragging && "bg-primary/5")}
      >
        <span className={cn("h-12 w-1 rounded-full bg-border transition-colors group-hover:bg-primary group-focus-visible:bg-primary", dragging && "bg-primary")} />
      </div>
      <div className="min-h-[360px] min-w-0 flex-1 lg:min-h-0">{right}</div>
    </div>
  );
}

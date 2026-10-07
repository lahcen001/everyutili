"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The framed, viewport-tall area a workspace tool lives in. */
export function Workspace({ toolbar, children, status, className }: { toolbar?: React.ReactNode; children: React.ReactNode; status?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-[78vh] min-h-[560px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm", className)}>
      {toolbar && <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">{toolbar}</div>}
      <div className="min-h-0 flex-1 p-3">{children}</div>
      {status && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">{status}</div>}
    </div>
  );
}

export function ToolbarButton({ icon, children, ...props }: { icon?: React.ReactNode } & React.ComponentProps<typeof Button>) {
  return (
    <Button size="sm" variant="outline" {...props}>
      {icon}
      {children}
    </Button>
  );
}

export function ToolbarSeparator() {
  return <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />;
}

export function ToolbarSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ToolbarToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 rounded border-border accent-primary" />
      {label}
    </label>
  );
}

/** A titled pane with its own header strip, used on each side of a SplitPane. */
export function Pane({ title, actions, children, className }: { title: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background", className)}>
      <header className="flex min-h-9 items-center justify-between gap-2 border-b border-border bg-muted/20 px-3 text-xs font-medium text-muted-foreground">
        <div className="flex items-center gap-1.5">{title}</div>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

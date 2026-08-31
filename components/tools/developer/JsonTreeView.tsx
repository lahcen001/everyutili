"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function valueColor(value: unknown) {
  if (typeof value === "string") return "text-emerald-600 dark:text-emerald-400";
  if (typeof value === "number") return "text-blue-600 dark:text-blue-400";
  if (typeof value === "boolean") return "text-amber-600 dark:text-amber-400";
  if (value === null) return "text-muted-foreground";
  return "";
}

function TreeNode({ label, value, depth }: { label: string; value: unknown; depth: number }) {
  const [open, setOpen] = React.useState(depth < 1);
  const isObject = value !== null && typeof value === "object";

  if (!isObject) {
    return (
      <div className="flex items-start gap-1 py-0.5 pl-5 font-mono text-xs">
        <span className="text-muted-foreground">{label}:</span>
        <span className={valueColor(value)}>{JSON.stringify(value)}</span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  const preview = Array.isArray(value) ? `Array(${value.length})` : `Object(${entries.length})`;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 py-0.5 font-mono text-xs hover:bg-muted/60 rounded"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        <span className="text-muted-foreground">{label}:</span>
        <span className="text-muted-foreground/70">{preview}</span>
      </button>
      {open && (
        <div className="ml-3 border-l border-border pl-2">
          {entries.map(([k, v]) => (
            <TreeNode key={k} label={k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function JsonTreeView({ data }: { data: unknown }) {
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-border bg-muted/20 p-3">
      <TreeNode label="root" value={data} depth={0} />
    </div>
  );
}

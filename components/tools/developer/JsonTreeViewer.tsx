"use client";

import * as React from "react";
import { ChevronRight, Search, Copy, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface JsonTreeViewerProps {
  data: unknown;
  className?: string;
}

type Entry = readonly [string, unknown];

function valueColor(value: unknown) {
  if (typeof value === "string") return "text-emerald-600 dark:text-emerald-400";
  if (typeof value === "number") return "text-blue-600 dark:text-blue-400";
  if (typeof value === "boolean") return "text-amber-600 dark:text-amber-400";
  if (value === null) return "text-muted-foreground";
  return "";
}

function typeLabel(value: unknown): string | null {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return null;
}

// Object keys become `.key` accessors only when `key` is a valid JS
// identifier; anything else (spaces, leading digits, dashes, etc.) must use
// bracket notation with a quoted string, or the copied path would produce
// invalid/incorrect JS when pasted.
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function appendObjectKey(basePath: string, key: string): string {
  return IDENTIFIER_PATTERN.test(key) ? `${basePath}.${key}` : `${basePath}[${JSON.stringify(key)}]`;
}

function appendArrayIndex(basePath: string, index: number): string {
  return `${basePath}[${index}]`;
}

function getEntries(value: unknown): Entry[] | null {
  if (value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) return value.map((v, i) => [String(i), v] as const);
  return Object.entries(value as Record<string, unknown>);
}

function matchesSearch(needle: string, value: unknown, label: string): boolean {
  if (label.toLowerCase().includes(needle)) return true;
  if (typeof value === "string") return value.toLowerCase().includes(needle);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase().includes(needle);
  }
  return false;
}

function subtreeHasMatch(needle: string, label: string, value: unknown): boolean {
  if (matchesSearch(needle, value, label)) return true;
  const entries = getEntries(value);
  if (!entries) return false;
  return entries.some(([k, v]) => subtreeHasMatch(needle, k, v));
}

function highlight(text: string, needle: string): React.ReactNode {
  if (!needle) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-primary/20 text-inherit">{text.slice(idx, idx + needle.length)}</mark>
      {text.slice(idx + needle.length)}
    </>
  );
}

interface RowActionsProps {
  path: string;
  copyValue: unknown;
}

function RowActions({ path, copyValue }: RowActionsProps) {
  const [copied, setCopied] = React.useState<"path" | "value" | null>(null);

  const handleCopyPath = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(path);
    setCopied("path");
    setTimeout(() => setCopied((current) => (current === "path" ? null : current)), 1500);
  };

  const handleCopyValue = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(JSON.stringify(copyValue));
    setCopied("value");
    setTimeout(() => setCopied((current) => (current === "value" ? null : current)), 1500);
  };

  return (
    <span className="ml-1 hidden items-center gap-0.5 group-hover:inline-flex">
      <button
        onClick={handleCopyPath}
        aria-label="Copy path"
        title="Copy path"
        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied === "path" ? (
          <Check className="h-3 w-3 text-emerald-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
      <button
        onClick={handleCopyValue}
        aria-label="Copy value"
        title="Copy value"
        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied === "value" ? (
          <Check className="h-3 w-3 text-emerald-500" />
        ) : (
          <Copy className="h-3 w-3 opacity-60" />
        )}
      </button>
    </span>
  );
}

interface TreeNodeProps {
  label: string;
  value: unknown;
  depth: number;
  path: string;
  searchTerm: string;
}

const TreeNode = React.memo(function TreeNode({ label, value, depth, path, searchTerm }: TreeNodeProps) {
  const entries = getEntries(value);
  const isObject = entries !== null;

  const hasMatch = React.useMemo(
    () => (searchTerm ? subtreeHasMatch(searchTerm, label, value) : true),
    [searchTerm, label, value]
  );

  const [manualOpen, setManualOpen] = React.useState<boolean | null>(null);
  const defaultOpen = depth < 1;
  const searchForcedOpen = searchTerm.length > 0 && hasMatch && isObject;
  const open = manualOpen ?? (searchForcedOpen || defaultOpen);

  if (!isObject) {
    const label_ = typeLabel(value);
    return (
      <div
        className={cn(
          "group flex items-start gap-1 py-0.5 pl-5 font-mono text-xs",
          searchTerm && !hasMatch && "opacity-35"
        )}
      >
        <span className="text-muted-foreground">{highlight(label, searchTerm)}:</span>
        <span className={valueColor(value)}>{highlight(JSON.stringify(value), searchTerm)}</span>
        {label_ && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{label_}</span>
        )}
        <RowActions path={path} copyValue={value} />
      </div>
    );
  }

  const preview = Array.isArray(value) ? `Array(${entries.length})` : `Object(${entries.length})`;

  return (
    <div className={cn(searchTerm && !hasMatch && "opacity-35")}>
      <div className="group flex items-center gap-1 py-0.5 font-mono text-xs hover:bg-muted/60 rounded">
        <button onClick={() => setManualOpen(!open)} className="flex items-center gap-1">
          <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
          <span className="text-muted-foreground">{highlight(label, searchTerm)}:</span>
          <span className="text-muted-foreground/70">{preview}</span>
        </button>
        <RowActions path={path} copyValue={value} />
      </div>
      {open && (
        <div className="ml-3 border-l border-border pl-2">
          {entries.map(([k, v]) => (
            <TreeNode
              key={k}
              label={k}
              value={v}
              depth={depth + 1}
              path={Array.isArray(value) ? appendArrayIndex(path, Number(k)) : appendObjectKey(path, k)}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export function JsonTreeViewer({ data, className }: JsonTreeViewerProps) {
  const [search, setSearch] = React.useState("");
  const normalizedSearch = search.trim().toLowerCase();

  return (
    <div className={cn("rounded-lg border border-border bg-muted/20", className)}>
      <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search keys or values…"
          className="h-6 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            aria-label="Clear search"
            title="Clear search"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="max-h-[420px] overflow-auto p-3">
        <TreeNode label="root" value={data} depth={0} path="data" searchTerm={normalizedSearch} />
      </div>
    </div>
  );
}

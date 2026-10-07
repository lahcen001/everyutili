"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight, ChevronDown, ChevronUp, ChevronsDownUp, ChevronsUpDown, Search, Copy, Check, X } from "lucide-react";
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

function leafText(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : value === null ? "null" : "";
}

/**
 * One depth-first pass for a search term. `subtree` holds every path that has a match
 * somewhere at or below it; `direct` lists, in document order, the paths whose own key or
 * value matches.
 */
function computeMatches(root: unknown, needle: string): { subtree: Set<string>; direct: string[] } {
  const subtree = new Set<string>();
  const direct: string[] = [];
  if (!needle) return { subtree, direct };
  const visit = (label: string, value: unknown, path: string): boolean => {
    let hit = label.toLowerCase().includes(needle) || leafText(value).toLowerCase().includes(needle);
    if (hit) direct.push(path);
    const entries = getEntries(value);
    if (entries) {
      for (const [k, v] of entries) {
        const child = Array.isArray(value) ? appendArrayIndex(path, Number(k)) : appendObjectKey(path, k);
        if (visit(k, v, child)) hit = true;
      }
    }
    if (hit) subtree.add(path);
    return hit;
  };
  visit("root", root, "data");
  return { subtree, direct };
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

// ---------------------------------------------------------------------
// Flattening: @tanstack/react-virtual windows a flat list, not a nested
// component tree, so the recursive JSON structure is flattened into a flat
// array of visible rows first (one entry per rendered row, in document
// order) — only rows that survive expansion state actually get flattened,
// so a collapsed subtree of any size costs nothing. Re-flattened whenever
// data/expansion/search changes, not on every render.
// ---------------------------------------------------------------------

interface FlatRow {
  key: string;
  label: string;
  value: unknown;
  depth: number;
  path: string;
  isObject: boolean;
  isOpen: boolean;
  hasMatch: boolean;
  isDirect: boolean;
}

interface FlattenContext {
  searching: boolean;
  subtree: Set<string>;
  direct: Set<string>;
  manualOpen: Map<string, boolean>;
  defaultDepth: number;
}

function flattenTree(label: string, value: unknown, depth: number, path: string, ctx: FlattenContext, out: FlatRow[]): void {
  const entries = getEntries(value);
  const isObject = entries !== null;
  const hasMatch = ctx.searching ? ctx.subtree.has(path) : true;
  // While searching, open only the branches that lead to a match.
  const autoOpen = ctx.searching ? hasMatch && isObject : depth < ctx.defaultDepth;
  const open = ctx.manualOpen.has(path) ? ctx.manualOpen.get(path)! : autoOpen;

  out.push({ key: path, label, value, depth, path, isObject, isOpen: open, hasMatch, isDirect: ctx.direct.has(path) });

  if (isObject && open) {
    for (const [k, v] of entries) {
      const childPath = Array.isArray(value) ? appendArrayIndex(path, Number(k)) : appendObjectKey(path, k);
      flattenTree(k, v, depth + 1, childPath, ctx, out);
    }
  }
}

interface TreeRowProps {
  row: FlatRow;
  onToggle: (path: string, currentlyOpen: boolean) => void;
  searchTerm: string;
}

const TreeRow = React.memo(function TreeRow({ row, onToggle, searchTerm }: TreeRowProps) {
  const { label, value, depth, path, isObject, isOpen, hasMatch, isDirect } = row;
  const indent = 8 + depth * 12;

  if (!isObject) {
    const label_ = typeLabel(value);
    return (
      <div
        className={cn(
          "group flex items-start gap-1 py-0.5 font-mono text-xs",
          searchTerm && !hasMatch && "opacity-35",
          isDirect && "bg-primary/10"
        )}
        style={{ paddingLeft: indent + 12 }}
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

  const entries = getEntries(value)!;
  const preview = Array.isArray(value) ? `Array(${entries.length})` : `Object(${entries.length})`;

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded py-0.5 font-mono text-xs hover:bg-muted/60",
        searchTerm && !hasMatch && "opacity-35",
        isDirect && "bg-primary/10"
      )}
      style={{ paddingLeft: indent }}
    >
      <button onClick={() => onToggle(path, isOpen)} className="flex items-center gap-1">
        <ChevronRight className={cn("h-3 w-3 transition-transform", isOpen && "rotate-90")} />
        <span className="text-muted-foreground">{highlight(label, searchTerm)}:</span>
        <span className="text-muted-foreground/70">{preview}</span>
      </button>
      <RowActions path={path} copyValue={value} />
    </div>
  );
});

const ROW_HEIGHT_ESTIMATE = 22;
const VIRTUALIZE_THRESHOLD = 150;

const DEPTH_OPTIONS = [1, 2, 3, 4, 5];

export function JsonTreeViewer({ data, className }: JsonTreeViewerProps) {
  const [search, setSearch] = React.useState("");
  const [manualOpen, setManualOpen] = React.useState<Map<string, boolean>>(new Map());
  const [defaultDepth, setDefaultDepth] = React.useState(1);
  const [cursor, setCursor] = React.useState(0);
  const normalizedSearch = search.trim().toLowerCase();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const matches = React.useMemo(() => computeMatches(data, normalizedSearch), [data, normalizedSearch]);

  const rows = React.useMemo(() => {
    const out: FlatRow[] = [];
    flattenTree("root", data, 0, "data", { searching: normalizedSearch.length > 0, subtree: matches.subtree, direct: new Set(matches.direct), manualOpen, defaultDepth }, out);
    return out;
  }, [data, normalizedSearch, matches, manualOpen, defaultDepth]);

  const toggle = React.useCallback((path: string, currentlyOpen: boolean) => {
    setManualOpen((prev) => new Map(prev).set(path, !currentlyOpen));
  }, []);

  const setDepth = (depth: number) => {
    setManualOpen(new Map());
    setDefaultDepth(depth);
  };

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: 12,
  });

  const shouldVirtualize = rows.length > VIRTUALIZE_THRESHOLD;
  const virtualItems = shouldVirtualize ? virtualizer.getVirtualItems() : null;

  const matchCount = matches.direct.length;
  const safeCursor = matchCount ? cursor % matchCount : 0;
  const goToMatch = (delta: number) => {
    if (!matchCount) return;
    const next = (safeCursor + delta + matchCount) % matchCount;
    setCursor(next);
    const index = rows.findIndex((r) => r.path === matches.direct[next]);
    if (index < 0) return;
    if (shouldVirtualize) virtualizer.scrollToIndex(index, { align: "center" });
    else scrollRef.current?.querySelectorAll("[data-tree-row]")[index]?.scrollIntoView({ block: "center" });
  };

  const iconButton = "flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40";

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-background", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") goToMatch(e.shiftKey ? -1 : 1);
          }}
          placeholder="Search keys or values…"
          aria-label="Search the tree"
          className="h-6 min-w-32 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
        />
        {normalizedSearch && (
          <>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground" role="status">
              {matchCount ? `${safeCursor + 1} / ${matchCount}` : "No matches"}
            </span>
            <button onClick={() => goToMatch(-1)} disabled={!matchCount} aria-label="Previous match" title="Previous match (Shift+Enter)" className={iconButton}>
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => goToMatch(1)} disabled={!matchCount} aria-label="Next match" title="Next match (Enter)" className={iconButton}>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setSearch("")} aria-label="Clear search" title="Clear search" className={iconButton}>
              <X className="h-3 w-3" />
            </button>
          </>
        )}
        <span className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden />
        <button onClick={() => setDepth(99)} aria-label="Expand all" title="Expand all" className={iconButton}>
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setDepth(1)} aria-label="Collapse all" title="Collapse all" className={iconButton}>
          <ChevronsDownUp className="h-3.5 w-3.5" />
        </button>
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          Depth
          <select value={defaultDepth >= 99 ? "all" : String(defaultDepth)} onChange={(e) => setDepth(e.target.value === "all" ? 99 : Number(e.target.value))} className="h-6 rounded border border-border bg-background px-1 text-xs text-foreground">
            {DEPTH_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            <option value="all">All</option>
          </select>
        </label>
        {shouldVirtualize && <span className="shrink-0 text-[10px] text-muted-foreground/60">{rows.length.toLocaleString()} rows</span>}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-3">
        {shouldVirtualize && virtualItems ? (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualItems.map((virtualRow) => (
              <div
                key={virtualRow.key}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                data-tree-row
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }}
              >
                <TreeRow row={rows[virtualRow.index]} onToggle={toggle} searchTerm={normalizedSearch} />
              </div>
            ))}
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.key} data-tree-row>
              <TreeRow row={row} onToggle={toggle} searchTerm={normalizedSearch} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

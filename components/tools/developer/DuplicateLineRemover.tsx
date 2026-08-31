"use client";

import * as React from "react";
import { ListFilter, ArrowUpAZ, ArrowDownZA, Save } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

type SortMode = "none" | "asc" | "desc" | "length";

const SORT_OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: "none", label: "No sort" },
  { mode: "asc", label: "Sort A→Z" },
  { mode: "desc", label: "Sort Z→A" },
  { mode: "length", label: "Sort by length" },
];

interface ProcessResult {
  output: string;
  linesIn: number;
  linesOut: number;
  duplicatesRemoved: number;
}

function processLines(
  input: string,
  options: {
    removeDuplicates: boolean;
    caseInsensitive: boolean;
    trimWhitespace: boolean;
    removeEmpty: boolean;
    sortMode: SortMode;
  }
): ProcessResult {
  const rawLines = input.split(/\r\n|\r|\n/);
  const linesIn = input.length === 0 ? 0 : rawLines.length;

  let lines = rawLines.map((line) => (options.trimWhitespace ? line.trim() : line));

  if (options.removeEmpty) {
    lines = lines.filter((line) => line.trim().length > 0);
  }

  if (options.removeDuplicates) {
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const line of lines) {
      const key = options.caseInsensitive ? line.toLowerCase() : line;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(line);
    }
    lines = deduped;
  }

  switch (options.sortMode) {
    case "asc":
      lines = [...lines].sort((a, b) =>
        options.caseInsensitive
          ? a.toLowerCase().localeCompare(b.toLowerCase())
          : a.localeCompare(b)
      );
      break;
    case "desc":
      lines = [...lines].sort((a, b) =>
        options.caseInsensitive
          ? b.toLowerCase().localeCompare(a.toLowerCase())
          : b.localeCompare(a)
      );
      break;
    case "length":
      lines = [...lines].sort((a, b) => a.length - b.length);
      break;
    default:
      break;
  }

  return {
    output: lines.join("\n"),
    linesIn,
    linesOut: lines.length,
    duplicatesRemoved: Math.max(0, linesIn - lines.length),
  };
}

export default function DuplicateLineRemover() {
  useTrackTool("duplicate-line-remover");
  const [input, setInput] = React.useState(
    "apple\nbanana\napple\nCherry\ncherry\n\nbanana\ngrape"
  );
  const [removeDuplicates, setRemoveDuplicates] = React.useState(true);
  const [caseInsensitive, setCaseInsensitive] = React.useState(false);
  const [trimWhitespace, setTrimWhitespace] = React.useState(true);
  const [removeEmpty, setRemoveEmpty] = React.useState(false);
  const [sortMode, setSortMode] = React.useState<SortMode>("none");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const result = React.useMemo(
    () =>
      processLines(input, {
        removeDuplicates,
        caseInsensitive,
        trimWhitespace,
        removeEmpty,
        sortMode,
      }),
    [input, removeDuplicates, caseInsensitive, trimWhitespace, removeEmpty, sortMode]
  );

  const handleSave = async () => {
    await saveToolResult("duplicate-line-remover", {
      title: `${result.linesOut.toLocaleString()} unique lines`,
      summary: `${result.duplicatesRemoved.toLocaleString()} duplicates removed`,
      data: result.output,
    });
    historyRef.current?.refresh();
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (item.data) setInput(item.data);
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Input lines</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={10}
            placeholder="Paste a list of lines here, one item per line..."
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={removeDuplicates}
              onChange={(e) => setRemoveDuplicates(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Remove duplicate lines
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={caseInsensitive}
              onChange={(e) => setCaseInsensitive(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Case-insensitive comparison
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={trimWhitespace}
              onChange={(e) => setTrimWhitespace(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Trim whitespace
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={removeEmpty}
              onChange={(e) => setRemoveEmpty(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Remove empty lines
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map(({ mode, label }) => (
            <Button
              key={mode}
              size="sm"
              variant={sortMode === mode ? "default" : "outline"}
              onClick={() => setSortMode(mode)}
            >
              {mode === "asc" && <ArrowUpAZ className="h-4 w-4" />}
              {mode === "desc" && <ArrowDownZA className="h-4 w-4" />}
              {label}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ListFilter className="h-4 w-4 text-muted-foreground" /> Output
          </p>
          <div className="flex items-center gap-2">
            <CopyButton value={result.output} size="sm" variant="outline" />
            <Button size="sm" onClick={handleSave} disabled={!result.output}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {result.linesIn.toLocaleString()} lines in, {result.linesOut.toLocaleString()} lines out (
          {result.duplicatesRemoved.toLocaleString()} duplicates removed)
        </p>
        <div className="min-h-[200px] whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-3 font-mono text-sm">
          {result.output || <span className="text-muted-foreground">Output will appear here.</span>}
        </div>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="duplicate-line-remover" onRestore={restoreResult} />
    </div>
  );
}

"use client";

import * as React from "react";
import { GitCompareArrows, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

type DiffOp = "equal" | "added" | "removed";

interface DiffLine {
  op: DiffOp;
  text: string;
}

function diffLines(original: string[], changed: string[]): DiffLine[] {
  const n = original.length;
  const m = changed.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        original[i] === changed[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (original[i] === changed[j]) {
      result.push({ op: "equal", text: original[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      result.push({ op: "removed", text: original[i] });
      i++;
    } else {
      result.push({ op: "added", text: changed[j] });
      j++;
    }
  }
  while (i < n) {
    result.push({ op: "removed", text: original[i] });
    i++;
  }
  while (j < m) {
    result.push({ op: "added", text: changed[j] });
    j++;
  }
  return result;
}

const DIFF_LINE_CLASS: Record<DiffOp, string> = {
  equal: "bg-transparent",
  added: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  removed: "bg-destructive/15 text-destructive",
};

const DIFF_LINE_PREFIX: Record<DiffOp, string> = {
  equal: " ",
  added: "+",
  removed: "-",
};

interface StoredDiff {
  original: string;
  changed: string;
}

export default function TextDiffChecker() {
  useTrackTool("text-diff-checker");
  const [original, setOriginal] = React.useState("");
  const [changed, setChanged] = React.useState("");
  const [diff, setDiff] = React.useState<DiffLine[] | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const stats = React.useMemo(() => {
    if (!diff) return { added: 0, removed: 0 };
    return diff.reduce(
      (acc, line) => {
        if (line.op === "added") acc.added++;
        if (line.op === "removed") acc.removed++;
        return acc;
      },
      { added: 0, removed: 0 }
    );
  }, [diff]);

  const compare = async () => {
    const result = diffLines(original.split("\n"), changed.split("\n"));
    setDiff(result);

    const added = result.filter((l) => l.op === "added").length;
    const removed = result.filter((l) => l.op === "removed").length;

    await saveToolResult("text-diff-checker", {
      title: `${added} added, ${removed} removed`,
      summary: `${original.length.toLocaleString()} vs ${changed.length.toLocaleString()} characters`,
      data: JSON.stringify({ original, changed }),
    });
    historyRef.current?.refresh();
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (!item.data) return;
    try {
      const parsed = JSON.parse(item.data) as StoredDiff;
      setOriginal(parsed.original);
      setChanged(parsed.changed);
      setDiff(null);
    } catch {
      // Ignore malformed stored data.
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">Original text</p>
          <textarea
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            rows={10}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Card>
        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">Changed text</p>
          <textarea
            value={changed}
            onChange={(e) => setChanged(e.target.value)}
            rows={10}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Card>
      </div>

      <Button onClick={compare} disabled={!original && !changed}>
        <GitCompareArrows className="h-4 w-4" /> Compare
      </Button>

      {diff && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {stats.added} line{stats.added === 1 ? "" : "s"} added, {stats.removed} line
              {stats.removed === 1 ? "" : "s"} removed
            </p>
            <Button size="sm" variant="outline" onClick={compare}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          </div>
          <div className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs">
            {diff.map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap px-1 ${DIFF_LINE_CLASS[line.op]}`}>
                {DIFF_LINE_PREFIX[line.op]} {line.text}
              </div>
            ))}
          </div>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="text-diff-checker" onRestore={restoreResult} />
    </div>
  );
}

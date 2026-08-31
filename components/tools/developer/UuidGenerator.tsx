"use client";

import * as React from "react";
import { Fingerprint, RefreshCw, Save } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

function generateUuids(count: number): string[] {
  return Array.from({ length: count }, () => crypto.randomUUID());
}

export default function UuidGenerator() {
  useTrackTool("uuid-generator");
  const [count, setCount] = React.useState(5);
  const [uppercase, setUppercase] = React.useState(false);
  const [hyphens, setHyphens] = React.useState(true);
  const [uuids, setUuids] = React.useState<string[]>(() => generateUuids(5));
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const regenerate = () => setUuids(generateUuids(Math.min(Math.max(count, 1), 500)));

  const formatted = React.useMemo(
    () =>
      uuids.map((id) => {
        let value = hyphens ? id : id.replace(/-/g, "");
        if (uppercase) value = value.toUpperCase();
        return value;
      }),
    [uuids, uppercase, hyphens]
  );

  const allText = formatted.join("\n");

  const saveResult = React.useCallback(async () => {
    if (formatted.length === 0) return;
    await saveToolResult("uuid-generator", {
      title: `${formatted.length} UUID${formatted.length === 1 ? "" : "s"} generated`,
      summary: hyphens ? "Standard hyphenated format" : "No hyphens",
      data: allText,
    });
    historyRef.current?.refresh();
  }, [formatted.length, hyphens, allText]);

  const restoreResult = (item: ToolHistoryItem) => {
    if (item.data) setUuids(item.data.split("\n").filter(Boolean));
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Count</span>
          <input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
            className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={hyphens}
            onChange={(e) => setHyphens(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Hyphens
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={uppercase}
            onChange={(e) => setUppercase(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Uppercase
        </label>
        <Button className="ml-auto" onClick={regenerate}>
          <RefreshCw className="h-4 w-4" /> Generate
        </Button>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Fingerprint className="h-4 w-4 text-muted-foreground" /> {formatted.length} UUIDs
          </p>
          <div className="flex gap-2">
            <CopyButton value={allText} size="sm" variant="outline">
              Copy all
            </CopyButton>
            <Button size="sm" variant="outline" onClick={saveResult} disabled={formatted.length === 0}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          </div>
        </div>
        <div className="max-h-96 space-y-1 overflow-auto rounded-lg border border-border bg-muted/20 p-3">
          {formatted.map((id, i) => (
            <div key={`${id}-${i}`} className="flex items-center justify-between gap-2 font-mono text-xs">
              <span className="truncate">{id}</span>
              <CopyButton value={id} size="sm" variant="ghost" />
            </div>
          ))}
        </div>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="uuid-generator" onRestore={restoreResult} />
    </div>
  );
}

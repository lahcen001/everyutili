"use client";

import * as React from "react";
import { UserCheck, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

function parseNames(input: string): string[] {
  return input
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function pickRandom<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

export default function RandomNamePicker() {
  useTrackTool("random-name-picker");
  const [input, setInput] = React.useState("Alice\nBob\nCharlie\nDiana\nEthan");
  const [pickCount, setPickCount] = React.useState(1);
  const [picked, setPicked] = React.useState<string[] | null>(null);
  const [removeAfterPick, setRemoveAfterPick] = React.useState(false);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const names = React.useMemo(() => parseNames(input), [input]);

  const pick = () => {
    const result = pickRandom(names, Math.min(pickCount, names.length));
    setPicked(result);
    if (removeAfterPick) {
      // Remove exactly the picked entries (handles duplicate names in the
      // list correctly, unlike a plain value-based filter).
      const pickedCopy = [...result];
      const nextNames = names.filter((n) => {
        const idx = pickedCopy.indexOf(n);
        if (idx === -1) return true;
        pickedCopy.splice(idx, 1);
        return false;
      });
      setInput(nextNames.join("\n"));
    }
  };

  const handleSave = async () => {
    if (!picked) return;
    await saveToolResult("random-name-picker", {
      title: picked.length === 1 ? picked[0] : `${picked.length} names picked`,
      summary: picked.join(", "),
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
          <span className="text-sm font-medium">Names to pick from</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
            placeholder="One name per line…"
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <p className="text-xs text-muted-foreground">{names.length} name{names.length === 1 ? "" : "s"}</p>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">How many to pick</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, names.length)}
              value={pickCount}
              onChange={(e) => setPickCount(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={removeAfterPick}
              onChange={(e) => setRemoveAfterPick(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Remove picked names from the list
          </label>
        </div>

        <Button onClick={pick} disabled={names.length === 0}>
          <UserCheck className="h-4 w-4" />
          Pick randomly
        </Button>
      </Card>

      {picked && picked.length > 0 && (
        <Card className="space-y-3 p-6">
          <div className="flex flex-wrap justify-center gap-2">
            {picked.map((name, i) => (
              <span
                key={i}
                className="rounded-full border border-primary bg-primary/10 px-4 py-2 text-lg font-semibold text-primary"
              >
                {name}
              </span>
            ))}
          </div>
          <div className="flex justify-center gap-2">
            <CopyButton value={picked.join(", ")} size="sm" variant="outline" />
            <Button size="sm" variant="outline" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="random-name-picker" onRestore={restoreResult} />
    </div>
  );
}

"use client";

import * as React from "react";
import { Shuffle, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

function parseLines(input: string): string[] {
  return input
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function ListShuffler() {
  useTrackTool("list-shuffler");
  const [input, setInput] = React.useState("Alice\nBob\nCharlie\nDiana\nEthan");
  const [shuffled, setShuffled] = React.useState<string[] | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const items = React.useMemo(() => parseLines(input), [input]);

  const doShuffle = () => {
    setShuffled(shuffle(items));
  };

  const handleSave = async () => {
    if (!shuffled) return;
    await saveToolResult("list-shuffler", {
      title: `${shuffled.length} items shuffled`,
      summary: shuffled.join(", "),
      data: shuffled.join("\n"),
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
          <span className="text-sm font-medium">List to shuffle</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
            placeholder="One item per line…"
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <p className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</p>
        <Button onClick={doShuffle} disabled={items.length < 2}>
          <Shuffle className="h-4 w-4" />
          Shuffle
        </Button>
      </Card>

      {shuffled && (
        <Card className="space-y-3 p-4">
          <ol className="space-y-1 text-sm">
            {shuffled.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            <CopyButton value={shuffled.join("\n")} size="sm" variant="outline" />
            <Button size="sm" variant="outline" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="list-shuffler" onRestore={restoreResult} />
    </div>
  );
}

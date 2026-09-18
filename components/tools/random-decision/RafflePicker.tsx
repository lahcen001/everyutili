"use client";

import * as React from "react";
import { Ticket, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

function parseEntries(input: string): string[] {
  return input
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function drawWinners(entries: string[], count: number): string[] {
  const pool = [...entries];
  const winners: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return winners;
}

export default function RafflePicker() {
  useTrackTool("raffle-picker");
  const [input, setInput] = React.useState(
    "Alice\nAlice\nBob\nCharlie\nCharlie\nCharlie\nDiana"
  );
  const [winnerCount, setWinnerCount] = React.useState(1);
  const [drawing, setDrawing] = React.useState(false);
  const [winners, setWinners] = React.useState<string[] | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const entries = React.useMemo(() => parseEntries(input), [input]);
  const uniqueCount = React.useMemo(() => new Set(entries).size, [entries]);

  const draw = () => {
    if (drawing || entries.length === 0) return;
    setDrawing(true);
    setWinners(null);
    window.setTimeout(() => {
      setWinners(drawWinners(entries, Math.min(winnerCount, entries.length)));
      setDrawing(false);
    }, 900);
  };

  const handleSave = async () => {
    if (!winners) return;
    await saveToolResult("raffle-picker", {
      title: winners.length === 1 ? `Winner: ${winners[0]}` : `${winners.length} winners drawn`,
      summary: winners.join(", "),
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
          <span className="text-sm font-medium">Raffle entries</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
            placeholder="One entry per line — list a name multiple times to give it more tickets…"
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          {entries.length} ticket{entries.length === 1 ? "" : "s"}
          {uniqueCount !== entries.length && ` · ${uniqueCount} unique entrants`}
        </p>

        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Number of winners</span>
          <input
            type="number"
            min={1}
            max={Math.max(1, entries.length)}
            value={winnerCount}
            onChange={(e) => setWinnerCount(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </label>

        <Button onClick={draw} disabled={drawing || entries.length === 0}>
          <Ticket className="h-4 w-4" />
          {drawing ? "Drawing…" : "Draw winners"}
        </Button>
      </Card>

      {drawing && (
        <Card className="flex items-center justify-center p-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Ticket className="h-5 w-5 animate-bounce" />
            Shuffling the tickets…
          </div>
        </Card>
      )}

      {winners && !drawing && (
        <Card className="space-y-3 p-6">
          <div className="flex flex-wrap justify-center gap-2">
            {winners.map((name, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-4 py-2 text-lg font-semibold text-primary"
              >
                <Ticket className="h-4 w-4" />
                {name}
              </span>
            ))}
          </div>
          <div className="flex justify-center gap-2">
            <CopyButton value={winners.join(", ")} size="sm" variant="outline" />
            <Button size="sm" variant="outline" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="raffle-picker" onRestore={restoreResult} />
    </div>
  );
}

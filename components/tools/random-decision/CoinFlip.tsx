"use client";

import * as React from "react";
import { Coins, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

type Side = "heads" | "tails";

export default function CoinFlip() {
  useTrackTool("coin-flip");
  const [result, setResult] = React.useState<Side | null>(null);
  const [flipping, setFlipping] = React.useState(false);
  const [history, setHistory] = React.useState<Side[]>([]);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const tally = React.useMemo(() => {
    const heads = history.filter((s) => s === "heads").length;
    return { heads, tails: history.length - heads };
  }, [history]);

  const flip = () => {
    if (flipping) return;
    setFlipping(true);
    const outcome: Side = Math.random() < 0.5 ? "heads" : "tails";
    window.setTimeout(() => {
      setResult(outcome);
      setHistory((prev) => [...prev, outcome]);
      setFlipping(false);
    }, 600);
  };

  const reset = () => {
    setResult(null);
    setHistory([]);
  };

  const handleSave = async () => {
    if (!result) return;
    await saveToolResult("coin-flip", {
      title: result === "heads" ? "Heads" : "Tails",
      summary: `${tally.heads} heads, ${tally.tails} tails over ${history.length} flip${history.length === 1 ? "" : "s"}`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-col items-center gap-6 p-8">
        <div
          className={cn(
            "flex h-32 w-32 items-center justify-center rounded-full border-4 border-primary bg-primary/10 text-lg font-bold uppercase tracking-wide text-primary shadow-lg transition-transform duration-300",
            flipping && "animate-spin"
          )}
        >
          {flipping ? <Coins className="h-10 w-10" /> : (result ?? "Flip")}
        </div>

        <div className="flex gap-2">
          <Button onClick={flip} disabled={flipping}>
            <Coins className="h-4 w-4" />
            {flipping ? "Flipping…" : "Flip the coin"}
          </Button>
          {result && (
            <Button variant="outline" onClick={handleSave}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          )}
        </div>

        {history.length > 0 && (
          <div className="w-full space-y-2 text-center">
            <p className="text-sm text-muted-foreground">
              {tally.heads} heads · {tally.tails} tails · {history.length} flip
              {history.length === 1 ? "" : "s"}
            </p>
            <div className="flex flex-wrap justify-center gap-1">
              {history.slice(-30).map((side, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold uppercase",
                    side === "heads"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                  title={side}
                >
                  {side === "heads" ? "H" : "T"}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Reset tally
            </button>
          </div>
        )}
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="coin-flip" />
    </div>
  );
}

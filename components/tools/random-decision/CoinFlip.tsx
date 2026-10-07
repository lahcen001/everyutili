"use client";

import * as React from "react";
import { Coins, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { RandomStage, type Reveal } from "@/components/tools/random-decision/RandomStage";

type Side = "heads" | "tails";

export default function CoinFlip() {
  useTrackTool("coin-flip");
  const [coins, setCoins] = React.useState(1);
  const [result, setResult] = React.useState<Side[] | null>(null);
  const [flipping, setFlipping] = React.useState(false);
  const [history, setHistory] = React.useState<Side[]>([]);
  const [reveal, setReveal] = React.useState<Reveal | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const tally = React.useMemo(() => {
    const heads = history.filter((s) => s === "heads").length;
    return { heads, tails: history.length - heads };
  }, [history]);

  const flip = () => {
    if (flipping) return;
    setFlipping(true);
    const outcome: Side[] = Array.from({ length: coins }, () => (Math.random() < 0.5 ? "heads" : "tails"));
    window.setTimeout(() => {
      setResult(outcome);
      setHistory((prev) => [...prev, ...outcome]);
      setFlipping(false);
      const h = outcome.filter((s) => s === "heads").length;
      setReveal({
        id: Date.now(),
        items: [outcome.length === 1 ? (outcome[0] === "heads" ? "Heads" : "Tails") : `${h} heads · ${outcome.length - h} tails`],
        label: outcome.length === 1 ? "It's" : "Result",
        color: outcome.length === 1 ? (outcome[0] === "heads" ? "#f59e0b" : "#3b82f6") : "#7c74ff",
        icon: <Coins />,
      });
    }, 600);
  };

  const reset = () => {
    setResult(null);
    setHistory([]);
  };

  const handleSave = async () => {
    if (!result) return;
    const heads = result.filter((r) => r === "heads").length;
    await saveToolResult("coin-flip", {
      title: result.length === 1 ? (result[0] === "heads" ? "Heads" : "Tails") : `${heads} heads, ${result.length - heads} tails`,
      summary: `${tally.heads} heads, ${tally.tails} tails over ${history.length} flip${history.length === 1 ? "" : "s"}`,
    });
    historyRef.current?.refresh();
  };

  const coinBlock = (isFullscreen: boolean) => (
    <div className="relative flex flex-col items-center gap-6 p-8">
      <div className="flex max-w-full flex-wrap items-center justify-center gap-3">
        {Array.from({ length: coins }, (_, i) => {
          const side = result?.[i];
          const big = coins === 1;
          return (
            <div
              key={i}
              className={cn(
                "flex items-center justify-center rounded-full border-4 border-primary bg-primary/10 font-bold uppercase tracking-wide text-primary shadow-lg transition-transform duration-300",
                big ? (isFullscreen ? "h-56 w-56 text-3xl" : "h-32 w-32 text-lg") : isFullscreen ? "h-24 w-24 text-base" : "h-16 w-16 text-xs",
                flipping && "animate-spin"
              )}
            >
              {flipping ? <Coins className={big ? (isFullscreen ? "h-16 w-16" : "h-10 w-10") : "h-6 w-6"} /> : (side ?? (big ? "Flip" : ""))}
            </div>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-sm">
        Coins
        <input type="number" min={1} max={10} value={coins} onChange={(e) => { setCoins(Math.min(10, Math.max(1, Math.floor(Number(e.target.value)) || 1))); setResult(null); }} className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-sm" aria-label="Number of coins" />
      </label>

      <div className="flex flex-wrap justify-center gap-2">
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
          <p className={isFullscreen ? "text-base text-muted-foreground" : "text-sm text-muted-foreground"}>
            {tally.heads} heads · {tally.tails} tails · {history.length} flip
            {history.length === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap justify-center gap-1">
            {history.slice(-30).map((side, i) => (
              <span
                key={i}
                className={cn(
                  "flex items-center justify-center rounded-full font-semibold uppercase",
                  isFullscreen ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]",
                  side === "heads" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
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
    </div>
  );

  return (
    <div className="space-y-6">
      <RandomStage reveal={reveal} onAgain={flip} againLabel="Flip again" onSave={handleSave}>
        {coinBlock}
      </RandomStage>

      <ToolHistoryList ref={historyRef} toolSlug="coin-flip" />
    </div>
  );
}

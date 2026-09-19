"use client";

import * as React from "react";
import { Coins, Save, Maximize2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { Confetti } from "@/components/tools/random-decision/Confetti";

type Side = "heads" | "tails";

export default function CoinFlip() {
  useTrackTool("coin-flip");
  const [result, setResult] = React.useState<Side | null>(null);
  const [flipping, setFlipping] = React.useState(false);
  const [history, setHistory] = React.useState<Side[]>([]);
  const [celebrate, setCelebrate] = React.useState(0);
  const [fullscreen, setFullscreen] = React.useState(false);
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
      setCelebrate((c) => c + 1);
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

  const coinBlock = (isFullscreen: boolean) => (
    <div className="relative flex flex-col items-center gap-6 p-8">
      <Confetti fire={celebrate} />
      <div
        className={cn(
          "flex items-center justify-center rounded-full border-4 border-primary bg-primary/10 font-bold uppercase tracking-wide text-primary shadow-lg transition-transform duration-300",
          isFullscreen ? "h-56 w-56 text-3xl" : "h-32 w-32 text-lg",
          flipping && "animate-spin"
        )}
      >
        {flipping ? <Coins className={isFullscreen ? "h-16 w-16" : "h-10 w-10"} /> : (result ?? "Flip")}
      </div>

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
        {!isFullscreen && (
          <Button variant="outline" onClick={() => setFullscreen(true)}>
            <Maximize2 className="h-4 w-4" />
            Fullscreen
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
      <Card className="overflow-hidden">{coinBlock(false)}</Card>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="flex h-[90vh] w-full max-w-[95vw] flex-col items-center justify-center gap-0 overflow-hidden p-0 sm:max-w-[95vw]">
          <DialogTitle className="sr-only">Coin flip — fullscreen</DialogTitle>
          {coinBlock(true)}
        </DialogContent>
      </Dialog>

      <ToolHistoryList ref={historyRef} toolSlug="coin-flip" />
    </div>
  );
}

"use client";

import * as React from "react";
import { HelpCircle, Save, Maximize2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { Confetti } from "@/components/tools/random-decision/Confetti";

export default function YesNoDecisionMaker() {
  useTrackTool("yes-no-decision-maker");
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState<"Yes" | "No" | null>(null);
  const [deciding, setDeciding] = React.useState(false);
  const [celebrate, setCelebrate] = React.useState(0);
  const [fullscreen, setFullscreen] = React.useState(false);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const decide = () => {
    if (deciding) return;
    setDeciding(true);
    window.setTimeout(() => {
      const outcome = Math.random() < 0.5 ? "Yes" : "No";
      setAnswer(outcome);
      setDeciding(false);
      // Only a "Yes" reads as a celebration-worthy reveal — confetti on "No"
      // would feel like the tool is mocking the user.
      if (outcome === "Yes") setCelebrate((c) => c + 1);
    }, 500);
  };

  const handleSave = async () => {
    if (!answer) return;
    await saveToolResult("yes-no-decision-maker", {
      title: answer,
      summary: question.trim() ? question.trim() : "Random yes/no decision",
    });
    historyRef.current?.refresh();
  };

  const answerBlock = (isFullscreen: boolean) => (
    <div className="relative flex flex-col items-center gap-6 p-8">
      <Confetti fire={celebrate} />
      <div
        className={cn(
          "flex items-center justify-center rounded-full border-4 font-bold transition-all duration-300",
          isFullscreen ? "h-56 w-56 text-5xl" : "h-32 w-32 text-2xl",
          answer === "Yes" && "border-emerald-500 bg-emerald-500/10 text-emerald-600",
          answer === "No" && "border-destructive bg-destructive/10 text-destructive",
          !answer && "border-border bg-muted/30 text-muted-foreground",
          deciding && "animate-pulse"
        )}
      >
        {deciding ? "…" : (answer ?? "?")}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={decide} disabled={deciding}>
          <HelpCircle className="h-4 w-4" />
          {deciding ? "Deciding…" : "Ask the decision maker"}
        </Button>
        {answer && (
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
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="flex flex-col items-center gap-4 p-6">
        <label className="block w-full max-w-md space-y-1.5">
          <span className="text-sm font-medium">Your question (optional)</span>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Should I…?"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
      </Card>

      <Card className="overflow-hidden">{answerBlock(false)}</Card>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="flex h-[90vh] w-full max-w-[95vw] flex-col items-center justify-center gap-0 overflow-hidden p-0 sm:max-w-[95vw]">
          <DialogTitle className="sr-only">Yes or no decision maker — fullscreen</DialogTitle>
          {answerBlock(true)}
        </DialogContent>
      </Dialog>

      <ToolHistoryList ref={historyRef} toolSlug="yes-no-decision-maker" />
    </div>
  );
}

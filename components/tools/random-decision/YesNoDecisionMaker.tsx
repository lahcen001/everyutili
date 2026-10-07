"use client";

import * as React from "react";
import { HelpCircle, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { RandomStage, type Reveal } from "@/components/tools/random-decision/RandomStage";

export default function YesNoDecisionMaker() {
  useTrackTool("yes-no-decision-maker");
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState<"Yes" | "No" | null>(null);
  const [deciding, setDeciding] = React.useState(false);
  const [reveal, setReveal] = React.useState<Reveal | null>(null);
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
      setReveal({
        id: Date.now(),
        items: [outcome],
        label: "The answer is",
        sub: question.trim() || undefined,
        color: outcome === "Yes" ? "#10b981" : "#ef4444",
        icon: <HelpCircle />,
        confetti: outcome === "Yes",
      });
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

      <RandomStage reveal={reveal} onAgain={decide} againLabel="Ask again" onSave={handleSave}>
        {answerBlock}
      </RandomStage>

      <ToolHistoryList ref={historyRef} toolSlug="yes-no-decision-maker" />
    </div>
  );
}

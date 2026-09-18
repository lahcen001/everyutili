"use client";

import * as React from "react";
import { HelpCircle, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

export default function YesNoDecisionMaker() {
  useTrackTool("yes-no-decision-maker");
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState<"Yes" | "No" | null>(null);
  const [deciding, setDeciding] = React.useState(false);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const decide = () => {
    if (deciding) return;
    setDeciding(true);
    window.setTimeout(() => {
      setAnswer(Math.random() < 0.5 ? "Yes" : "No");
      setDeciding(false);
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

  return (
    <div className="space-y-6">
      <Card className="flex flex-col items-center gap-6 p-8">
        <label className="block w-full max-w-md space-y-1.5">
          <span className="text-sm font-medium">Your question (optional)</span>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Should I…?"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        <div
          className={cn(
            "flex h-32 w-32 items-center justify-center rounded-full border-4 text-2xl font-bold transition-all duration-300",
            answer === "Yes" && "border-emerald-500 bg-emerald-500/10 text-emerald-600",
            answer === "No" && "border-destructive bg-destructive/10 text-destructive",
            !answer && "border-border bg-muted/30 text-muted-foreground",
            deciding && "animate-pulse"
          )}
        >
          {deciding ? "…" : (answer ?? "?")}
        </div>

        <div className="flex gap-2">
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
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="yes-no-decision-maker" />
    </div>
  );
}

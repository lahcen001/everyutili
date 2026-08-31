"use client";

import * as React from "react";
import { AlignLeft, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import {
  ToolHistoryList,
  type ToolHistoryListHandle,
} from "@/components/tools/shared/ToolHistoryList";

const AVERAGE_WPM = 200;

function countStats(text: string) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  const sentences = trimmed ? (trimmed.match(/[^.!?]+[.!?]+/g)?.length ?? (trimmed ? 1 : 0)) : 0;
  const paragraphs = trimmed ? trimmed.split(/\n+/).filter((p) => p.trim().length > 0).length : 0;
  const readingTimeMinutes = words / AVERAGE_WPM;

  return { words, characters, charactersNoSpaces, sentences, paragraphs, readingTimeMinutes };
}

function formatReadingTime(minutes: number) {
  if (minutes < 1) return "< 1 min";
  const rounded = Math.round(minutes);
  return `${rounded} min${rounded === 1 ? "" : "s"}`;
}

export default function WordCounter() {
  useTrackTool("word-counter");
  const [text, setText] = React.useState("");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const stats = React.useMemo(() => countStats(text), [text]);

  const saveResult = async () => {
    if (!text.trim()) return;
    const preview = text.trim().slice(0, 60);
    await saveToolResult("word-counter", {
      title: preview.length < text.trim().length ? `${preview}…` : preview || "Text snapshot",
      summary: `${stats.words} words · ${stats.characters} characters · ${formatReadingTime(stats.readingTimeMinutes)} read`,
      data: text,
    });
    historyRef.current?.refresh();
  };

  const handleRestore = (item: ToolHistoryItem) => {
    if (item.data) setText(item.data);
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder="Paste or type your text here…"
          className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </Card>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Words", value: stats.words },
          { label: "Characters", value: stats.characters },
          { label: "Chars (no spaces)", value: stats.charactersNoSpaces },
          { label: "Sentences", value: stats.sentences },
          { label: "Paragraphs", value: stats.paragraphs },
          { label: "Reading time", value: formatReadingTime(stats.readingTimeMinutes) },
        ].map((item) => (
          <Card key={item.label} className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{item.value}</p>
          </Card>
        ))}
      </div>

      {!text && (
        <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <AlignLeft className="h-4 w-4" /> Start typing or paste text above to see live stats
        </Card>
      )}

      {text.trim() && (
        <Button variant="outline" onClick={saveResult}>
          <Save className="h-4 w-4" /> Save result
        </Button>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="word-counter" onRestore={handleRestore} />
    </div>
  );
}

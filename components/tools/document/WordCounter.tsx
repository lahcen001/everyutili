"use client";

import * as React from "react";
import { AlignLeft, Eraser, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { LIMIT_PRESETS, analyzeText, formatDuration, keywordStats, topWords } from "@/lib/textStats";
import { cn } from "@/lib/utils";

export default function WordCounter() {
  useTrackTool("word-counter");
  const [text, setText] = React.useState("");
  const [limitId, setLimitId] = React.useState("none");
  const [customLimit, setCustomLimit] = React.useState(500);
  const [ignoreCommon, setIgnoreCommon] = React.useState(true);
  const [keyword, setKeyword] = React.useState("");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const stats = analyzeText(text);
  const frequent = topWords(text, 10, ignoreCommon);
  const found = keywordStats(text, keyword);
  const limit = limitId === "none" ? null : limitId === "custom" ? Math.max(1, customLimit) : (LIMIT_PRESETS.find((p) => p.id === limitId)?.characters ?? null);
  const remaining = limit === null ? null : limit - stats.characters;

  const saveResult = async () => {
    if (!text.trim()) return;
    const preview = text.trim().slice(0, 60);
    await saveToolResult("word-counter", {
      title: preview.length < text.trim().length ? `${preview}…` : preview || "Text snapshot",
      summary: `${stats.words} words · ${stats.characters} characters · ${formatDuration(stats.readingMinutes)} read`,
      data: text,
    });
    historyRef.current?.refresh();
  };

  const handleRestore = (item: ToolHistoryItem) => {
    if (item.data) setText(item.data);
  };

  const tiles = [
    { label: "Words", value: stats.words.toLocaleString() },
    { label: "Characters", value: stats.characters.toLocaleString() },
    { label: "Chars (no spaces)", value: stats.charactersNoSpaces.toLocaleString() },
    { label: "Sentences", value: stats.sentences.toLocaleString() },
    { label: "Paragraphs", value: stats.paragraphs.toLocaleString() },
    { label: "Unique words", value: stats.uniqueWords.toLocaleString() },
    { label: "Reading time", value: formatDuration(stats.readingMinutes) },
    { label: "Speaking time", value: formatDuration(stats.speakingMinutes) },
    { label: "Avg. word length", value: stats.averageWordLength ? stats.averageWordLength.toFixed(1) : "0" },
    { label: "Avg. sentence length", value: stats.averageSentenceLength ? `${stats.averageSentenceLength.toFixed(1)} words` : "0" },
  ];

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder="Paste or type your text here…"
          aria-label="Text to analyze"
          className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            Limit
            <select value={limitId} onChange={(e) => setLimitId(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
              <option value="none">None</option>
              {LIMIT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom (characters)…</option>
            </select>
          </label>
          {limitId === "custom" && (
            <input
              type="number"
              min={1}
              value={customLimit}
              onChange={(e) => setCustomLimit(Math.floor(Number(e.target.value)) || 1)}
              aria-label="Custom character limit"
              className="h-9 w-28 rounded-lg border border-border bg-background px-2 text-sm"
            />
          )}
          <div className="ml-auto flex gap-2">
            <CopyButton value={text} variant="outline" size="sm" disabled={!text}>
              Copy text
            </CopyButton>
            <Button variant="ghost" size="sm" onClick={() => setText("")} disabled={!text}>
              <Eraser className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </div>
        {limit !== null && (
          <div className="space-y-1" role="status">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all", remaining! < 0 ? "bg-destructive" : remaining! < limit * 0.1 ? "bg-amber-500" : "bg-primary")} style={{ width: `${Math.min(100, (stats.characters / limit) * 100)}%` }} />
            </div>
            <p className={cn("text-xs", remaining! < 0 ? "font-medium text-destructive" : "text-muted-foreground")}>
              {remaining! >= 0 ? `${remaining!.toLocaleString()} characters left of ${limit.toLocaleString()}` : `${Math.abs(remaining!).toLocaleString()} characters over the ${limit.toLocaleString()} limit`}
            </p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((item) => (
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

      {stats.words > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Most used words</p>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={ignoreCommon} onChange={(e) => setIgnoreCommon(e.target.checked)} className="h-3.5 w-3.5 rounded border-border" />
                Ignore common English words
              </label>
            </div>
            {frequent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No repeated words yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {frequent.map((w) => (
                  <li key={w.word} className="flex items-center gap-2 text-sm">
                    <span className="w-28 truncate font-medium">{w.word}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(w.count / frequent[0].count) * 100}%` }} />
                    </div>
                    <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                      {w.count}× · {w.percent.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="space-y-3 p-4">
            <p className="text-sm font-medium">Keyword density</p>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Type a word or phrase to check"
              aria-label="Keyword or phrase"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            {keyword.trim() ? (
              <p className="text-sm">
                <span className="font-semibold">&ldquo;{keyword.trim()}&rdquo;</span> appears <span className="font-semibold tabular-nums">{found.count}</span> time{found.count === 1 ? "" : "s"} —{" "}
                <span className="font-semibold tabular-nums">{found.density.toFixed(2)}%</span> of all words.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Whole words only, upper or lower case. For SEO, a focus keyword is often used around 1–2% of the time.</p>
            )}
          </Card>
        </div>
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

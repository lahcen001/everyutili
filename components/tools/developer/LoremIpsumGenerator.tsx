"use client";

import * as React from "react";
import { Type } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit", "sed", "do",
  "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua", "enim",
  "ad", "minim", "veniam", "quis", "nostrud", "exercitation", "ullamco", "laboris", "nisi",
  "aliquip", "ex", "ea", "commodo", "consequat", "duis", "aute", "irure", "in", "reprehenderit",
  "voluptate", "velit", "esse", "cillum", "eu", "fugiat", "nulla", "pariatur", "excepteur",
  "sint", "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia",
  "deserunt", "mollit", "anim", "id", "est", "laborum",
];

type Mode = "words" | "sentences" | "paragraphs";

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function generateSentence(minWords = 6, maxWords = 14) {
  const count = minWords + Math.floor(Math.random() * (maxWords - minWords));
  const words = Array.from({ length: count }, () => randomWord());
  return capitalize(words.join(" ")) + ".";
}

function generateParagraph(sentenceCount = 5) {
  return Array.from({ length: sentenceCount }, () => generateSentence()).join(" ");
}

function generate(mode: Mode, count: number, startWithLorem: boolean): string {
  let result: string;
  if (mode === "words") {
    const words = Array.from({ length: count }, () => randomWord());
    if (startWithLorem) {
      words[0] = "lorem";
      if (words.length > 1) words[1] = "ipsum";
    }
    result = capitalize(words.join(" ")) + ".";
  } else if (mode === "sentences") {
    const sentences = Array.from({ length: count }, () => generateSentence());
    if (startWithLorem) sentences[0] = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
    result = sentences.join(" ");
  } else {
    const paragraphs = Array.from({ length: count }, () => generateParagraph());
    if (startWithLorem) {
      paragraphs[0] = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " + paragraphs[0];
    }
    result = paragraphs.join("\n\n");
  }
  return result;
}

export default function LoremIpsumGenerator() {
  useTrackTool("lorem-ipsum-generator");
  const [mode, setMode] = React.useState<Mode>("paragraphs");
  const [count, setCount] = React.useState(3);
  const [startWithLorem, setStartWithLorem] = React.useState(true);
  const [output, setOutput] = React.useState(() => generate("paragraphs", 3, true));
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const regenerate = React.useCallback(async () => {
    const clampedCount = Math.min(Math.max(count, 1), 100);
    const next = generate(mode, clampedCount, startWithLorem);
    setOutput(next);
    await saveToolResult("lorem-ipsum-generator", {
      title: `${clampedCount} Lorem Ipsum ${mode}`,
      summary: `${next.length.toLocaleString()} chars`,
      data: next,
    });
    historyRef.current?.refresh();
  }, [mode, count, startWithLorem]);

  const restoreResult = (item: ToolHistoryItem) => {
    if (item.data) setOutput(item.data);
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="flex overflow-hidden rounded-lg border border-border">
          {(["words", "sentences", "paragraphs"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Count</span>
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
            className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={startWithLorem}
            onChange={(e) => setStartWithLorem(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Start with &quot;Lorem ipsum…&quot;
        </label>
        <button
          onClick={regenerate}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Type className="h-4 w-4" /> Generate
        </button>
      </Card>

      <Card className="space-y-3 p-4">
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-3 font-sans text-sm">
          {output}
        </pre>
        <CopyButton value={output} variant="secondary" disabled={!output}>
          Copy text
        </CopyButton>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="lorem-ipsum-generator" onRestore={restoreResult} />
    </div>
  );
}

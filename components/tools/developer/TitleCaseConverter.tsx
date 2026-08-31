"use client";

import * as React from "react";
import { Heading } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

type Style = "AP" | "APA" | "Chicago" | "MLA";

const STYLES: Style[] = ["AP", "APA", "Chicago", "MLA"];

const ARTICLES = new Set(["a", "an", "the"]);
const COORDINATING_CONJUNCTIONS = new Set(["and", "but", "or", "for", "nor", "so", "yet"]);
const SHORT_PREPOSITIONS = new Set([
  "in", "on", "at", "by", "up", "to", "of", "off", "out", "as", "if", "per",
]);
const ALL_PREPOSITIONS = new Set([
  ...SHORT_PREPOSITIONS,
  "about", "above", "across", "after", "against", "along", "among", "around",
  "before", "behind", "below", "beneath", "beside", "between", "beyond",
  "down", "during", "into", "near", "over", "since", "through", "throughout",
  "toward", "towards", "under", "underneath", "until", "upon", "with", "within",
  "without", "from",
]);
const APA_MINOR_WORDS = new Set([...ARTICLES, ...COORDINATING_CONJUNCTIONS, ...SHORT_PREPOSITIONS]);
const CHICAGO_MLA_MINOR_WORDS = new Set([...ARTICLES, ...COORDINATING_CONJUNCTIONS, ...ALL_PREPOSITIONS]);

function capitalize(word: string): string {
  const firstLetterMatch = word.match(/[a-zA-Z]/);
  if (!firstLetterMatch || firstLetterMatch.index === undefined) return word;
  const i = firstLetterMatch.index;
  return word.slice(0, i) + word[i].toUpperCase() + word.slice(i + 1);
}

function lowercase(word: string): string {
  return word.toLowerCase();
}

function titleCaseByStyle(style: Style, text: string): string {
  const tokens = text.split(/(\s+)/);
  const wordTokenIdx = tokens.reduce<number[]>((acc, t, i) => {
    if (/\S/.test(t)) acc.push(i);
    return acc;
  }, []);
  const firstIdx = wordTokenIdx[0];
  const lastIdx = wordTokenIdx[wordTokenIdx.length - 1];

  return tokens
    .map((token, idx) => {
      if (!/\S/.test(token)) return token;
      const bare = token.replace(/[.,!?;:'")\]]+$/, "");
      const stripped = bare.toLowerCase().replace(/^[("[]+/, "");
      const isFirst = idx === firstIdx;
      const isLast = idx === lastIdx;
      const prevWordIdx = [...wordTokenIdx].reverse().find((i) => i < idx);
      const afterColon = prevWordIdx !== undefined && /:$/.test(tokens[prevWordIdx]);

      let shouldCapitalize: boolean;
      switch (style) {
        case "AP":
          shouldCapitalize =
            isFirst ||
            isLast ||
            afterColon ||
            !(ARTICLES.has(stripped) || COORDINATING_CONJUNCTIONS.has(stripped) || SHORT_PREPOSITIONS.has(stripped));
          break;
        case "APA":
          shouldCapitalize =
            isFirst || isLast || afterColon || stripped.length >= 4 || !APA_MINOR_WORDS.has(stripped);
          break;
        case "Chicago":
        case "MLA":
          shouldCapitalize = isFirst || isLast || afterColon || !CHICAGO_MLA_MINOR_WORDS.has(stripped);
          break;
        default:
          shouldCapitalize = true;
      }

      return shouldCapitalize ? capitalize(token.toLowerCase()) : lowercase(token);
    })
    .join("");
}

export default function TitleCaseConverter() {
  useTrackTool("title-case-converter");
  const [input, setInput] = React.useState("the quick brown fox jumps over the lazy dog: a fable");
  const [output, setOutput] = React.useState("");
  const [activeStyle, setActiveStyle] = React.useState<Style | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const convert = async (style: Style) => {
    const converted = titleCaseByStyle(style, input);
    setOutput(converted);
    setActiveStyle(style);
    const preview = converted.length > 60 ? `${converted.slice(0, 60)}…` : converted;
    await saveToolResult("title-case-converter", {
      title: `${style} style: ${preview}`,
      summary: `${converted.length.toLocaleString()} characters`,
      data: converted,
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
          <span className="text-sm font-medium">Input text</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {STYLES.map((style) => (
            <Button
              key={style}
              size="sm"
              variant={activeStyle === style ? "default" : "outline"}
              onClick={() => convert(style)}
              disabled={!input}
            >
              {style}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Heading className="h-4 w-4 text-muted-foreground" /> Output
          </p>
          <CopyButton value={output} size="sm" variant="outline" disabled={!output} />
        </div>
        <div className="min-h-[120px] whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-3 text-sm">
          {output || <span className="text-muted-foreground">Pick a style above to convert your title.</span>}
        </div>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="title-case-converter" onRestore={restoreResult} />
    </div>
  );
}

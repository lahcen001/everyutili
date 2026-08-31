"use client";

import * as React from "react";
import { CaseSensitive } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

type CaseFormat =
  | "UPPERCASE"
  | "lowercase"
  | "Title Case"
  | "Sentence case"
  | "camelCase"
  | "PascalCase"
  | "snake_case"
  | "kebab-case";

const CASE_FORMATS: CaseFormat[] = [
  "UPPERCASE",
  "lowercase",
  "Title Case",
  "Sentence case",
  "camelCase",
  "PascalCase",
  "snake_case",
  "kebab-case",
];

function splitWords(text: string): string[] {
  return text
    .trim()
    .split(/[\s_-]+|(?=[A-Z][a-z])/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^|\s)([a-z])/g, (_match, boundary: string, char: string) => boundary + char.toUpperCase());
}

function toSentenceCase(text: string): string {
  const lower = text.toLowerCase();
  return lower.replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (match) => match.toUpperCase());
}

function toCamelCase(text: string): string {
  const words = splitWords(text).map((w) => w.toLowerCase());
  return words
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}

function toPascalCase(text: string): string {
  const words = splitWords(text).map((w) => w.toLowerCase());
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

function toSnakeCase(text: string): string {
  return splitWords(text)
    .map((w) => w.toLowerCase())
    .join("_");
}

function toKebabCase(text: string): string {
  return splitWords(text)
    .map((w) => w.toLowerCase())
    .join("-");
}

function applyCaseFormat(format: CaseFormat, text: string): string {
  switch (format) {
    case "UPPERCASE":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "Title Case":
      return toTitleCase(text);
    case "Sentence case":
      return toSentenceCase(text);
    case "camelCase":
      return toCamelCase(text);
    case "PascalCase":
      return toPascalCase(text);
    case "snake_case":
      return toSnakeCase(text);
    case "kebab-case":
      return toKebabCase(text);
    default:
      return text;
  }
}

export default function TextCaseConverter() {
  useTrackTool("text-case-converter");
  const [input, setInput] = React.useState("The Quick Brown Fox Jumps Over the Lazy Dog");
  const [output, setOutput] = React.useState("");
  const [activeFormat, setActiveFormat] = React.useState<CaseFormat | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const convert = async (format: CaseFormat) => {
    const converted = applyCaseFormat(format, input);
    setOutput(converted);
    setActiveFormat(format);
    await saveToolResult("text-case-converter", {
      title: format,
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
          {CASE_FORMATS.map((format) => (
            <Button
              key={format}
              size="sm"
              variant={activeFormat === format ? "default" : "outline"}
              onClick={() => convert(format)}
              disabled={!input}
            >
              {format}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CaseSensitive className="h-4 w-4 text-muted-foreground" /> Output
          </p>
          <CopyButton value={output} size="sm" variant="outline" />
        </div>
        <div className="min-h-[120px] whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-3 text-sm">
          {output || <span className="text-muted-foreground">Pick a case format above to convert your text.</span>}
        </div>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="text-case-converter" onRestore={restoreResult} />
    </div>
  );
}

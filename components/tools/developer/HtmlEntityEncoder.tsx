"use client";

import * as React from "react";
import { ArrowLeftRight, Save } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

type Mode = "encode" | "decode";

const NAMED_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function encodeHtmlEntities(text: string): string {
  return Array.from(text)
    .map((char) => {
      if (NAMED_ENTITIES[char]) return NAMED_ENTITIES[char];
      const codePoint = char.codePointAt(0) ?? 0;
      if (codePoint > 0x7f) return `&#${codePoint};`;
      return char;
    })
    .join("");
}

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function transform(text: string, mode: Mode): { result: string; error: string | null } {
  if (!text) return { result: "", error: null };
  try {
    return { result: mode === "encode" ? encodeHtmlEntities(text) : decodeHtmlEntities(text), error: null };
  } catch {
    return { result: "", error: mode === "encode" ? "Could not encode this text." : "Could not decode this text." };
  }
}

export default function HtmlEntityEncoder() {
  useTrackTool("html-entity-encoder");
  const [mode, setMode] = React.useState<Mode>("encode");
  const [input, setInput] = React.useState('<p class="greeting">Hello & "welcome", friend!</p>');
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const { result, error } = React.useMemo(() => transform(input, mode), [input, mode]);

  const switchMode = (next: Mode) => {
    setMode(next);
  };

  const swap = () => {
    setMode((m) => (m === "encode" ? "decode" : "encode"));
    setInput(result || input);
  };

  const saveResult = async () => {
    if (!result) return;
    await saveToolResult("html-entity-encoder", {
      title: mode === "encode" ? "Encoded (HTML entities)" : "Decoded (plain text)",
      summary: `${result.length.toLocaleString()} chars`,
      data: result,
    });
    historyRef.current?.refresh();
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (item.data) setInput(item.data);
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            onClick={() => switchMode("encode")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "encode" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Encode
          </button>
          <button
            onClick={() => switchMode("decode")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "decode" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Decode
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={swap}>
          <ArrowLeftRight className="h-3.5 w-3.5" /> Swap
        </Button>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">{mode === "encode" ? "Plain text / HTML" : "HTML entities"}</p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={10}
            placeholder={mode === "encode" ? "Enter text to encode…" : "Enter HTML entities to decode…"}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Card>

        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">{mode === "encode" ? "HTML entities" : "Plain text"}</p>
          {error ? (
            <div className="flex h-[196px] items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 px-3 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <textarea
              readOnly
              value={result}
              rows={10}
              className="w-full resize-none rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs focus:outline-none"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <CopyButton value={result} variant="secondary" disabled={!result}>
              Copy result
            </CopyButton>
            <Button size="sm" variant="outline" onClick={saveResult} disabled={!result}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          </div>
        </Card>
      </div>

      <ToolHistoryList ref={historyRef} toolSlug="html-entity-encoder" onRestore={restoreResult} />
    </div>
  );
}

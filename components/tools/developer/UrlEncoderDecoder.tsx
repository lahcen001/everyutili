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

function safeUrlTransform(text: string, mode: Mode): { result: string; error: string | null } {
  try {
    if (!text) return { result: "", error: null };
    if (mode === "encode") return { result: encodeURIComponent(text), error: null };
    return { result: decodeURIComponent(text), error: null };
  } catch {
    return { result: "", error: "Invalid input for URL decoding." };
  }
}

export default function UrlEncoderDecoder() {
  useTrackTool("url-encoder-decoder");
  const [mode, setMode] = React.useState<Mode>("encode");
  const [input, setInput] = React.useState("https://example.com/search?q=hello world&lang=en");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const { result, error } = React.useMemo(() => safeUrlTransform(input, mode), [input, mode]);

  const swap = () => {
    setMode((m) => (m === "encode" ? "decode" : "encode"));
    setInput(result || input);
  };

  const saveResult = async () => {
    if (!result) return;
    await saveToolResult("url-encoder-decoder", {
      title: mode === "encode" ? "Encoded URL" : "Decoded text",
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
            onClick={() => setMode("encode")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "encode" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Encode
          </button>
          <button
            onClick={() => setMode("decode")}
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
          <p className="text-sm font-medium">{mode === "encode" ? "Raw text / URL" : "Encoded URL"}</p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Card>

        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">{mode === "encode" ? "Encoded URL" : "Decoded text"}</p>
          {error ? (
            <div className="flex h-[156px] items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 px-3 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <textarea
              readOnly
              value={result}
              rows={8}
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

      <ToolHistoryList ref={historyRef} toolSlug="url-encoder-decoder" onRestore={restoreResult} />
    </div>
  );
}

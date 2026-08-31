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

function safeBase64(text: string, mode: Mode): { result: string; error: string | null } {
  try {
    if (!text) return { result: "", error: null };
    if (mode === "encode") {
      return { result: btoa(unescape(encodeURIComponent(text))), error: null };
    }
    return { result: decodeURIComponent(escape(atob(text))), error: null };
  } catch {
    return {
      result: "",
      error: mode === "encode" ? "Could not encode this text." : "Invalid Base64 input.",
    };
  }
}

export default function Base64EncoderDecoder() {
  useTrackTool("base64-encoder-decoder");
  const [mode, setMode] = React.useState<Mode>("encode");
  const [input, setInput] = React.useState("Hello, EveryUtili!");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const { result, error } = React.useMemo(() => safeBase64(input, mode), [input, mode]);

  const swap = () => {
    setMode((m) => (m === "encode" ? "decode" : "encode"));
    setInput(result || input);
  };

  const saveResult = async () => {
    if (!result) return;
    await saveToolResult("base64-encoder-decoder", {
      title: mode === "encode" ? "Encoded (Base64)" : "Decoded (plain text)",
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
          <p className="text-sm font-medium">{mode === "encode" ? "Plain text" : "Base64"}</p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={10}
            placeholder={mode === "encode" ? "Enter text to encode…" : "Enter Base64 to decode…"}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Card>

        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">{mode === "encode" ? "Base64" : "Plain text"}</p>
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

      <ToolHistoryList ref={historyRef} toolSlug="base64-encoder-decoder" onRestore={restoreResult} />
    </div>
  );
}

"use client";

import * as React from "react";
import { ArrowLeftRight, Save } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { decodeUrl, encodeUrl, parseUrl, type UrlScope } from "@/lib/urlCodec";
import { cn } from "@/lib/utils";

type Mode = "encode" | "decode";

const SCOPES: { id: UrlScope; label: string; hint: string }[] = [
  { id: "component", label: "Component", hint: "encodeURIComponent — encodes everything including / ? & = #. Use for a single value or query parameter." },
  { id: "uri", label: "Full URL", hint: "encodeURI — keeps the URL structure (: / ? & = #) and only encodes unsafe characters." },
  { id: "form", label: "Form (+)", hint: "Like Component, but spaces become + (application/x-www-form-urlencoded)." },
];

export default function UrlEncoderDecoder() {
  useTrackTool("url-encoder-decoder");
  const [mode, setMode] = React.useState<Mode>("encode");
  const [scope, setScope] = React.useState<UrlScope>("uri");
  const [input, setInput] = React.useState("https://example.com/search?q=hello world&lang=en");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  let result = "";
  let error: string | null = null;
  if (input) {
    try {
      result = mode === "encode" ? encodeUrl(input, scope) : decodeUrl(input, scope);
    } catch {
      error = "This text has a broken % sequence (for example %E0%A4%A) and can't be decoded.";
    }
  }
  const parsed = parseUrl(mode === "encode" ? input : result);

  const swap = () => {
    setMode((m) => (m === "encode" ? "decode" : "encode"));
    if (result) setInput(result);
  };

  const saveResult = async () => {
    if (!result) return;
    await saveToolResult("url-encoder-decoder", { title: mode === "encode" ? "Encoded URL" : "Decoded text", summary: `${result.length.toLocaleString()} chars`, data: result });
    historyRef.current?.refresh();
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (item.data) setInput(item.data);
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Direction">
            {(["encode", "decode"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={cn("px-3 py-1.5 text-sm font-medium capitalize transition-colors", mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {m}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Encoding type">
            {SCOPES.map((s) => (
              <button key={s.id} onClick={() => setScope(s.id)} aria-pressed={scope === s.id} className={cn("px-3 py-1.5 text-sm font-medium transition-colors", scope === s.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {s.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={swap}>
            <ArrowLeftRight className="h-3.5 w-3.5" /> Swap
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{SCOPES.find((s) => s.id === scope)?.hint}</p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">{mode === "encode" ? "Raw text / URL" : "Encoded text"}</p>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={8} aria-label="Input" className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        </Card>

        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">{mode === "encode" ? "Encoded" : "Decoded"}</p>
          {error ? (
            <div role="alert" className="flex h-[156px] items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 px-3 text-center text-sm text-destructive">
              {error}
            </div>
          ) : (
            <textarea readOnly value={result} rows={8} aria-label="Output" className="w-full resize-none rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs focus:outline-none" />
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

      {parsed && (
        <Card className="space-y-3 p-4">
          <p className="text-sm font-medium">URL breakdown</p>
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[120px_1fr]">
            {parsed.parts.map((p) => (
              <React.Fragment key={p.label}>
                <dt className="text-muted-foreground">{p.label}</dt>
                <dd className="break-all font-mono text-xs">{p.value}</dd>
              </React.Fragment>
            ))}
          </dl>
          {parsed.params.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1.5 font-medium">Parameter</th>
                  <th className="py-1.5 font-medium">Decoded value</th>
                </tr>
              </thead>
              <tbody>
                {parsed.params.map((p, i) => (
                  <tr key={`${p.key}-${i}`} className="border-b border-border/60">
                    <td className="py-1.5 font-mono text-xs">{p.key}</td>
                    <td className="break-all py-1.5 font-mono text-xs">{p.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="url-encoder-decoder" onRestore={restoreResult} />
    </div>
  );
}

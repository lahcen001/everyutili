"use client";

import * as React from "react";
import { KeyRound, Save } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const ALGORITHMS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
type Algorithm = (typeof ALGORITHMS)[number];

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function computeHmac(message: string, secret: string, algorithm: Algorithm): Promise<string> {
  const encoder = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"]
  );
  const signature = await window.crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return bufferToHex(signature);
}

export default function HmacGenerator() {
  useTrackTool("hmac-generator");
  const [message, setMessage] = React.useState("Hello, EveryUtili!");
  const [secret, setSecret] = React.useState("my-secret-key");
  const [algorithm, setAlgorithm] = React.useState<Algorithm>("SHA-256");
  const [hmac, setHmac] = React.useState("");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!message || !secret) {
        if (!cancelled) setHmac("");
        return;
      }
      const result = await computeHmac(message, secret, algorithm);
      if (!cancelled) setHmac(result);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [message, secret, algorithm]);

  const saveResult = async () => {
    if (!hmac) return;
    await saveToolResult("hmac-generator", {
      title: `HMAC-${algorithm}`,
      summary: `${message.length.toLocaleString()}-char message`,
      data: hmac,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Enter the message to authenticate…"
            className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Secret key</span>
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter the shared secret key…"
            className="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {ALGORITHMS.map((algo) => (
            <Button
              key={algo}
              size="sm"
              variant={algorithm === algo ? "default" : "outline"}
              onClick={() => setAlgorithm(algo)}
            >
              {algo}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-muted-foreground" /> HMAC-{algorithm}
          </p>
          <CopyButton value={hmac} size="sm" variant="outline" disabled={!hmac} />
        </div>
        <div className="min-h-[60px] break-all rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs">
          {hmac || <span className="font-sans text-sm text-muted-foreground">Enter a message and secret key above.</span>}
        </div>
        <Button size="sm" variant="outline" onClick={saveResult} disabled={!hmac}>
          <Save className="h-3.5 w-3.5" /> Save result
        </Button>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="hmac-generator" />
    </div>
  );
}

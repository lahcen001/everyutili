"use client";

import * as React from "react";
import { KeyRound, Save } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { constantTimeEqual, decodeDigest, encodeDigest, parseHex, type HmacEncoding } from "@/lib/hmac";
import { cn } from "@/lib/utils";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const ALGORITHMS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
type Algorithm = (typeof ALGORITHMS)[number];

async function computeHmac(message: string, secret: Uint8Array, algorithm: Algorithm): Promise<Uint8Array> {
  const key = await window.crypto.subtle.importKey("raw", secret as BufferSource, { name: "HMAC", hash: algorithm }, false, ["sign"]);
  const signature = await window.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

export default function HmacGenerator() {
  useTrackTool("hmac-generator");
  const [message, setMessage] = React.useState("Hello, EveryUtili!");
  const [secret, setSecret] = React.useState("my-secret-key");
  const [algorithm, setAlgorithm] = React.useState<Algorithm>("SHA-256");
  const [secretIsHex, setSecretIsHex] = React.useState(false);
  const [encoding, setEncoding] = React.useState<HmacEncoding>("hex");
  const [uppercase, setUppercase] = React.useState(false);
  const [expected, setExpected] = React.useState("");
  const [digest, setDigest] = React.useState<Uint8Array | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const secretBytes = secretIsHex ? parseHex(secret) : secret ? new TextEncoder().encode(secret) : null;
  const secretError = secretIsHex && secret.trim() !== "" && !secretBytes ? "The key isn't valid hex (use pairs of 0-9 a-f)." : null;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = message && secretBytes ? await computeHmac(message, secretBytes, algorithm) : null;
      if (!cancelled) setDigest(result);
    })();
    return () => {
      cancelled = true;
    };
    // secretBytes is derived from secret + secretIsHex
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, secret, secretIsHex, algorithm]);

  const hmac = digest ? encodeDigest(digest, encoding, uppercase) : "";
  const expectedBytes = expected.trim() ? decodeDigest(expected) : null;
  const verdict = !expected.trim() || !digest ? null : expectedBytes && constantTimeEqual(expectedBytes, digest) ? "match" : "mismatch";

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
          <span className="flex items-center justify-between text-sm font-medium">
            Secret key
            <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              <input type="checkbox" checked={secretIsHex} onChange={(e) => setSecretIsHex(e.target.checked)} className="h-3.5 w-3.5" /> Key is hex
            </span>
          </span>
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter the shared secret key…"
            className="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        {secretError && <p role="alert" className="text-xs text-destructive">{secretError}</p>}
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
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Output format">
            {(["hex", "base64", "base64url"] as const).map((e) => (
              <button key={e} onClick={() => setEncoding(e)} aria-pressed={encoding === e} className={cn("px-3 py-1 text-xs font-medium transition-colors", encoding === e ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {e}
              </button>
            ))}
          </div>
          {encoding === "hex" && (
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} className="h-3.5 w-3.5" /> Uppercase
            </label>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={saveResult} disabled={!hmac}>
          <Save className="h-3.5 w-3.5" /> Save result
        </Button>
      </Card>

      <Card className="space-y-2 p-4">
        <p className="text-sm font-medium">Verify a signature</p>
        <input value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="Paste the HMAC you received (hex, base64 or base64url)" aria-label="Expected HMAC" className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        {verdict && (
          <p role="status" className={cn("text-sm font-medium", verdict === "match" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
            {verdict === "match" ? "Match — the signature is valid for this message and key." : "No match — the message, key, algorithm or signature differs."}
          </p>
        )}
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="hmac-generator" />
    </div>
  );
}

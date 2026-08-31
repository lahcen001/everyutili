"use client";

import * as React from "react";
import { AlertCircle, Clock, KeyRound, Save, ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const SAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

interface DecodedJwt {
  header: unknown;
  payload: Record<string, unknown>;
  signature: string;
  error: string | null;
}

function decodeJwt(token: string): DecodedJwt {
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return { header: null, payload: {}, signature: "", error: "A JWT must have three dot-separated parts (header.payload.signature)." };
  }
  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return { header, payload, signature: parts[2], error: null };
  } catch {
    return { header: null, payload: {}, signature: "", error: "Could not decode this token. Check that it's valid Base64URL JSON." };
  }
}

function formatTimestamp(value: unknown): string | null {
  if (typeof value !== "number") return null;
  return new Date(value * 1000).toLocaleString();
}

export default function JwtDecoder() {
  useTrackTool("jwt-decoder");
  const [token, setToken] = React.useState(SAMPLE_JWT);
  const [now, setNow] = React.useState(() => Date.now());
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const handleTokenChange = (value: string) => {
    setToken(value);
    setNow(Date.now());
  };

  const decoded = React.useMemo(() => decodeJwt(token), [token]);

  const exp = decoded.payload.exp;
  const iat = decoded.payload.iat;
  const isExpired = typeof exp === "number" && exp * 1000 < now;

  const saveResult = async () => {
    if (decoded.error) return;
    const subject = typeof decoded.payload.sub === "string" ? decoded.payload.sub : null;
    await saveToolResult("jwt-decoder", {
      title: subject ? `JWT for "${subject}"` : "Decoded JWT",
      summary:
        typeof exp === "number"
          ? `${isExpired ? "Expired" : "Valid"} — expires ${formatTimestamp(exp)}`
          : "No expiry claim",
      data: token,
    });
    historyRef.current?.refresh();
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (item.data) handleTokenChange(item.data);
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-2 p-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">JWT token</span>
          <textarea
            value={token}
            onChange={(e) => handleTokenChange(e.target.value)}
            rows={4}
            placeholder="Paste your JWT here…"
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <Button size="sm" variant="outline" onClick={saveResult} disabled={!!decoded.error}>
          <Save className="h-3.5 w-3.5" /> Save result
        </Button>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        This tool only decodes the token locally — it does not verify the signature. Never treat a
        decoded token as authenticated without server-side signature verification.
      </div>

      {decoded.error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {decoded.error}
        </div>
      ) : (
        <div className="space-y-4">
          {typeof exp === "number" && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                isExpired
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              }`}
            >
              <Clock className="h-4 w-4" />
              {isExpired ? "Expired" : "Valid"} — expires {formatTimestamp(exp)}
              {typeof iat === "number" && ` (issued ${formatTimestamp(iat)})`}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Header</p>
                {typeof decoded.header === "object" &&
                  decoded.header !== null &&
                  "alg" in decoded.header && (
                    <Badge variant="outline">{String((decoded.header as Record<string, unknown>).alg)}</Badge>
                  )}
              </div>
              <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs">
                {JSON.stringify(decoded.header, null, 2)}
              </pre>
            </Card>

            <Card className="space-y-2 p-4">
              <p className="text-sm font-medium">Payload</p>
              <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs">
                {JSON.stringify(decoded.payload, null, 2)}
              </pre>
            </Card>
          </div>

          <Card className="space-y-2 p-4">
            <p className="text-sm font-medium">Signature (not verified)</p>
            <p className="break-all rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs text-muted-foreground">
              {decoded.signature}
            </p>
          </Card>
        </div>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="jwt-decoder" onRestore={restoreResult} />
    </div>
  );
}

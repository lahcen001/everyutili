"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Clock, KeyRound, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { decodeJwt, describeClaims, timeState, verifyJwt, type DecodedJwt, type VerifyResult } from "@/lib/jwt";
import { cn } from "@/lib/utils";

// A short-lived demo token: header {alg: HS256}, payload {sub, name, iat, exp: 4102444800 (2100)}, secret "your-256-bit-secret"
const SAMPLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjo0MTAyNDQ0ODAwfQ.tf12tfnRF89aLvrcP36l4U7MqNR6EeCx4PF38Tupfks";

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary";

function JsonBlock({ title, value, tone }: { title: string; value: unknown; tone: string }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <Card className="flex min-h-0 flex-col overflow-hidden p-0">
      <div className={cn("flex items-center justify-between border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide", tone)}>
        {title}
        <CopyButton value={text} size="sm" variant="ghost" className="h-6 px-2 text-xs normal-case tracking-normal" />
      </div>
      <pre className="max-h-96 min-h-40 overflow-auto p-3 font-mono text-xs leading-relaxed">{text}</pre>
    </Card>
  );
}

export default function JwtDecoder() {
  useTrackTool("jwt-decoder");
  const [input, setInput] = React.useState(SAMPLE);
  const [secret, setSecret] = React.useState("");
  const [now, setNow] = React.useState(() => Math.floor(Date.now() / 1000));
  const [verify, setVerify] = React.useState<{ token: string; key: string; result: VerifyResult } | null>(null);

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const decoded = React.useMemo(() => decodeJwt(input), [input]);
  const token: DecodedJwt | null = decoded.ok ? decoded.token : null;
  const alg = token && token.header && typeof token.header === "object" && !Array.isArray(token.header) ? String((token.header as Record<string, unknown>).alg ?? "") : "";
  const needsPublicKey = alg !== "" && !alg.startsWith("HS");
  const claims = token ? describeClaims(token.payload, now) : [];
  const state = token ? timeState(token.payload, now) : null;
  const parts = input.trim().replace(/^Bearer\s+/i, "").split(".");

  const runVerify = async () => {
    if (!token) return;
    const result = await verifyJwt(token, { kind: needsPublicKey ? "key" : "secret", value: secret });
    setVerify({ token: input, key: secret, result });
  };
  const verified = verify && verify.token === input && verify.key === secret ? verify.result : null;

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="jwt-input" className="text-sm font-medium">
            Encoded token
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setInput(SAMPLE)}>
              Sample
            </Button>
            <Button size="sm" variant="outline" onClick={() => setInput("")} disabled={!input}>
              Clear
            </Button>
          </div>
        </div>
        <textarea id="jwt-input" value={input} onChange={(e) => setInput(e.target.value)} rows={6} spellCheck={false} placeholder="Paste a JWT (eyJhbGciOi…) — a 'Bearer ' prefix is fine" className={cn(inputClass, "resize-y break-all text-sm leading-relaxed")} />
        {token && parts.length === 3 && (
          <p className="break-all rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed" aria-label="Colour-coded token">
            <span className="text-rose-600 dark:text-rose-400">{parts[0]}</span>
            <span className="text-muted-foreground">.</span>
            <span className="text-violet-600 dark:text-violet-400">{parts[1]}</span>
            <span className="text-muted-foreground">.</span>
            <span className="text-sky-600 dark:text-sky-400">{parts[2]}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground">The sample token is signed with the secret <code className="rounded bg-muted px-1">your-256-bit-secret</code> — try verifying it below. Decoding happens in your browser. Tokens and keys are never uploaded and are not saved to history.</p>
      </Card>

      {!decoded.ok && input.trim() !== "" && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {decoded.error}
        </div>
      )}

      {token && (
        <>
          <div className="flex flex-wrap gap-2 text-sm" role="status">
            <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Structure is valid
            </span>
            {alg && <span className="rounded-full border border-border px-3 py-1 font-mono text-xs">alg: {alg}</span>}
            {state === "expired" && (
              <span className="flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-destructive">
                <Clock className="h-4 w-4" /> Expired
              </span>
            )}
            {state === "not-yet-valid" && (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-amber-700 dark:text-amber-400">
                <Clock className="h-4 w-4" /> Not valid yet
              </span>
            )}
            {state === "valid-time" && (
              <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                <Clock className="h-4 w-4" /> Not expired
              </span>
            )}
            {state === "no-expiry" && <span className="rounded-full border border-border px-3 py-1">No expiry claim</span>}
            {verified?.ok ? (
              verified.valid ? (
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4" /> Signature verified
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 font-medium text-destructive">
                  <ShieldAlert className="h-4 w-4" /> Signature does NOT match
                </span>
              )
            ) : (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" /> Signature not verified
              </span>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <JsonBlock title="Header" value={token.header} tone="text-rose-600 dark:text-rose-400" />
            <JsonBlock title="Payload" value={token.payload} tone="text-violet-600 dark:text-violet-400" />
          </div>

          {claims.length > 0 && (
            <Card className="overflow-x-auto p-4">
              <p className="mb-2 text-sm font-medium">Time claims</p>
              <table className="w-full text-sm">
                <tbody>
                  {claims.map((c) => (
                    <tr key={c.name} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{c.name}</td>
                      <td className="py-2 pr-4">{c.label}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{c.iso.replace("T", " ").replace(".000Z", " UTC")}</td>
                      <td className={cn("py-2 text-xs font-medium tabular-nums", c.status === "expired" && "text-destructive", c.status === "pending" && "text-amber-600 dark:text-amber-400", c.status === "ok" && "text-emerald-600 dark:text-emerald-400")}>{c.relative}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <Card className="space-y-3 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4 text-muted-foreground" /> Verify the signature
            </p>
            {needsPublicKey ? (
              <textarea value={secret} onChange={(e) => setSecret(e.target.value)} rows={5} spellCheck={false} aria-label="Public key" placeholder={"-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----\n(or a public JWK as JSON)"} className={cn(inputClass, "resize-y")} />
            ) : (
              <input value={secret} onChange={(e) => setSecret(e.target.value)} spellCheck={false} aria-label="Secret" placeholder="Shared secret (used as plain text)" className={inputClass} />
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={runVerify} disabled={!secret.trim()}>
                Verify signature
              </Button>
              {verified && !verified.ok && (
                <span role="alert" className="text-sm text-destructive">
                  {verified.error}
                </span>
              )}
              {verified?.ok && <span className="text-sm text-muted-foreground">{verified.valid ? "The signature matches this key." : "The signature doesn't match — the token was changed or signed with a different key."}</span>}
            </div>
            <p className="text-xs text-muted-foreground">Supports HS256/384/512 (secret), RS/PS256/384/512 and ES256/384/512 (public key PEM or JWK). Decoding alone proves nothing — anyone can write a token with any claims.</p>
          </Card>
        </>
      )}
    </div>
  );
}

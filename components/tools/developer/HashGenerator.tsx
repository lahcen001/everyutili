"use client";

import * as React from "react";
import { CheckCircle2, FileText, Loader2, X, XCircle } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { HASH_ALGOS, SHA_SIZE_LIMIT, hashBytes, sameHash, toBase64, type HashAlgo } from "@/lib/hash";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

type Source = { kind: "text" } | { kind: "file"; file: File };

export default function HashGenerator() {
  useTrackTool("hash-generator");
  const [text, setText] = React.useState("Hello, EveryUtili!");
  const [file, setFile] = React.useState<File | null>(null);
  const [selected, setSelected] = React.useState<HashAlgo[]>(["MD5", "SHA-1", "SHA-256", "SHA-512"]);
  const [uppercase, setUppercase] = React.useState(false);
  const [base64, setBase64] = React.useState(false);
  const [expected, setExpected] = React.useState("");
  const [hashes, setHashes] = React.useState<{ key: string; values: Partial<Record<HashAlgo, string>>; error?: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const source: Source = file ? { kind: "file", file } : { kind: "text" };
  const key = JSON.stringify([source.kind === "file" ? `${file!.name}:${file!.size}:${file!.lastModified}` : text, selected]);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setBusy(true);
      try {
        let bytes: Uint8Array;
        if (file) {
          bytes = new Uint8Array(await file.arrayBuffer());
        } else bytes = new TextEncoder().encode(text);
        const values: Partial<Record<HashAlgo, string>> = {};
        let error: string | undefined;
        for (const algo of selected) {
          if (file && file.size > SHA_SIZE_LIMIT && algo.startsWith("SHA")) {
            error = "Files over 1 GB can't be hashed with SHA in the browser (Web Crypto needs the whole file in memory). MD5 and CRC32 still work.";
            continue;
          }
          values[algo] = await hashBytes(algo, bytes);
        }
        if (!cancelled) setHashes({ key, values, error });
      } catch (e) {
        if (!cancelled) setHashes({ key, values: {}, error: e instanceof Error ? e.message : "Could not read this file." });
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // `key` captures text, file identity and algorithms
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = hashes?.key === key ? hashes : null;
  const show = (algo: HashAlgo) => {
    const v = current?.values[algo];
    if (!v) return "";
    if (base64) return toBase64(v.padEnd(Math.ceil(v.length / 2) * 2, "0"));
    return uppercase ? v.toUpperCase() : v;
  };
  const matchAlgo = expected.trim() && current ? selected.find((a) => current.values[a] && sameHash(expected, current.values[a]!)) : undefined;
  const toggle = (a: HashAlgo) => setSelected((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{file ? "File" : "Text"}</p>
          {file && (
            <Button size="sm" variant="ghost" onClick={() => setFile(null)}>
              <X className="h-3.5 w-3.5" /> Back to text
            </Button>
          )}
        </div>
        {file ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            {busy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>
        ) : (
          <>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} spellCheck={false} aria-label="Text to hash" placeholder="Type or paste text — hashes update as you type" className="w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <DropZone onFiles={(f) => setFile(f[0] ?? null)} multiple={false} label="…or drop a file to get its checksum" hint="Hashed locally — the file never leaves your device" className="py-5" />
          </>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label="Algorithms">
          {HASH_ALGOS.map((a) => (
            <label key={a.id} className="flex items-center gap-1.5 text-sm" title={a.note}>
              <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4 rounded border-border accent-primary" />
              {a.id}
              {a.note && a.id !== "CRC32" && <span className="text-[10px] text-amber-600 dark:text-amber-400">{a.id === "MD5" || a.id === "SHA-1" ? "legacy" : ""}</span>}
            </label>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={uppercase} disabled={base64} onChange={(e) => setUppercase(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" /> UPPERCASE
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={base64} onChange={(e) => setBase64(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" /> Base64
          </label>
        </div>

        {current?.error && (
          <p role="alert" className="text-sm text-destructive">
            {current.error}
          </p>
        )}

        <div className="space-y-2">
          {selected.length === 0 && <p className="text-sm text-muted-foreground">Pick at least one algorithm.</p>}
          {HASH_ALGOS.filter((a) => selected.includes(a.id)).map((a) => (
            <div key={a.id} className={cn("rounded-lg border bg-muted/20 p-3", matchAlgo === a.id ? "border-emerald-500/60 bg-emerald-500/5" : "border-border")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{a.id}</span>
                <CopyButton value={show(a.id)} size="sm" variant="ghost" disabled={!show(a.id)} className="h-6 px-2 text-xs" />
              </div>
              <p className="mt-1 break-all font-mono text-xs">{current ? show(a.id) || "—" : "Calculating…"}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-2 p-4">
        <label htmlFor="expected-hash" className="text-sm font-medium">
          Compare with a checksum you were given
        </label>
        <input id="expected-hash" value={expected} onChange={(e) => setExpected(e.target.value)} spellCheck={false} placeholder="Paste the expected hash (hex or Base64; 'sha256:' prefixes are fine)" className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        {expected.trim() &&
          (matchAlgo ? (
            <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Match — it equals the {matchAlgo} hash{file ? " of this file" : " of this text"}.
            </p>
          ) : (
            <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <XCircle className="h-4 w-4" /> No match with the selected algorithms.
            </p>
          ))}
      </Card>
    </div>
  );
}

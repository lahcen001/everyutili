"use client";

import * as React from "react";
import { ArrowLeftRight, Download, FileUp, Save, Sparkles, X } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { base64ToBytes, buildDataUri, bytesToBase64, bytesToText, looksLikeBase64, parseDataUri, sniffFileType } from "@/lib/base64";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

type Mode = "encode" | "decode";

interface PickedFile {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

const fieldClass = "w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary";

export default function Base64EncoderDecoder() {
  useTrackTool("base64-encoder-decoder");
  const [mode, setMode] = React.useState<Mode>("encode");
  const [input, setInput] = React.useState("Hello, EveryUtili!");
  const [file, setFile] = React.useState<PickedFile | null>(null);
  const [urlSafe, setUrlSafe] = React.useState(false);
  const [padding, setPadding] = React.useState(true);
  const [wrap, setWrap] = React.useState(false);
  const [asDataUri, setAsDataUri] = React.useState(false);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const output = (() => {
    try {
      if (mode === "encode") {
        const bytes = file ? file.bytes : new TextEncoder().encode(input);
        if (bytes.length === 0) return { kind: "empty" as const };
        const b64 = bytesToBase64(bytes, { urlSafe, padding, wrap });
        const mime = file?.mime || "text/plain;charset=utf-8";
        return { kind: "encoded" as const, text: asDataUri ? buildDataUri(mime, b64) : b64, mime };
      }
      if (input.trim() === "") return { kind: "empty" as const };
      const bytes = base64ToBytes(input);
      const decodedText = bytesToText(bytes);
      const sniffed = sniffFileType(bytes);
      const mime = sniffed?.mime ?? parseDataUri(input)?.mime ?? null;
      if (decodedText.valid && !sniffed) return { kind: "text" as const, text: decodedText.text, size: bytes.length };
      return { kind: "binary" as const, bytes, mime, extension: sniffed?.extension ?? "bin", size: bytes.length };
    } catch (e) {
      return { kind: "error" as const, message: e instanceof Error ? e.message : "Could not process this input." };
    }
  })();

  const outputText = output.kind === "encoded" || output.kind === "text" ? output.text : "";
  const looksEncoded = mode === "encode" && !file && looksLikeBase64(input);
  const binaryUrl = React.useMemo(() => {
    if (output.kind !== "binary" || !output.mime?.startsWith("image/")) return null;
    return URL.createObjectURL(new Blob([output.bytes as BlobPart], { type: output.mime }));
  }, [output.kind === "binary" ? output.bytes : null]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => () => { if (binaryUrl) URL.revokeObjectURL(binaryUrl); }, [binaryUrl]);

  const pickFile = async (picked: File | undefined) => {
    if (!picked) return;
    setFile({ name: picked.name, mime: picked.type || "application/octet-stream", bytes: new Uint8Array(await picked.arrayBuffer()) });
    setMode("encode");
  };

  const swap = () => {
    if (output.kind === "encoded" || output.kind === "text") {
      setFile(null);
      setInput(output.text);
    }
    setMode((m) => (m === "encode" ? "decode" : "encode"));
  };

  const saveResult = async () => {
    if (!outputText) return;
    await saveToolResult("base64-encoder-decoder", {
      title: mode === "encode" ? "Encoded (Base64)" : "Decoded (plain text)",
      summary: `${outputText.length.toLocaleString()} chars`,
      data: outputText,
    });
    historyRef.current?.refresh();
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (item.data) {
      setFile(null);
      setInput(item.data);
    }
  };

  const downloadBinary = () => {
    if (output.kind !== "binary") return;
    downloadBlob(new Blob([output.bytes as BlobPart], { type: output.mime ?? "application/octet-stream" }), `decoded.${output.extension}`);
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Direction">
          {(["encode", "decode"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={cn("px-3 py-1.5 text-sm font-medium capitalize transition-colors", mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {m}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={swap}>
          <ArrowLeftRight className="h-3.5 w-3.5" /> Swap
        </Button>
        {mode === "encode" && (
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} className="h-4 w-4 rounded border-border" /> URL-safe
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!padding} onChange={(e) => setPadding(!e.target.checked)} className="h-4 w-4 rounded border-border" /> No padding (=)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} className="h-4 w-4 rounded border-border" /> Wrap at 76 chars
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={asDataUri} onChange={(e) => setAsDataUri(e.target.checked)} className="h-4 w-4 rounded border-border" /> As data: URI
            </label>
          </div>
        )}
      </Card>

      {looksEncoded && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" /> This looks like Base64 already.
          <Button size="sm" variant="outline" onClick={() => setMode("decode")}>
            Switch to Decode
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{mode === "encode" ? (file ? "File" : "Plain text") : "Base64"}</p>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              <FileUp className="h-3.5 w-3.5" /> {mode === "encode" ? "Encode a file or image" : "Load a Base64 file"}
              <input
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const picked = e.target.files?.[0];
                  e.target.value = "";
                  if (!picked) return;
                  if (mode === "decode") setInput(await picked.text());
                  else await pickFile(picked);
                }}
              />
            </label>
          </div>
          {file ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(file.bytes.length)} · {file.mime}
                </p>
              </div>
              <button onClick={() => setFile(null)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove file">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={10} placeholder={mode === "encode" ? "Enter text to encode…" : "Paste Base64 or a data: URI to decode…"} aria-label="Input" className={fieldClass} />
          )}
        </Card>

        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">{mode === "encode" ? "Base64" : output.kind === "binary" ? "Decoded file" : "Plain text"}</p>
          {output.kind === "error" ? (
            <div role="alert" className="flex h-[196px] items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 px-3 text-center text-sm text-destructive">
              {output.message}
            </div>
          ) : output.kind === "binary" ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <p>
                This Base64 is not text — it decodes to <span className="font-medium">{output.mime ?? "binary data"}</span> ({formatBytes(output.size)}).
              </p>
              {binaryUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={binaryUrl} alt="Decoded image" className="max-h-48 rounded border border-border bg-white" />
              )}
              <Button size="sm" onClick={downloadBinary}>
                <Download className="h-3.5 w-3.5" /> Download .{output.extension}
              </Button>
            </div>
          ) : (
            <textarea readOnly value={outputText} rows={10} aria-label="Output" className={cn(fieldClass, "bg-muted/20")} />
          )}
          {output.kind === "text" && <p className="text-xs text-muted-foreground">{formatBytes(output.size)} decoded as UTF-8 text.</p>}
          {output.kind === "encoded" && <p className="text-xs text-muted-foreground">{outputText.length.toLocaleString()} characters.</p>}
          <div className="flex flex-wrap gap-2">
            <CopyButton value={outputText} variant="secondary" disabled={!outputText}>
              Copy result
            </CopyButton>
            <Button size="sm" variant="outline" onClick={saveResult} disabled={!outputText}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          </div>
        </Card>
      </div>

      <ToolHistoryList ref={historyRef} toolSlug="base64-encoder-decoder" onRestore={restoreResult} />
    </div>
  );
}

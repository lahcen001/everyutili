"use client";

import * as React from "react";
import { Download, FileArchive, Loader2, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { compressPdfBytes, savedPercent, type CompressMode } from "@/lib/pdf/compress";
import { friendlyPdfError, isPdfFile } from "@/lib/pdf/errors";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";
import { cn } from "@/lib/utils";

const MODES: { id: CompressMode; title: string; description: string }[] = [
  {
    id: "lossless",
    title: "Lossless",
    description: "Strips metadata and repacks the file. Text stays selectable. Often saves little.",
  },
  {
    id: "balanced",
    title: "Balanced",
    description: "Re-renders pages as 150 DPI images. Big savings on scans and image-heavy files.",
  },
  {
    id: "strong",
    title: "Strong",
    description: "Re-renders pages as 100 DPI images at lower quality. Smallest file, softer text.",
  },
];

interface Result {
  blob: Blob;
  name: string;
  percent: number;
}

export default function CompressPdf() {
  useTrackTool("compress-pdf");
  const [file, setFile] = React.useState<File | null>(null);
  const [mode, setMode] = React.useState<CompressMode>("balanced");
  const [result, setResult] = React.useState<Result | null>(null);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [isCompressing, setIsCompressing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const handleFiles = (files: File[]) => {
    const pdfFile = files.find((f) => isPdfFile(f));
    if (!pdfFile) return;
    setFile(pdfFile);
    setResult(null);
    setError(null);
  };

  const removeFile = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const compress = async () => {
    if (!file) return;
    setIsCompressing(true);
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      const outBytes = await compressPdfBytes(await file.arrayBuffer(), mode, (done, total) =>
        setProgress({ done, total })
      );
      const blob = new Blob([new Uint8Array(outBytes)], { type: "application/pdf" });
      const name = `${file.name.replace(/\.pdf$/i, "")}-compressed.pdf`;
      const percent = savedPercent(file.size, blob.size);
      setResult({ blob, name, percent });

      if (percent > 0) {
        await saveToolResult("compress-pdf", {
          title: name,
          summary: `${formatBytes(file.size)} → ${formatBytes(blob.size)} (${percent}% smaller)`,
          blob,
        });
        historyRef.current?.refresh();
      }
    } catch (e) {
      setError(friendlyPdfError(e, "Failed to compress PDF."));
    } finally {
      setIsCompressing(false);
      setProgress(null);
    }
  };

  const smaller = result !== null && result.percent > 0;

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="application/pdf"
        multiple={false}
        label="Drag & drop a PDF here, or click to browse"
        hint="Choose a compression level, then compare the result before downloading"
      />

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {file && (
        <>
          <Card className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <button
              onClick={removeFile}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Compression level">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  mode === m.id ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
                )}
              >
                <p className="text-sm font-semibold">{m.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
              </button>
            ))}
          </div>

          {mode !== "lossless" && (
            <p className="text-xs text-muted-foreground">
              Balanced and Strong turn every page into an image, so text can no longer be selected or searched.
              Use Lossless if you need to keep text.
            </p>
          )}

          <Button onClick={compress} disabled={isCompressing}>
            {isCompressing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress ? ` Page ${progress.done} of ${progress.total}…` : " Compressing…"}
              </>
            ) : (
              <>
                <FileArchive className="h-4 w-4" /> Compress
              </>
            )}
          </Button>
        </>
      )}

      {file && result && (
        <Card className="space-y-3 p-4" role="status">
          <p className="text-sm">
            {formatBytes(file.size)} → <span className="font-semibold">{formatBytes(result.blob.size)}</span>{" "}
            {smaller ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">({result.percent}% smaller)</span>
            ) : (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                ({Math.abs(result.percent)}% {result.percent === 0 ? "— no change" : "larger"})
              </span>
            )}
          </p>
          {smaller ? (
            <Button size="sm" onClick={() => downloadBlob(result.blob, result.name)}>
              <Download className="h-3.5 w-3.5" /> Download compressed PDF
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {mode === "lossless"
                ? "This PDF is already well optimized and can't be shrunk losslessly. Try Balanced or Strong."
                : "Re-rendering didn't make this file smaller (it is probably already mostly text or already compressed). Your original is the better file."}
            </p>
          )}
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="compress-pdf" />
    </div>
  );
}

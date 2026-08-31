"use client";

import * as React from "react";
import { PDFDocument } from "pdf-lib";
import { FileArchive, Loader2, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";

export default function CompressPdf() {
  useTrackTool("compress-pdf");
  const [file, setFile] = React.useState<File | null>(null);
  const [resultSize, setResultSize] = React.useState<number | null>(null);
  const [isCompressing, setIsCompressing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const handleFiles = (files: File[]) => {
    const pdfFile = files.find((f) => f.type === "application/pdf");
    if (!pdfFile) return;
    setFile(pdfFile);
    setResultSize(null);
    setError(null);
  };

  const removeFile = () => {
    setFile(null);
    setResultSize(null);
    setError(null);
  };

  const compressPdf = async () => {
    if (!file) return;
    setIsCompressing(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
      // Strip metadata and re-save with object streams for a smaller footprint.
      pdf.setTitle("");
      pdf.setAuthor("");
      pdf.setSubject("");
      pdf.setKeywords([]);
      pdf.setProducer("");
      pdf.setCreator("");
      const outBytes = await pdf.save({ useObjectStreams: true });
      setResultSize(outBytes.length);
      const baseName = file.name.replace(/\.pdf$/i, "");
      const blob = new Blob([new Uint8Array(outBytes)], { type: "application/pdf" });
      const outName = `${baseName}-compressed.pdf`;
      downloadBlob(blob, outName);

      const percentSmaller = Math.max(0, Math.round((1 - outBytes.length / file.size) * 100));
      await saveToolResult("compress-pdf", {
        title: outName,
        summary: `${formatBytes(file.size)} → ${formatBytes(outBytes.length)} (${percentSmaller}% smaller)`,
        blob,
      });
      historyRef.current?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to compress PDF.");
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="application/pdf"
        multiple={false}
        label="Drag & drop a PDF here, or click to browse"
        hint="Strips metadata and re-packs the file structure to shrink size"
      />

      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Note: this tool performs lossless, metadata-based compression entirely in your browser.
        Because true image re-compression requires a server or heavy WASM codec, savings are
        typically modest (often 5–20%) and depend on how the PDF was originally generated. For
        PDFs dominated by large embedded images, re-export the source document at a lower image
        quality before compressing here for best results.
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {file && (
        <Card className="flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(file.size)}
              {resultSize !== null && (
                <>
                  {" → "}
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatBytes(resultSize)}
                  </span>{" "}
                  ({Math.max(0, Math.round((1 - resultSize / file.size) * 100))}% smaller)
                </>
              )}
            </p>
          </div>
          <Button onClick={compressPdf} disabled={isCompressing}>
            {isCompressing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Compressing…
              </>
            ) : (
              <>
                <FileArchive className="h-4 w-4" /> Compress & Download
              </>
            )}
          </Button>
          <button
            onClick={removeFile}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="compress-pdf" />
    </div>
  );
}

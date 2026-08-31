"use client";

import * as React from "react";
import JSZip from "jszip";
import { Archive, Camera, Download, Loader2, MapPin, ShieldCheck, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";
import { parseExif, formatGpsCoordinates, type ExifData } from "@/lib/exif";

interface QueueItem {
  id: string;
  file: File;
  exif: ExifData | null;
  status: "pending" | "processing" | "done" | "error";
  resultBlob?: Blob;
  error?: string;
}

async function stripImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire canvas context");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode cleaned image"))),
      "image/jpeg",
      0.95
    );
  });
}

function cameraSummary(exif: ExifData | null): string {
  if (!exif) return "No EXIF data";
  const parts = [exif.make, exif.model].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return "EXIF data present";
}

function cleanFileName(name: string): string {
  const baseName = name.replace(/\.[^/.]+$/, "");
  return `${baseName}-clean.jpg`;
}

export default function ExifStripper() {
  useTrackTool("exif-stripper");
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const handleFiles = async (files: File[]) => {
    const jpegFiles = files.filter((f) => f.type === "image/jpeg");
    const items: QueueItem[] = await Promise.all(
      jpegFiles.map(async (file) => {
        let exif: ExifData | null = null;
        try {
          const buffer = await file.arrayBuffer();
          exif = parseExif(buffer);
        } catch {
          exif = null;
        }
        return { id: crypto.randomUUID(), file, exif, status: "pending" as const };
      })
    );
    setQueue((prev) => [...prev, ...items]);
  };

  const removeItem = (id: string) => setQueue((prev) => prev.filter((item) => item.id !== id));

  const stripItem = async (item: QueueItem): Promise<Blob> => {
    setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "processing" } : q)));
    try {
      const blob = await stripImage(item.file);
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "done", resultBlob: blob } : q))
      );

      await saveToolResult("exif-stripper", {
        title: cleanFileName(item.file.name),
        summary: `${cameraSummary(item.exif)} · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();

      return blob;
    } catch (e) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? { ...q, status: "error", error: e instanceof Error ? e.message : "Failed to strip" }
            : q
        )
      );
      throw e;
    }
  };

  const downloadItem = async (item: QueueItem) => {
    if (item.resultBlob) {
      downloadBlob(item.resultBlob, cleanFileName(item.file.name));
      return;
    }
    setIsProcessing(true);
    try {
      const blob = await stripItem(item);
      downloadBlob(blob, cleanFileName(item.file.name));
    } catch {
      // error already reflected in queue item state
    } finally {
      setIsProcessing(false);
    }
  };

  const stripAllAndZip = async () => {
    setIsProcessing(true);
    try {
      const zip = new JSZip();
      for (const item of queue) {
        if (item.status === "error") continue;
        const blob = item.resultBlob ?? (await stripItem(item));
        zip.file(cleanFileName(item.file.name), blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, "clean-images.zip");
    } finally {
      setIsProcessing(false);
    }
  };

  const hasItems = queue.length > 0;
  const allDone = hasItems && queue.every((item) => item.status === "done" || item.status === "error");

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="image/jpeg"
        label="Drag & drop JPEG photos here, or click to browse"
        hint="Reads EXIF metadata locally, then strips it from a clean re-encoded copy"
      />

      {hasItems && (
        <>
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <p className="text-sm text-muted-foreground">
              {queue.length} image{queue.length === 1 ? "" : "s"} queued
            </p>
            <Button className="ml-auto" onClick={stripAllAndZip} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Stripping…
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" /> Strip all & download ZIP
                </>
              )}
            </Button>
          </Card>

          <div className="grid gap-3">
            {queue.map((item) => (
              <Card key={item.id} className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <Camera className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
                  </div>
                  {item.status === "processing" && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  )}
                  {item.status === "done" && (
                    <Button size="sm" variant="outline" onClick={() => downloadItem(item)}>
                      <Download className="h-3.5 w-3.5" /> Save
                    </Button>
                  )}
                  {item.status !== "processing" && (
                    <button
                      onClick={() => removeItem(item.id)}
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {item.status === "error" && (
                  <p className="text-xs text-destructive">{item.error}</p>
                )}

                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  {item.exif ? (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                      {(item.exif.make || item.exif.model) && (
                        <div>
                          <dt className="text-muted-foreground">Camera</dt>
                          <dd className="font-medium">
                            {[item.exif.make, item.exif.model].filter(Boolean).join(" ")}
                          </dd>
                        </div>
                      )}
                      {item.exif.lensModel && (
                        <div>
                          <dt className="text-muted-foreground">Lens</dt>
                          <dd className="font-medium">{item.exif.lensModel}</dd>
                        </div>
                      )}
                      {item.exif.dateTime && (
                        <div>
                          <dt className="text-muted-foreground">Date</dt>
                          <dd className="font-medium">{item.exif.dateTime}</dd>
                        </div>
                      )}
                      {item.exif.iso !== null && (
                        <div>
                          <dt className="text-muted-foreground">ISO</dt>
                          <dd className="font-medium">{item.exif.iso}</dd>
                        </div>
                      )}
                      {item.exif.gps && (
                        <div className="col-span-2 sm:col-span-3">
                          <dt className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" /> GPS location
                          </dt>
                          <dd className="font-medium">{formatGpsCoordinates(item.exif.gps)}</dd>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5" /> No EXIF metadata found
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {allDone && (
            <p className="text-xs text-muted-foreground">
              All images processed. Re-download any of them above, or grab them all as a ZIP.
            </p>
          )}
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="exif-stripper" />
    </div>
  );
}

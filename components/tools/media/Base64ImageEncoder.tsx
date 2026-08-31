"use client";

import * as React from "react";
import { FileImage, Upload } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { formatBytes } from "@/lib/format";

export default function Base64ImageEncoder() {
  useTrackTool("base64-image-encoder");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fileSize, setFileSize] = React.useState(0);
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [decodeInput, setDecodeInput] = React.useState("");
  const [erroredPreview, setErroredPreview] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const handleFiles = (files: File[]) => {
    const file = files[0];
    if (!file || !file.type.startsWith("image/")) return;
    setFileName(file.name);
    setFileSize(file.size);
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      setDataUrl(result);
      await saveToolResult("base64-image-encoder", {
        title: file.name,
        summary: `${formatBytes(file.size)} → Base64 ${formatBytes(result.length)}`,
        data: result,
      });
      historyRef.current?.refresh();
    };
    reader.readAsDataURL(file);
  };

  const decodedPreview = React.useMemo(() => {
    const trimmed = decodeInput.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("data:image/")) return trimmed;
    // Assume raw base64, try to wrap it as a PNG
    return `data:image/png;base64,${trimmed}`;
  }, [decodeInput]);

  const error =
    decodedPreview && erroredPreview === decodedPreview
      ? "Could not decode this as an image. Check the Base64 string."
      : null;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="encode">
        <TabsList>
          <TabsTrigger value="encode">
            <Upload className="mr-1 h-3.5 w-3.5" /> Image → Base64
          </TabsTrigger>
          <TabsTrigger value="decode">
            <FileImage className="mr-1 h-3.5 w-3.5" /> Base64 → Image
          </TabsTrigger>
        </TabsList>

        <TabsContent value="encode" className="space-y-4">
          <DropZone
            onFiles={handleFiles}
            accept="image/*"
            multiple={false}
            label="Drag & drop an image here, or click to browse"
            hint="Convert an image into a copyable Base64 data URL"
          />

          {dataUrl && (
            <Card className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <img
                  src={dataUrl}
                  alt={fileName ?? "Preview"}
                  className="h-16 w-16 rounded-lg border border-border object-cover"
                />
                <div>
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    Original {formatBytes(fileSize)} · Base64 {formatBytes(dataUrl.length)}
                  </p>
                </div>
              </div>
              <textarea
                readOnly
                value={dataUrl}
                rows={6}
                className="w-full resize-none rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs focus:outline-none"
              />
              <CopyButton value={dataUrl} variant="secondary">
                Copy Base64 data URL
              </CopyButton>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="decode" className="space-y-4">
          <Card className="space-y-3 p-4">
            <label className="space-y-1.5 block">
              <span className="text-sm font-medium">Paste Base64 string or data URL</span>
              <textarea
                value={decodeInput}
                onChange={(e) => setDecodeInput(e.target.value)}
                placeholder="data:image/png;base64,iVBORw0KGgo..."
                rows={6}
                className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            {decodedPreview && !error && (
              <div className="space-y-2">
                <img
                  key={decodedPreview}
                  src={decodedPreview}
                  alt="Decoded preview"
                  onError={() => setErroredPreview(decodedPreview)}
                  className="max-h-64 rounded-lg border border-border object-contain"
                />
                <Button asChild variant="outline" size="sm">
                  <a href={decodedPreview} download="decoded-image.png">
                    Download image
                  </a>
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <ToolHistoryList ref={historyRef} toolSlug="base64-image-encoder" />
    </div>
  );
}

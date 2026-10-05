"use client";

import * as React from "react";
import { Download, FileImage, Upload } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { base64ToBytes, buildDataUri, bytesToBase64, parseDataUri, sniffFileType } from "@/lib/base64";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

type OutputKind = "datauri" | "raw" | "img" | "css" | "markdown";

const OUTPUTS: { id: OutputKind; label: string }[] = [
  { id: "datauri", label: "Data URI" },
  { id: "raw", label: "Raw Base64" },
  { id: "img", label: "<img> tag" },
  { id: "css", label: "CSS background" },
  { id: "markdown", label: "Markdown" },
];

interface Encoded {
  name: string;
  size: number;
  mime: string;
  base64: string;
  width: number;
  height: number;
  previewUrl: string;
}

interface Decoded {
  bytes: Uint8Array;
  mime: string;
  extension: string;
  url: string;
}

function readImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

function format(enc: Encoded, kind: OutputKind): string {
  const uri = buildDataUri(enc.mime, enc.base64);
  switch (kind) {
    case "raw":
      return enc.base64;
    case "img":
      return `<img src="${uri}"${enc.width ? ` width="${enc.width}" height="${enc.height}"` : ""} alt="">`;
    case "css":
      return `background-image: url("${uri}");`;
    case "markdown":
      return `![${enc.name.replace(/\.[^.]+$/, "")}](${uri})`;
    default:
      return uri;
  }
}

export default function Base64ImageEncoder() {
  useTrackTool("base64-image-encoder");
  const [encoded, setEncoded] = React.useState<Encoded | null>(null);
  const [kind, setKind] = React.useState<OutputKind>("datauri");
  const [encodeError, setEncodeError] = React.useState<string | null>(null);
  const [decodeInput, setDecodeInput] = React.useState("");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setEncodeError("That isn't an image file.");
      return;
    }
    setEncodeError(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = bytesToBase64(bytes);
    const mime = file.type;
    const previewUrl = buildDataUri(mime, base64);
    const size = await readImageSize(previewUrl);
    setEncoded({ name: file.name, size: file.size, mime, base64, previewUrl, ...size });
    await saveToolResult("base64-image-encoder", { title: file.name, summary: `${formatBytes(file.size)} → Base64 ${formatBytes(base64.length)}`, data: previewUrl });
    historyRef.current?.refresh();
  };

  // Picks up a "Send to..." handoff from another tool via ?from=<id>.
  useIncomingHandoff((file) => void handleFiles([file]));

  const output = encoded ? format(encoded, kind) : "";

  // Decode: read the real file type from the bytes rather than trusting a PNG guess.
  const decoded = ((): { value: Decoded | null; error: string | null } => {
    const trimmed = decodeInput.trim();
    if (!trimmed) return { value: null, error: null };
    try {
      const bytes = base64ToBytes(trimmed);
      const sniffed = sniffFileType(bytes);
      const declared = parseDataUri(trimmed)?.mime;
      const looksSvg = !sniffed && /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(new TextDecoder().decode(bytes.subarray(0, 400)));
      const mime = sniffed?.mime ?? (looksSvg ? "image/svg+xml" : (declared ?? ""));
      if (!mime.startsWith("image/")) return { value: null, error: "This Base64 doesn't decode to a recognised image (PNG, JPG, GIF, WebP, SVG…)." };
      const extension = sniffed?.extension ?? mime.split("/")[1]?.replace("svg+xml", "svg") ?? "img";
      return { value: { bytes, mime, extension, url: buildDataUri(mime, bytesToBase64(bytes)) }, error: null };
    } catch {
      return { value: null, error: "Could not decode this as Base64. Check for missing or extra characters." };
    }
  })();

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
          <DropZone onFiles={(f) => void handleFiles(f)} accept="image/*" multiple={false} label="Drag & drop an image here, or click to browse" hint="Get a data URI, raw Base64, or a ready-to-paste <img> / CSS snippet" />
          {encodeError && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {encodeError}
            </div>
          )}

          {encoded && (
            <Card className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={encoded.previewUrl} alt={encoded.name} className="h-16 w-16 rounded-lg border border-border object-cover" />
                <div>
                  <p className="text-sm font-medium">{encoded.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {encoded.width > 0 && `${encoded.width}×${encoded.height}px · `}Original {formatBytes(encoded.size)} · Base64 {formatBytes(output.length)} (~{Math.round((encoded.base64.length / Math.max(encoded.size, 1) - 1) * 100)}% larger)
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap overflow-hidden rounded-lg border border-border sm:w-fit" role="group" aria-label="Output format">
                {OUTPUTS.map((o) => (
                  <button key={o.id} onClick={() => setKind(o.id)} aria-pressed={kind === o.id} className={cn("px-3 py-1.5 text-sm font-medium transition-colors", kind === o.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                    {o.label}
                  </button>
                ))}
              </div>
              <textarea readOnly value={output} rows={6} aria-label="Output" className="w-full resize-none rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs focus:outline-none" />
              {encoded.size > 100 * 1024 && <p className="text-xs text-amber-600 dark:text-amber-400">Inlining an image over ~100 KB makes the page heavier than linking the file — Base64 is best for small icons.</p>}
              <CopyButton value={output} variant="secondary">
                Copy {OUTPUTS.find((o) => o.id === kind)?.label}
              </CopyButton>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="decode" className="space-y-4">
          <Card className="space-y-3 p-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Paste Base64 string or data URL</span>
              <textarea value={decodeInput} onChange={(e) => setDecodeInput(e.target.value)} placeholder="data:image/png;base64,iVBORw0KGgo..." rows={6} className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
            </label>
            {decoded.error && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {decoded.error}
              </div>
            )}
            {decoded.value && (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={decoded.value.url} alt="Decoded preview" className="max-h-64 rounded-lg border border-border object-contain" />
                <p className="text-xs text-muted-foreground">
                  {decoded.value.mime} · {formatBytes(decoded.value.bytes.length)}
                </p>
                <Button size="sm" variant="outline" onClick={() => downloadBlob(new Blob([decoded.value!.bytes as BlobPart], { type: decoded.value!.mime }), `decoded-image.${decoded.value!.extension}`)}>
                  <Download className="h-3.5 w-3.5" /> Download .{decoded.value.extension}
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

"use client";

import * as React from "react";
import { Hash, Loader2, Save, Upload } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { DropZone } from "@/components/tool-shell/DropZone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBytes } from "@/lib/format";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const ALGORITHMS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
type Algorithm = (typeof ALGORITHMS)[number];

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashData(data: BufferSource, algorithm: Algorithm): Promise<string> {
  const digest = await crypto.subtle.digest(algorithm, data);
  return bufferToHex(digest);
}

function formatHashesAsText(hashes: Record<string, string>): string {
  return ALGORITHMS.map((algo) => `${algo}: ${hashes[algo] ?? ""}`).join("\n");
}

export default function HashGenerator() {
  useTrackTool("hash-generator");
  const [text, setText] = React.useState("Hello, EveryUtili!");
  const [textHashes, setTextHashes] = React.useState<Record<string, string>>({});
  const [file, setFile] = React.useState<File | null>(null);
  const [fileHashes, setFileHashes] = React.useState<Record<string, string>>({});
  const [isHashingFile, setIsHashingFile] = React.useState(false);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const entries = await Promise.all(
        ALGORITHMS.map(async (algo) => [algo, text ? await hashData(data, algo) : ""] as const)
      );
      if (!cancelled) setTextHashes(Object.fromEntries(entries));
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [text]);

  const handleFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setIsHashingFile(true);
    try {
      const buffer = await f.arrayBuffer();
      const entries = await Promise.all(
        ALGORITHMS.map(async (algo) => [algo, await hashData(buffer, algo)] as const)
      );
      setFileHashes(Object.fromEntries(entries));
    } finally {
      setIsHashingFile(false);
    }
  };

  const saveTextHashes = async () => {
    if (!text || Object.keys(textHashes).length === 0) return;
    await saveToolResult("hash-generator", {
      title: `SHA-256: ${(textHashes["SHA-256"] ?? "").slice(0, 16)}…`,
      summary: `Hashes for ${text.length.toLocaleString()}-char text`,
      data: formatHashesAsText(textHashes),
    });
    historyRef.current?.refresh();
  };

  const saveFileHashes = async () => {
    if (!file || Object.keys(fileHashes).length === 0) return;
    await saveToolResult("hash-generator", {
      title: `SHA-256: ${(fileHashes["SHA-256"] ?? "").slice(0, 16)}…`,
      summary: `${file.name} (${formatBytes(file.size)})`,
      data: formatHashesAsText(fileHashes),
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="text">
        <TabsList>
          <TabsTrigger value="text">
            <Hash className="mr-1 h-3.5 w-3.5" /> Text
          </TabsTrigger>
          <TabsTrigger value="file">
            <Upload className="mr-1 h-3.5 w-3.5" /> File
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Enter text to hash…"
            className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="grid gap-2">
            {ALGORITHMS.map((algo) => (
              <Card key={algo} className="flex items-center gap-3 p-3">
                <span className="w-20 shrink-0 text-sm font-medium">{algo}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                  {textHashes[algo] || "—"}
                </span>
                <CopyButton value={textHashes[algo] ?? ""} size="sm" variant="ghost" disabled={!textHashes[algo]} />
              </Card>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={saveTextHashes} disabled={!text}>
            <Save className="h-3.5 w-3.5" /> Save result
          </Button>
        </TabsContent>

        <TabsContent value="file" className="space-y-4">
          <DropZone
            onFiles={handleFiles}
            multiple={false}
            label="Drag & drop a file here, or click to browse"
            hint="Compute cryptographic hashes of any file, entirely offline"
          />
          {file && (
            <Card className="p-3">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </Card>
          )}
          {isHashingFile && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Hashing file…
            </div>
          )}
          {!isHashingFile && file && (
            <div className="grid gap-2">
              {ALGORITHMS.map((algo) => (
                <Card key={algo} className="flex items-center gap-3 p-3">
                  <span className="w-20 shrink-0 text-sm font-medium">{algo}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                    {fileHashes[algo] || "—"}
                  </span>
                  <CopyButton value={fileHashes[algo] ?? ""} size="sm" variant="ghost" disabled={!fileHashes[algo]} />
                </Card>
              ))}
            </div>
          )}
          {!isHashingFile && file && Object.keys(fileHashes).length > 0 && (
            <Button size="sm" variant="outline" onClick={saveFileHashes}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          )}
        </TabsContent>
      </Tabs>

      <ToolHistoryList ref={historyRef} toolSlug="hash-generator" />
    </div>
  );
}

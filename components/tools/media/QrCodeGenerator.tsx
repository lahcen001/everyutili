"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Download, QrCode } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";

const COLOR_PRESETS = [
  { fg: "#000000", bg: "#ffffff", label: "Classic" },
  { fg: "#0f172a", bg: "#f0f9ff", label: "Ocean" },
  { fg: "#166534", bg: "#f0fdf4", label: "Forest" },
];

function truncateText(value: string, max = 60): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export default function QrCodeGenerator() {
  useTrackTool("qr-code-generator");
  const [text, setText] = React.useState("https://everyutili.com");
  const [size, setSize] = React.useState(320);
  const [fgColor, setFgColor] = React.useState("#000000");
  const [bgColor, setBgColor] = React.useState("#ffffff");
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const hasText = text.trim().length > 0;

  React.useEffect(() => {
    if (!hasText) return;
    let cancelled = false;
    QRCode.toDataURL(text, {
      width: size,
      margin: 2,
      color: { dark: fgColor, light: bgColor },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to generate QR code");
      });
    return () => {
      cancelled = true;
    };
  }, [hasText, text, size, fgColor, bgColor]);

  const visibleDataUrl = hasText ? dataUrl : null;

  const download = () => {
    if (!visibleDataUrl) return;
    fetch(visibleDataUrl)
      .then((res) => res.blob())
      .then(async (blob) => {
        downloadBlob(blob, "qr-code.png");
        await saveToolResult("qr-code-generator", {
          title: truncateText(text),
          summary: `${size}×${size}px PNG · ${formatBytes(blob.size)}`,
          blob,
        });
        historyRef.current?.refresh();
      });
  };

  const visibleError = hasText ? error : null;

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Text or URL</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Enter a URL, text, email, or anything else"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Size (px)</span>
            <input
              type="number"
              min={128}
              max={1024}
              step={16}
              value={size}
              onChange={(e) => setSize(Number(e.target.value) || 320)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Foreground</span>
            <input
              type="color"
              value={fgColor}
              onChange={(e) => setFgColor(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-lg border border-border bg-background"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Background</span>
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-lg border border-border bg-background"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setFgColor(preset.fg);
                setBgColor(preset.bg);
              }}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-primary"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </Card>

      {visibleError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {visibleError}
        </div>
      )}

      {visibleDataUrl && (
        <Card className="flex flex-col items-center gap-4 p-6">
          <img
            src={visibleDataUrl}
            alt="Generated QR code"
            width={256}
            height={256}
            className="rounded-lg border border-border bg-white p-2"
          />
          <Button onClick={download}>
            <Download className="h-4 w-4" /> Download PNG
          </Button>
        </Card>
      )}

      {!visibleDataUrl && !visibleError && (
        <Card className="flex h-48 items-center justify-center p-6 text-sm text-muted-foreground">
          <QrCode className="mr-2 h-5 w-5" /> Enter text above to generate a QR code
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="qr-code-generator" />
    </div>
  );
}

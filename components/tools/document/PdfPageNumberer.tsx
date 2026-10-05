"use client";

import * as React from "react";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { Hash, Loader2, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";
import { friendlyPdfError, isPdfFile } from "@/lib/pdf/errors";
import { parsePageRanges } from "@/lib/pdf/ranges";
import { formatNumeral, hexToRgb01, placeLabel, type LabelPosition, type NumeralStyle } from "@/lib/pdf/pageNumbers";

type Position = LabelPosition;

const POSITIONS: { id: Position; label: string }[] = [
  { id: "top-left", label: "Top left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
];

type FormatId = "number" | "page-number" | "number-of-total" | "dashed";

const FORMATS: { id: FormatId; label: string; render: (n: string, total: string) => string }[] = [
  { id: "number", label: "1", render: (n) => n },
  { id: "page-number", label: "Page 1", render: (n) => `Page ${n}` },
  { id: "number-of-total", label: "1 of N", render: (n, total) => `${n} of ${total}` },
  { id: "dashed", label: "- 1 -", render: (n) => `- ${n} -` },
];

const NUMERAL_STYLES: { id: NumeralStyle; label: string }[] = [
  { id: "arabic", label: "1, 2, 3" },
  { id: "roman-lower", label: "i, ii, iii" },
  { id: "roman-upper", label: "I, II, III" },
];

export default function PdfPageNumberer() {
  useTrackTool("pdf-page-numberer");
  const [file, setFile] = React.useState<File | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [position, setPosition] = React.useState<Position>("bottom-center");
  const [startNumber, setStartNumber] = React.useState(1);
  const [formatId, setFormatId] = React.useState<FormatId>("number");
  const [numeralStyle, setNumeralStyle] = React.useState<NumeralStyle>("arabic");
  const [fontSize, setFontSize] = React.useState(10);
  const [margin, setMargin] = React.useState(24);
  const [color, setColor] = React.useState("#000000");
  const [rangeText, setRangeText] = React.useState("");
  const [skipFirst, setSkipFirst] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const handleFiles = async (files: File[]) => {
    const pdfFile = files.find((f) => isPdfFile(f));
    if (!pdfFile) return;
    setError(null);
    try {
      const bytes = await pdfFile.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      setFile(pdfFile);
      setPageCount(pdf.getPageCount());
    } catch (e) {
      setError(friendlyPdfError(e, "Could not read this PDF file. It may be corrupted."));
    }
  };

  const removeFile = () => {
    setFile(null);
    setPageCount(0);
    setError(null);
  };

  const numberPdf = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const pages = pdf.getPages();
      const format = FORMATS.find((f) => f.id === formatId) ?? FORMATS[0];
      const lastNumber = startNumber + pages.length - 1;
      const size = Math.min(72, Math.max(4, fontSize));

      const range = parsePageRanges(rangeText, pages.length);
      if (range.error) {
        setError(range.error);
        return;
      }
      const numbered = new Set(range.pages);
      if (skipFirst) numbered.delete(1);
      if (numbered.size === 0) {
        setError("No pages left to number — check the page range and the skip-first option.");
        return;
      }
      const [r, g, b] = hexToRgb01(color);

      pages.forEach((page, index) => {
        if (!numbered.has(index + 1)) return;
        // Skipped pages still count, so page 2 shows "2" even when the cover is skipped.
        const label = format.render(
          formatNumeral(startNumber + index, numeralStyle),
          formatNumeral(lastNumber, numeralStyle)
        );
        const { width, height } = page.getSize();
        const placement = placeLabel({
          width,
          height,
          pageRotation: page.getRotation().angle,
          textWidth: font.widthOfTextAtSize(label, size),
          position,
          margin,
        });

        page.drawText(label, {
          x: placement.x,
          y: placement.y,
          size,
          font,
          color: rgb(r, g, b),
          rotate: degrees(placement.rotation),
        });
      });

      const outBytes = await pdf.save();
      const baseName = file.name.replace(/\.pdf$/i, "");
      const blob = new Blob([new Uint8Array(outBytes)], { type: "application/pdf" });
      const outName = `${baseName}-numbered.pdf`;
      downloadBlob(blob, outName);

      await saveToolResult("pdf-page-numberer", {
        title: outName,
        summary: `${numbered.size} of ${pageCount} page${pageCount === 1 ? "" : "s"} numbered · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch (e) {
      setError(friendlyPdfError(e, "Failed to number pages."));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <DropZone
        onFiles={handleFiles}
        accept="application/pdf"
        multiple={false}
        label="Drag & drop a PDF here, or click to browse"
        hint="Stamp page numbers onto every page and download the result"
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
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.size)} · {pageCount} pages
              </p>
            </div>
            <button
              onClick={removeFile}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </Card>

          <Card className="space-y-4 p-4">
            <div className="space-y-2">
              <span className="text-sm font-medium">Position</span>
              <div className="grid grid-cols-3 gap-2 sm:w-fit sm:grid-cols-3">
                {POSITIONS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPosition(p.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      position === p.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Starting number</span>
                <input
                  type="number"
                  min={0}
                  value={startNumber}
                  onChange={(e) => setStartNumber(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>

              <div className="space-y-1.5">
                <span className="text-sm font-medium">Format</span>
                <div className="flex flex-wrap gap-2">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFormatId(f.id)}
                      className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                        formatId === f.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Number style</span>
              <div className="flex flex-wrap gap-2">
                {NUMERAL_STYLES.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setNumeralStyle(n.id)}
                    aria-pressed={numeralStyle === n.id}
                    className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                      numeralStyle === n.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Font size (pt)</span>
                <input
                  type="number"
                  min={4}
                  max={72}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value) || 10)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Margin from edge (pt)</span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={margin}
                  onChange={(e) => setMargin(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Color</span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-lg border border-border bg-background p-1"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Pages to number</span>
                <input
                  value={rangeText}
                  onChange={(e) => setRangeText(e.target.value)}
                  placeholder="All pages — or e.g. 2-10, 12"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={skipFirst}
                  onChange={(e) => setSkipFirst(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Skip the first page (cover) — it still counts toward numbering
              </label>
            </div>

            <Button onClick={numberPdf} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Numbering…
                </>
              ) : (
                <>
                  <Hash className="h-4 w-4" /> Number Pages & Download
                </>
              )}
            </Button>
          </Card>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="pdf-page-numberer" />
    </div>
  );
}

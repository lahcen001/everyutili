"use client";

import * as React from "react";
import { AlertTriangle, Download, FileText, Loader2, X } from "lucide-react";

import { DocPreview } from "@/components/tools/document/DocPreview";
import { ThemePicker } from "@/components/tools/document/DocOptions";
import { DropZone } from "@/components/tool-shell/DropZone";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { blocksToHtml } from "@/lib/office/docModel";
import { getDocTheme } from "@/lib/office/docThemes";
import { DEFAULT_PAGE, PAPER_MM, type PageSettings, type PaperSize } from "@/lib/office/pageSettings";
import { friendlyPdfError, isPdfFile } from "@/lib/pdf/errors";
import { openPdf } from "@/lib/pdf/pdfjs";
import { parsePageRanges } from "@/lib/pdf/ranges";
import { itemsToPdfLines, linesToBlocks, looksScanned, type PdfLine } from "@/lib/pdf/toDocx";
import type { PdfTextItem } from "@/lib/pdf/text";
import { sanitizeHtml } from "@/lib/sanitize";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";

export default function PdfToWord() {
  useTrackTool("pdf-to-word");
  const [file, setFile] = React.useState<{ name: string; size: number } | null>(null);
  const [pages, setPages] = React.useState<PdfLine[][]>([]);
  const [rangeText, setRangeText] = React.useState("");
  const [removeRunning, setRemoveRunning] = React.useState(true);
  const [themeId, setThemeId] = React.useState("clean");
  const [paper, setPaper] = React.useState<PaperSize>("a4");
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [building, setBuilding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const range = parsePageRanges(rangeText, pages.length);
  const chosen = React.useMemo(() => (range.error ? [] : range.pages.map((n) => pages[n - 1]).filter(Boolean)), [range.error, range.pages, pages]);
  const blocks = React.useMemo(() => linesToBlocks(chosen, { removeRunningText: removeRunning }), [chosen, removeRunning]);
  const theme = getDocTheme(themeId);
  const page: PageSettings = { ...DEFAULT_PAGE, size: paper, pageNumbers: false, marginMm: 20 };
  const html = React.useMemo(() => sanitizeHtml(blocksToHtml(blocks)), [blocks]);
  const scanned = pages.length > 0 && looksScanned(pages);
  const plainText = blocks.map((b) => ("runs" in b ? b.runs.map((r) => r.text).join("") : b.type === "list" ? b.items.map((i) => `• ${i.runs.map((r) => r.text).join("")}`).join("\n") : "")).filter(Boolean).join("\n\n");

  const open = async (files: File[]) => {
    const f = files.find(isPdfFile);
    if (!f) return setError("Please choose a PDF file.");
    setError(null);
    setPages([]);
    setFile({ name: f.name, size: f.size });
    try {
      const { pdf, destroy } = await openPdf(new Uint8Array(await f.arrayBuffer()));
      try {
        const out: PdfLine[][] = [];
        setProgress({ done: 0, total: pdf.numPages });
        for (let n = 1; n <= pdf.numPages; n++) {
          const pdfPage = await pdf.getPage(n);
          const content = await pdfPage.getTextContent();
          const items: PdfTextItem[] = content.items.filter((it): it is typeof it & PdfTextItem => "str" in it).map((it) => ({ str: it.str, transform: it.transform, width: it.width, height: it.height }));
          out.push(itemsToPdfLines(items));
          pdfPage.cleanup();
          setProgress({ done: n, total: pdf.numPages });
        }
        const first = await pdf.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        const short = Math.min(vp.width, vp.height);
        setPaper(Math.abs(short - 612) < 8 ? (Math.max(vp.width, vp.height) > 900 ? "legal" : "letter") : Math.abs(short - 420) < 8 ? "a5" : "a4");
        setPages(out);
      } finally {
        await destroy();
        setProgress(null);
      }
    } catch (e) {
      setFile(null);
      setProgress(null);
      setError(friendlyPdfError(e, "Could not read the text of this PDF."));
    }
  };

  const download = async () => {
    if (!file || blocks.length === 0) return;
    setBuilding(true);
    setError(null);
    try {
      const { blocksToDocxBlob } = await import("@/lib/office/docxExport");
      const stem = file.name.replace(/\.pdf$/i, "");
      const blob = await blocksToDocxBlob(blocks, theme, page, { title: stem, author: "", date: "" });
      const name = `${stem}.docx`;
      downloadBlob(blob, name);
      await saveToolResult("pdf-to-word", { title: name, summary: `${chosen.length} page${chosen.length === 1 ? "" : "s"} · ${blocks.length} blocks · ${formatBytes(blob.size)}`, blob });
      historyRef.current?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the Word file.");
    } finally {
      setBuilding(false);
    }
  };

  if (!file) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={(f) => void open(f)} accept="application/pdf" multiple={false} label="Drag & drop a PDF to turn into Word, or click to browse" hint="Rebuilds headings, paragraphs and lists as an editable .docx — basic conversion, entirely in your browser" />
        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <ToolHistoryList ref={historyRef} toolSlug="pdf-to-word" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-3 p-3 text-sm">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{file.name}</span>
        <span className="text-muted-foreground">{formatBytes(file.size)}</span>
        {progress ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading page {progress.done} of {progress.total}…
          </span>
        ) : (
          <span className="text-muted-foreground">
            {pages.length} page{pages.length === 1 ? "" : "s"} · {blocks.length} blocks found
          </span>
        )}
        <button onClick={() => { setFile(null); setPages([]); }} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
          <X className="h-3.5 w-3.5" /> Choose another
        </button>
      </Card>

      {scanned && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>This PDF has almost no text layer — it is probably a scan (pictures of pages). Reading text from images needs OCR, which this tool doesn&apos;t do, so the Word file would be empty.</span>
        </div>
      )}

      {pages.length > 0 && !scanned && (
        <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="space-y-3 p-4">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Pages (blank = all)</span>
                <input value={rangeText} onChange={(e) => setRangeText(e.target.value)} placeholder="e.g. 1-5, 9" className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
                <span className={range.error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{range.error ?? `${chosen.length} of ${pages.length} pages`}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={removeRunning} onChange={(e) => setRemoveRunning(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" /> Remove repeating headers, footers and page numbers
              </label>
              <label className="flex items-center gap-2 text-sm">
                Paper
                <select value={paper} onChange={(e) => setPaper(e.target.value as PaperSize)} className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm">
                  {(Object.keys(PAPER_MM) as PaperSize[]).map((id) => (
                    <option key={id} value={id}>
                      {PAPER_MM[id].label}
                    </option>
                  ))}
                </select>
              </label>
            </Card>
            <Card className="space-y-2 p-4">
              <p className="text-sm font-medium">Word style</p>
              <ThemePicker value={themeId} onChange={setThemeId} />
            </Card>
            <div className="flex flex-wrap gap-2">
              <Button onClick={download} disabled={building || blocks.length === 0}>
                {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download .docx
              </Button>
              <CopyButton value={plainText} variant="outline" disabled={!plainText}>
                Copy text
              </CopyButton>
            </div>
            <p className="text-xs text-muted-foreground">A basic conversion: headings (found by font size), paragraphs and lists are rebuilt as real, editable Word content. Tables, images, columns and exact layout are not carried over, so check the result.</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Preview of the Word document</p>
            {blocks.length === 0 ? <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">No text found in the chosen pages.</p> : <DocPreview html={html} theme={theme} page={page} />}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <ToolHistoryList ref={historyRef} toolSlug="pdf-to-word" />
    </div>
  );
}

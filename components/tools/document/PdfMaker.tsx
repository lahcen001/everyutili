"use client";

import * as React from "react";
import { Download, FileText, Loader2, Printer, X } from "lucide-react";

import { DocPreview } from "@/components/tools/document/DocPreview";
import { PageSettingsPanel, ThemePicker } from "@/components/tools/document/DocOptions";
import { DropZone } from "@/components/tool-shell/DropZone";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { blocksToHtml, parseHtml, parseMarkdown, parsePlainText, type Block } from "@/lib/office/docModel";
import { getDocTheme } from "@/lib/office/docThemes";
import { readDocxBlocks } from "@/lib/office/docxRead";
import { DEFAULT_PAGE, type PageSettings } from "@/lib/office/pageSettings";
import { htmlToPdfBlob, layoutDocument, printDocument, type PdfLayout } from "@/lib/office/pdfExport";
import { readAnyWorkbook, workbookToBlocks } from "@/lib/office/sheets";
import { sanitizeHtml } from "@/lib/sanitize";
import { formatBytes } from "@/lib/format";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";
import type { WorkBook } from "xlsx";

type Source = "file" | "write";
type WriteMode = "markdown" | "text" | "html";

const ACCEPT = ".docx,.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.json,.txt,.md,.markdown,.html,.htm";
const SHEET_EXT = ["xlsx", "xls", "xlsm", "ods", "csv", "tsv", "json"];

interface LoadedFile {
  name: string;
  kind: "docx" | "sheet";
  blocks: Block[];
  workbook?: WorkBook;
  warnings: string[];
}

const SAMPLE = "# Meeting notes\n\nAdd your text, Markdown or HTML here — or upload a Word, Excel or CSV file.\n\n- Pick a style\n- Choose the paper size\n- Check the pages on the right";

export default function PdfMaker() {
  useTrackTool("pdf-maker");
  const [source, setSource] = React.useState<Source>("write");
  const [writeMode, setWriteMode] = React.useState<WriteMode>("markdown");
  const [text, setText] = React.useState(SAMPLE);
  const [loaded, setLoaded] = React.useState<LoadedFile | null>(null);
  const [sheetChoice, setSheetChoice] = React.useState<Set<string>>(new Set());
  const [themeId, setThemeId] = React.useState("clean");
  const [page, setPage] = React.useState<PageSettings>(DEFAULT_PAGE);
  const [fontSize, setFontSize] = React.useState<number | null>(null);
  const [layout, setLayout] = React.useState<PdfLayout | null>(null);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [isBuilding, setIsBuilding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const theme = getDocTheme(themeId);
  const effectiveFont = fontSize ?? theme.baseSize;

  let blocks: Block[] = [];
  let truncated = false;
  if (source === "file" && loaded) {
    if (loaded.kind === "docx") blocks = loaded.blocks;
    else if (loaded.workbook) {
      const result = workbookToBlocks(loaded.workbook, loaded.workbook.SheetNames.filter((n) => sheetChoice.has(n)));
      blocks = result.blocks;
      truncated = result.truncated;
    }
  } else if (source === "write") {
    blocks = writeMode === "markdown" ? parseMarkdown(text) : writeMode === "text" ? parsePlainText(text) : parseHtml(text);
  }
  const html = sanitizeHtml(blocksToHtml(blocks));
  const wideTable = blocks.some((b) => b.type === "table" && (b.header?.length ?? b.rows[0]?.length ?? 0) >= 7);

  React.useEffect(() => {
    if (!html) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const next = await layoutDocument(html, theme, page, fontSize ?? undefined);
        if (!cancelled) setLayout(next);
      } catch {
        if (!cancelled) setLayout(null);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [html, theme, page, fontSize]);

  const handleFile = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    try {
      if (ext === "docx") {
        const { blocks: docBlocks, warnings } = await readDocxBlocks(file);
        setLoaded({ name: file.name, kind: "docx", blocks: docBlocks, warnings });
        setSource("file");
      } else if (SHEET_EXT.includes(ext)) {
        const { workbook } = await readAnyWorkbook(file);
        setLoaded({ name: file.name, kind: "sheet", blocks: [], workbook, warnings: [] });
        setSheetChoice(new Set(workbook.SheetNames));
        setSource("file");
        if (workbook.SheetNames.length > 0) setPage((p) => p);
      } else if (["txt", "md", "markdown", "html", "htm"].includes(ext)) {
        setText(await file.text());
        setWriteMode(ext === "txt" ? "text" : ext.startsWith("htm") ? "html" : "markdown");
        setSource("write");
        setLoaded(null);
      } else {
        setError("This file type isn't supported. Try .docx, .xlsx, .xls, .ods, .csv, .tsv, .json, .txt, .md or .html.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
    }
  };

  const stem = source === "file" && loaded ? loaded.name.replace(/\.[^.]+$/, "") : "document";

  const makePdf = async () => {
    setIsBuilding(true);
    setError(null);
    setProgress(null);
    try {
      const blob = await htmlToPdfBlob(html, theme, page, { fontSizePt: fontSize ?? undefined, onProgress: (done, total) => setProgress({ done, total }) });
      const fileName = `${stem}.pdf`;
      downloadBlob(blob, fileName);
      await saveToolResult("pdf-maker", { title: fileName, summary: `${layout?.slices.length ?? "?"} pages · ${theme.name} · ${formatBytes(blob.size)}`, blob });
      historyRef.current?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the PDF.");
    } finally {
      setIsBuilding(false);
      setProgress(null);
    }
  };

  const print = () => {
    setError(null);
    try {
      printDocument(html, theme, page, fontSize ?? undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the print view.");
    }
  };

  const pages = layout?.slices.length ?? 0;

  return (
    <div className="space-y-6">
      <DropZone onFiles={handleFile} accept={ACCEPT} multiple={false} label="Drag & drop a file to turn into PDF, or click to browse" hint="Word, Excel, CSV, JSON, Markdown, HTML or plain text — or just write below" />

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-1" role="tablist" aria-label="Content source">
        {([["write", "Write or paste"], ["file", loaded ? `File: ${loaded.name}` : "Uploaded file"]] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={source === id}
            disabled={id === "file" && !loaded}
            onClick={() => setSource(id)}
            className={cn("max-w-xs truncate rounded-md px-3 py-1 text-sm font-medium transition-colors disabled:opacity-40", source === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          {source === "write" ? (
            <>
              <div className="flex gap-1" role="group" aria-label="Input type">
                {(["markdown", "text", "html"] as const).map((m) => (
                  <button key={m} onClick={() => setWriteMode(m)} aria-pressed={writeMode === m} className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize", writeMode === m ? "bg-secondary" : "text-muted-foreground hover:bg-muted")}>
                    {m === "text" ? "Plain text" : m}
                  </button>
                ))}
              </div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Document content" className="h-[26rem] w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary" />
            </>
          ) : loaded ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="truncate font-medium">{loaded.name}</span>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { setLoaded(null); setSource("write"); }}>
                  <X className="h-3.5 w-3.5" /> Remove
                </Button>
              </div>
              {loaded.kind === "sheet" && loaded.workbook && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Sheets to include</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {loaded.workbook.SheetNames.map((n) => (
                      <label key={n} className="flex items-center gap-1.5">
                        <input type="checkbox" checked={sheetChoice.has(n)} onChange={() => setSheetChoice((prev) => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next; })} className="h-4 w-4 rounded border-border" />
                        {n}
                      </label>
                    ))}
                  </div>
                  {truncated && <p className="text-xs text-amber-600 dark:text-amber-400">Very long sheets are cut to their first 3,000 rows so the PDF stays usable.</p>}
                </div>
              )}
              {loaded.warnings.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">{loaded.warnings.length} formatting notice{loaded.warnings.length === 1 ? "" : "s"} from the Word file</summary>
                  <ul className="mt-1 list-disc space-y-1 pl-4">{loaded.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </details>
              )}
              <p className="text-xs text-muted-foreground">This is a faithful rendering of the file&apos;s content and tables, not a copy of its exact page layout.</p>
            </div>
          ) : null}
        </Card>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            Page preview {pages > 0 && <span className="font-normal text-muted-foreground">— {pages} page{pages === 1 ? "" : "s"}</span>}
          </p>
          <DocPreview html={html} theme={theme} page={page} layout={layout} fontSizePt={fontSize ?? undefined} headerFooter />
          {pages > 60 && <p className="text-xs text-amber-600 dark:text-amber-400">This is a long document — building the PDF can take a while.</p>}
        </div>
      </div>

      <Card className="space-y-4 p-4">
        <p className="text-sm font-medium">Style and page</p>
        <ThemePicker value={themeId} onChange={setThemeId} />
        <label className="flex flex-wrap items-center gap-3 text-sm">
          Text size: <span className="font-medium">{effectiveFont} pt</span>
          <input type="range" min={7} max={18} step={0.5} value={effectiveFont} onChange={(e) => setFontSize(Number(e.target.value))} aria-label="Text size in points" className="w-48" />
          {fontSize !== null && <button onClick={() => setFontSize(null)} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Reset</button>}
        </label>
        <PageSettingsPanel page={page} onChange={setPage} />
        {wideTable && page.orientation === "portrait" && (
          <p className="text-xs text-muted-foreground">
            This table is wide.{" "}
            <button onClick={() => setPage({ ...page, orientation: "landscape" })} className="underline underline-offset-2 hover:text-foreground">Switch to landscape</button>
          </p>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={makePdf} disabled={isBuilding || blocks.length === 0}>
          {isBuilding ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {progress ? `Page ${progress.done} of ${progress.total}…` : "Preparing…"}
            </>
          ) : (
            <>
              <Download className="h-4 w-4" /> Download PDF
            </>
          )}
        </Button>
        <Button variant="outline" onClick={print} disabled={blocks.length === 0}>
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        <strong>Download PDF</strong> turns each page into an image — it looks identical everywhere, but the text can&apos;t be selected. <strong>Print / Save as PDF</strong> opens your browser&apos;s print dialog; choose &ldquo;Save as PDF&rdquo; there to keep selectable, searchable text.
      </p>

      <ToolHistoryList ref={historyRef} toolSlug="pdf-maker" />
    </div>
  );
}

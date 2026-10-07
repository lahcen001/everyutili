"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, CopyPlus, Download, FilePlus2, FileText, Loader2, Plus, RotateCcw, RotateCw, Trash2, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { buildOrganizedPdf, duplicateItem, insertBlankAfter, interleaveDuplex, moveItem, oddThenEven, removeItems, reverseItems, rotateItems, type PageItem } from "@/lib/pdf/organize";
import { friendlyPdfError, isPdfFile } from "@/lib/pdf/errors";
import { canvasToBlob, openPdf, renderPageCanvas } from "@/lib/pdf/pdfjs";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";

interface Source {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  thumbs: (string | null)[];
  sizes: { width: number; height: number }[];
}

const MAX_PAGES = 400;
let counter = 0;
const newId = () => `p${++counter}`;
const TAG_COLORS = ["bg-blue-500/15 text-blue-700 dark:text-blue-300", "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", "bg-amber-500/15 text-amber-700 dark:text-amber-300", "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300", "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"];

export default function OrganizePdf() {
  useTrackTool("organize-pdf");
  const [sources, setSources] = React.useState<Source[]>([]);
  const [items, setItems] = React.useState<PageItem[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [dropIndex, setDropIndex] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const urlsRef = React.useRef<string[]>([]);
  const moreRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const addFiles = async (files: File[]) => {
    const pdfs = files.filter(isPdfFile);
    if (pdfs.length === 0) {
      setError("Please add PDF files.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      for (const file of pdfs) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { pdf, destroy } = await openPdf(bytes);
        try {
          if (items.length + pdf.numPages > MAX_PAGES) throw new Error(`That would be more than ${MAX_PAGES} pages — organise a smaller file or split it first.`);
          const sourceIndex = sources.length + pdfs.indexOf(file);
          const thumbs: (string | null)[] = new Array(pdf.numPages).fill(null);
          const sizes: Source["sizes"] = [];
          for (let n = 1; n <= pdf.numPages; n++) {
            const page = await pdf.getPage(n);
            const vp = page.getViewport({ scale: 1 });
            sizes.push({ width: vp.width, height: vp.height });
            const canvas = await renderPageCanvas(pdf, n, 0.32);
            const url = URL.createObjectURL(await canvasToBlob(canvas, "image/jpeg", 0.8));
            urlsRef.current.push(url);
            thumbs[n - 1] = url;
          }
          const source: Source = { name: file.name, bytes, pageCount: pdf.numPages, thumbs, sizes };
          setSources((prev) => [...prev, source]);
          setItems((prev) => [...prev, ...Array.from({ length: pdf.numPages }, (_, i): PageItem => ({ id: newId(), kind: "page", source: sourceIndex, page: i, rotation: 0 }))]);
        } finally {
          await destroy();
        }
      }
    } catch (e) {
      setError(friendlyPdfError(e, "Could not read this PDF."));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string, additive: boolean) =>
    setSelected((prev) => {
      const next = additive ? new Set(prev) : new Set<string>();
      if (prev.has(id) && (additive || prev.size === 1)) next.delete(id);
      else next.add(id);
      return next;
    });
  const targets = (id?: string) => (id ? new Set([id]) : selected);
  const indexOf = (id: string) => items.findIndex((i) => i.id === id);

  const sizeAt = (index: number) => {
    const it = items[index];
    if (!it) return undefined;
    if (it.kind === "blank") return { width: it.width, height: it.height };
    return sources[it.source]?.sizes[it.page];
  };

  const exportPdf = async () => {
    if (items.length === 0) return;
    setExporting(true);
    setError(null);
    try {
      const bytes = await buildOrganizedPdf(sources.map((s) => s.bytes), items);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const name = sources.length === 1 ? sources[0].name.replace(/\.pdf$/i, "") + "-organized.pdf" : "organized.pdf";
      downloadBlob(blob, name);
      await saveToolResult("organize-pdf", { title: name, summary: `${items.length} pages · ${formatBytes(blob.size)}`, blob });
      historyRef.current?.refresh();
    } catch (e) {
      setError(friendlyPdfError(e, "Could not build the PDF."));
    } finally {
      setExporting(false);
    }
  };

  const reset = () => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setSources([]);
    setItems([]);
    setSelected(new Set());
  };

  const hasSelection = selected.size > 0;
  const tool = "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="space-y-5">
      {sources.length === 0 ? (
        <DropZone onFiles={(f) => void addFiles(f)} accept="application/pdf" label="Drag & drop PDFs here, or click to browse" hint="Reorder, rotate, duplicate and delete pages — add several files to combine them" />
      ) : (
        <>
          <Card className="space-y-3 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {sources.map((s, i) => (
                <span key={i} className={cn("inline-flex max-w-56 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", TAG_COLORS[i % TAG_COLORS.length])} title={s.name}>
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate">{s.name}</span>
                  <span className="opacity-70">({s.pageCount})</span>
                </span>
              ))}
              <button className={tool} onClick={() => moreRef.current?.click()} disabled={loading}>
                <Plus className="h-3.5 w-3.5" /> Add PDF
              </button>
              <input ref={moreRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
              <button className={cn(tool, "ml-auto")} onClick={reset}>
                <X className="h-3.5 w-3.5" /> Start over
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3" role="toolbar" aria-label="Page actions">
              <span className="mr-1 text-xs text-muted-foreground">{hasSelection ? `${selected.size} selected` : "Click pages to select"}</span>
              <button className={tool} disabled={!hasSelection} onClick={() => setItems(rotateItems(items, selected, -90))}>
                <RotateCcw className="h-3.5 w-3.5" /> Left
              </button>
              <button className={tool} disabled={!hasSelection} onClick={() => setItems(rotateItems(items, selected, 90))}>
                <RotateCw className="h-3.5 w-3.5" /> Right
              </button>
              <button className={tool} disabled={!hasSelection} onClick={() => { let next = items; for (const it of items.filter((i) => selected.has(i.id))) { const idx = next.findIndex((n) => n.id === it.id); next = duplicateItem(next, idx, newId()); } setItems(next); }}>
                <CopyPlus className="h-3.5 w-3.5" /> Duplicate
              </button>
              <button className={tool} disabled={!hasSelection} onClick={() => { let next = items; for (const it of items.filter((i) => selected.has(i.id))) { const idx = next.findIndex((n) => n.id === it.id); next = insertBlankAfter(next, idx, newId(), sizeAt(items.findIndex((n) => n.id === it.id))); } setItems(next); }}>
                <FilePlus2 className="h-3.5 w-3.5" /> Blank after
              </button>
              <button className={cn(tool, "text-destructive")} disabled={!hasSelection} onClick={() => { setItems(removeItems(items, selected)); setSelected(new Set()); }}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
              <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
              <button className={tool} onClick={() => setItems(reverseItems(items))} title="Reverse the order of all pages">
                Reverse all
              </button>
              <button className={tool} onClick={() => setItems(oddThenEven(items))} title="Pages 1,3,5… then 2,4,6…">
                Odd, then even
              </button>
              <button className={tool} onClick={() => setItems(interleaveDuplex(items))} title="Merge a front-side scan with a back-side scan fed in reverse">
                Interleave duplex scan
              </button>
              <button className={tool} disabled={!hasSelection} onClick={() => setSelected(new Set())}>
                Clear selection
              </button>
              <button className={tool} onClick={() => setSelected(new Set(items.map((i) => i.id)))}>
                Select all
              </button>
            </div>
          </Card>

          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-label="Pages">
              {items.map((it, index) => {
                const src = it.kind === "page" ? sources[it.source] : null;
                const thumb = src?.thumbs[it.kind === "page" ? it.page : 0] ?? null;
                const isSelected = selected.has(it.id);
                const rotation = it.kind === "page" ? it.rotation : 0;
                return (
                  <li
                    key={it.id}
                    draggable
                    onDragStart={(e) => {
                      setDragIndex(index);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropIndex(index);
                    }}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDropIndex(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex !== null) setItems(moveItem(items, dragIndex, index));
                      setDragIndex(null);
                      setDropIndex(null);
                    }}
                    className={cn("group relative rounded-lg border-2 bg-card transition-colors", isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50", dropIndex === index && dragIndex !== null && dragIndex !== index && "border-dashed border-primary", dragIndex === index && "opacity-40")}
                  >
                    <button type="button" onClick={(e) => toggle(it.id, e.metaKey || e.ctrlKey || e.shiftKey || selected.size > 0)} className="block w-full overflow-hidden rounded-t-md" aria-pressed={isSelected} aria-label={`Page ${index + 1}${it.kind === "blank" ? " (blank)" : ""}`}>
                      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden bg-white">
                        {it.kind === "blank" ? (
                          <span className="text-xs text-muted-foreground">Blank page</span>
                        ) : thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" draggable={false} className="max-h-full max-w-full object-contain transition-transform" style={{ transform: `rotate(${rotation}deg)${rotation % 180 ? " scale(0.75)" : ""}` }} />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    <div className="flex items-center justify-between gap-1 px-1.5 py-1 text-[11px] text-muted-foreground">
                      <span className="tabular-nums">
                        {index + 1}
                        {it.kind === "page" && sources.length > 1 && <span className="ml-1 opacity-70">· {src?.name.slice(0, 8)} p{it.page + 1}</span>}
                      </span>
                      <span className="flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <button aria-label="Move earlier" disabled={index === 0} onClick={() => setItems(moveItem(items, index, index - 1))} className="rounded p-0.5 hover:bg-muted disabled:opacity-30">
                          <ArrowLeft className="h-3 w-3" />
                        </button>
                        <button aria-label="Move later" disabled={index === items.length - 1} onClick={() => setItems(moveItem(items, index, index + 1))} className="rounded p-0.5 hover:bg-muted disabled:opacity-30">
                          <ArrowRight className="h-3 w-3" />
                        </button>
                        <button aria-label="Delete this page" onClick={() => { setItems(removeItems(items, targets(it.id))); setSelected((s) => { const n = new Set(s); n.delete(it.id); return n; }); }} className="rounded p-0.5 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
            {items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">All pages deleted — add a PDF or start over.</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={exportPdf} disabled={exporting || items.length === 0 || loading}>
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Building…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Download PDF ({items.length} page{items.length === 1 ? "" : "s"})
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">Drag pages to reorder. Original text, links and quality are kept — pages are copied, not re-rendered.</p>
          </div>
        </>
      )}

      {loading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading pages…
        </p>
      )}
      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="organize-pdf" />
    </div>
  );
}

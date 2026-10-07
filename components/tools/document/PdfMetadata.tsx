"use client";

import * as React from "react";
import { Download, Eraser, FileText, Loader2, ShieldCheck, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { friendlyPdfError, isPdfFile } from "@/lib/pdf/errors";
import { EMPTY_INFO, applyPdfInfo, fromLocalInput, paperName, pointsToMm, readPdfInfo, toLocalInput, type PdfFacts, type PdfInfo } from "@/lib/pdf/info";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";

const inputClass = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export default function PdfMetadata() {
  useTrackTool("pdf-metadata");
  const [file, setFile] = React.useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [facts, setFacts] = React.useState<PdfFacts | null>(null);
  const [info, setInfo] = React.useState<PdfInfo>(EMPTY_INFO);
  const [removeXmp, setRemoveXmp] = React.useState(true);
  const [touchModified, setTouchModified] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const open = async (files: File[]) => {
    const f = files.find(isPdfFile);
    if (!f) return setError("Please choose a PDF file.");
    setError(null);
    setBusy(true);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const read = await readPdfInfo(bytes);
      setFile({ name: f.name, bytes });
      setFacts(read);
      setInfo(read.info);
    } catch (e) {
      setError(friendlyPdfError(e, "Could not read this PDF."));
    } finally {
      setBusy(false);
    }
  };

  const set = (patch: Partial<PdfInfo>) => setInfo((prev) => ({ ...prev, ...patch }));
  const foundCount = facts ? Object.entries(facts.info).filter(([, v]) => (typeof v === "string" ? v.trim() !== "" : v !== null)).length : 0;
  const changed = facts ? JSON.stringify(info) !== JSON.stringify(facts.info) : false;

  const save = async (override?: { info: PdfInfo; removeXmp: boolean; suffix: string }) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const out = await applyPdfInfo(file.bytes, override?.info ?? info, { removeXmp: override?.removeXmp ?? removeXmp, touchModified: override ? false : touchModified });
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      const name = file.name.replace(/\.pdf$/i, "") + (override?.suffix ?? "-edited") + ".pdf";
      downloadBlob(blob, name);
      await saveToolResult("pdf-metadata", { title: name, summary: override ? "All metadata removed" : `Title: ${info.title || "—"} · ${formatBytes(blob.size)}`, blob });
      historyRef.current?.refresh();
    } catch (e) {
      setError(friendlyPdfError(e, "Could not save this PDF."));
    } finally {
      setBusy(false);
    }
  };

  if (!file || !facts) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={(f) => void open(f)} accept="application/pdf" multiple={false} label="Drag & drop a PDF here, or click to browse" hint="See and edit the hidden title, author and dates — or remove them before sharing" />
        {busy && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading…
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <ToolHistoryList ref={historyRef} toolSlug="pdf-metadata" />
      </div>
    );
  }

  const paper = paperName(facts.pageSize.width, facts.pageSize.height);

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <FileText className="h-4 w-4 text-muted-foreground" /> {file.name}
        </span>
        <span className="text-muted-foreground">{formatBytes(file.bytes.length)}</span>
        <span className="text-muted-foreground">
          {facts.pageCount} page{facts.pageCount === 1 ? "" : "s"}
        </span>
        <span className="text-muted-foreground">
          {paper ?? "Custom size"} · {pointsToMm(facts.pageSize.width).toFixed(0)} × {pointsToMm(facts.pageSize.height).toFixed(0)} mm
        </span>
        <span className={foundCount > 0 || facts.hasXmp ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
          {foundCount > 0 || facts.hasXmp ? `${foundCount} metadata field${foundCount === 1 ? "" : "s"} found${facts.hasXmp ? " + XMP data" : ""}` : "No metadata found"}
        </span>
        <button onClick={() => { setFile(null); setFacts(null); }} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
          <X className="h-3.5 w-3.5" /> Choose another
        </button>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">
            <input value={info.title} onChange={(e) => set({ title: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Author">
            <input value={info.author} onChange={(e) => set({ author: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Subject">
            <input value={info.subject} onChange={(e) => set({ subject: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Keywords" hint="Separate with commas">
            <input value={info.keywords} onChange={(e) => set({ keywords: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Created with (creator)" hint="The program that made the original document">
            <input value={info.creator} onChange={(e) => set({ creator: e.target.value })} className={inputClass} />
          </Field>
          <Field label="PDF producer" hint="The program that wrote the PDF file">
            <input value={info.producer} onChange={(e) => set({ producer: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Created">
            <input type="datetime-local" value={toLocalInput(info.creationDate)} onChange={(e) => set({ creationDate: fromLocalInput(e.target.value) })} className={inputClass} />
          </Field>
          <Field label="Last modified">
            <input type="datetime-local" value={toLocalInput(info.modificationDate)} onChange={(e) => set({ modificationDate: fromLocalInput(e.target.value) })} disabled={touchModified} className={inputClass} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={removeXmp} onChange={(e) => setRemoveXmp(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" /> Also remove XMP data {facts.hasXmp ? "(this file has some)" : ""}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={touchModified} onChange={(e) => setTouchModified(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" /> Set “last modified” to now
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Save changes{changed ? "" : " (nothing changed)"}
          </Button>
          <Button variant="outline" onClick={() => setInfo(EMPTY_INFO)}>
            <Eraser className="h-4 w-4" /> Clear all fields
          </Button>
          <Button variant="outline" onClick={() => void save({ info: EMPTY_INFO, removeXmp: true, suffix: "-clean" })} disabled={busy}>
            <ShieldCheck className="h-4 w-4" /> Download with all metadata removed
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Metadata can reveal who wrote a document, with what software and when. This tool changes only those fields; the pages are kept exactly as they are. Content hidden inside pages (such as comments or form data) is not touched.</p>
      </Card>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <ToolHistoryList ref={historyRef} toolSlug="pdf-metadata" />
    </div>
  );
}

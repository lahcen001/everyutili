"use client";

import * as React from "react";
import { Download, FileText, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { countWords, readDocx, stripHtmlImages, stripMarkdownImages, wrapHtmlDocument, type DocxContent } from "@/lib/office/docxRead";
import { sanitizeHtml } from "@/lib/sanitize";
import { formatBytes } from "@/lib/format";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";

type Tab = "html" | "markdown" | "text";
const TABS: { id: Tab; label: string; extension: string; mime: string }[] = [
  { id: "html", label: "HTML", extension: "html", mime: "text/html" },
  { id: "markdown", label: "Markdown", extension: "md", mime: "text/markdown" },
  { id: "text", label: "Plain text", extension: "txt", mime: "text/plain" },
];

export default function WordConverter() {
  useTrackTool("word-converter");
  const [file, setFile] = React.useState<File | null>(null);
  const [content, setContent] = React.useState<DocxContent | null>(null);
  const [tab, setTab] = React.useState<Tab>("html");
  const [htmlView, setHtmlView] = React.useState<"preview" | "code">("preview");
  const [includeImages, setIncludeImages] = React.useState(true);
  const [fullPage, setFullPage] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const handleFiles = async (files: File[]) => {
    const picked = files[0];
    if (!picked) return;
    setError(null);
    if (!/\.docx$/i.test(picked.name)) {
      setError("Please choose a .docx file. Older .doc files must be re-saved as .docx in Word first.");
      return;
    }
    try {
      setContent(await readDocx(picked));
      setFile(picked);
    } catch {
      setError("Could not read this Word document. It may be damaged or password-protected.");
    }
  };

  const stem = file ? file.name.replace(/\.[^.]+$/, "") : "document";
  const output = (() => {
    if (!content) return "";
    if (tab === "text") return content.text;
    if (tab === "markdown") return includeImages ? content.markdown : stripMarkdownImages(content.markdown);
    const body = includeImages ? content.html : stripHtmlImages(content.html);
    return fullPage ? wrapHtmlDocument(body, stem) : body;
  })();
  const imageCount = content ? (content.html.match(/<img\b/gi) ?? []).length : 0;
  const meta = TABS.find((t) => t.id === tab)!;

  const download = async () => {
    const blob = new Blob([output], { type: `${meta.mime};charset=utf-8` });
    const name = `${stem}.${meta.extension}`;
    downloadBlob(blob, name);
    await saveToolResult("word-converter", { title: name, summary: `${meta.label} · ${formatBytes(blob.size)}`, blob });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      {!content && (
        <DropZone
          onFiles={handleFiles}
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple={false}
          label="Drag & drop a Word file here, or click to browse"
          hint="Get clean HTML, Markdown or plain text from a .docx"
        />
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {content && file && (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm font-medium">{file.name}</p>
            <span className="text-xs text-muted-foreground">
              {countWords(content.text).toLocaleString()} words · {content.text.length.toLocaleString()} characters · {imageCount} image{imageCount === 1 ? "" : "s"}
            </span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setContent(null); setFile(null); }}>
              <X className="h-3.5 w-3.5" /> Open another file
            </Button>
          </div>

          {content.warnings.length > 0 && (
            <details className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Converted with {content.warnings.length} formatting notice{content.warnings.length === 1 ? "" : "s"}</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {content.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1" role="tablist" aria-label="Output format">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn("rounded-md px-3 py-1 text-sm font-medium transition-colors", tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab !== "text" && imageCount > 0 && (
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} className="h-4 w-4 rounded border-border" />
                Include images (embedded)
              </label>
            )}
            {tab === "html" && (
              <>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={fullPage} onChange={(e) => setFullPage(e.target.checked)} className="h-4 w-4 rounded border-border" />
                  Full HTML page
                </label>
                <div className="flex gap-1" role="group" aria-label="HTML view">
                  {(["preview", "code"] as const).map((v) => (
                    <button key={v} onClick={() => setHtmlView(v)} aria-pressed={htmlView === v} className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize", htmlView === v ? "bg-secondary" : "text-muted-foreground hover:bg-muted")}>
                      {v}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {tab === "html" && htmlView === "preview" ? (
            <div
              className="max-h-96 overflow-auto rounded-lg border border-border bg-white p-4 text-sm text-black [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_img]:max-w-full [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_ul]:ml-5 [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(includeImages ? content.html : stripHtmlImages(content.html)) }}
            />
          ) : (
            <textarea readOnly value={output} aria-label={`${meta.label} output`} className="h-80 w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-xs outline-none" />
          )}

          <div className="flex flex-wrap gap-2">
            <CopyButton value={output} variant="outline" size="sm">
              Copy {meta.label}
            </CopyButton>
            <Button size="sm" onClick={download}>
              <Download className="h-3.5 w-3.5" /> Download .{meta.extension}
            </Button>
          </div>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="word-converter" />
    </div>
  );
}

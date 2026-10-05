"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";

import { DocPreview } from "@/components/tools/document/DocPreview";
import { PageSettingsPanel, ThemePicker } from "@/components/tools/document/DocOptions";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { blocksToHtml, parseHtml, parseMarkdown, parsePlainText, runsToText, type Block } from "@/lib/office/docModel";
import { getDocTheme } from "@/lib/office/docThemes";
import { DEFAULT_PAGE, type PageSettings } from "@/lib/office/pageSettings";
import { sanitizeHtml } from "@/lib/sanitize";
import { formatBytes } from "@/lib/format";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";

type Mode = "markdown" | "text" | "html";

const MODES: { id: Mode; label: string; placeholder: string }[] = [
  { id: "markdown", label: "Markdown", placeholder: "# Title\n\nWrite with **bold**, *italic*, lists, tables, quotes and links." },
  { id: "text", label: "Plain text", placeholder: "Type or paste text. A blank line starts a new paragraph." },
  { id: "html", label: "HTML", placeholder: "<h1>Title</h1>\n<p>Paste HTML — headings, lists, tables and links are kept.</p>" },
];

const SAMPLE = `# Project Proposal

A short introduction with **bold**, *italic* text and a [link](https://example.com).

## Goals

- Launch the new site
  - Redesign the homepage
  - Move to the new CMS
- Reduce support tickets

1. Research
2. Prototype
3. Ship

## Budget

| Item | Cost |
|---|---|
| Design | $4,000 |
| Development | $9,500 |

> Good design is as little design as possible.

---

Thank you for your time.`;

function fileStem(blocks: Block[]): string {
  const heading = blocks.find((b): b is Extract<Block, { type: "heading" }> => b.type === "heading");
  const text = heading ? runsToText(heading.runs) : "";
  return text.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "document";
}

export default function WordMaker() {
  useTrackTool("word-maker");
  const [mode, setMode] = React.useState<Mode>("markdown");
  const [text, setText] = React.useState(SAMPLE);
  const [themeId, setThemeId] = React.useState("clean");
  const [page, setPage] = React.useState<PageSettings>(DEFAULT_PAGE);
  const [isBuilding, setIsBuilding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const theme = getDocTheme(themeId);
  const blocks = mode === "markdown" ? parseMarkdown(text) : mode === "text" ? parsePlainText(text) : parseHtml(text);
  const html = sanitizeHtml(blocksToHtml(blocks));
  const imageCount = blocks.filter((b) => b.type === "image").length;

  const loadFile = async (file: File) => {
    const content = await file.text();
    const ext = file.name.toLowerCase().split(".").pop();
    setMode(ext === "html" || ext === "htm" ? "html" : ext === "txt" ? "text" : "markdown");
    setText(content);
  };

  const download = async () => {
    setIsBuilding(true);
    setError(null);
    try {
      const { blocksToDocxBlob } = await import("@/lib/office/docxExport");
      const blob = await blocksToDocxBlob(blocks, theme, page);
      const fileName = `${fileStem(blocks)}.docx`;
      downloadBlob(blob, fileName);
      await saveToolResult("word-maker", { title: fileName, summary: `${theme.name} · ${page.size.toUpperCase()} · ${formatBytes(blob.size)}`, blob });
      historyRef.current?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the Word document.");
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1" role="tablist" aria-label="Input type">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", mode === m.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <label className="ml-auto cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Open .md / .txt / .html
              <input
                type="file"
                accept=".md,.markdown,.txt,.html,.htm,text/markdown,text/plain,text/html"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) loadFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={MODES.find((m) => m.id === mode)?.placeholder}
            spellCheck={mode === "text"}
            aria-label="Document content"
            className="h-[28rem] w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          {imageCount > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {imageCount} picture{imageCount === 1 ? "" : "s"} found — pictures aren&apos;t included in the Word file. Use the PDF Maker if you need them.
            </p>
          )}
        </Card>

        <div className="space-y-2">
          <p className="text-sm font-medium">Live preview</p>
          <DocPreview html={html} theme={theme} page={page} />
          <p className="text-xs text-muted-foreground">Word decides the exact page breaks when you open the file.</p>
        </div>
      </div>

      <Card className="space-y-4 p-4">
        <p className="text-sm font-medium">Style</p>
        <ThemePicker value={themeId} onChange={setThemeId} />
        <PageSettingsPanel page={page} onChange={setPage} />
      </Card>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button onClick={download} disabled={isBuilding || blocks.length === 0}>
        {isBuilding ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Creating…
          </>
        ) : (
          <>
            <Download className="h-4 w-4" /> Download .docx
          </>
        )}
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="word-maker" />
    </div>
  );
}

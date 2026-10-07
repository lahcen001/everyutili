"use client";

import { FileDropTarget } from "@/components/tool-shell/FileDropTarget";
import * as React from "react";
import { marked } from "marked";
import { Download, Eraser, FileText, FileUp, Save } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { CodeEditor } from "@/components/tools/developer/workspace/CodeEditor";
import { SplitPane } from "@/components/tools/developer/workspace/SplitPane";
import { Pane, ToolbarButton, ToolbarSeparator, ToolbarToggle, Workspace } from "@/components/tools/developer/workspace/Workspace";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { sanitizeHtml } from "@/lib/sanitize";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";

const SAMPLE = `# Welcome to EveryUtili

This is a **live Markdown previewer** — everything renders _entirely_ in your browser.

## Features

- [x] No sign-up required
- [x] Instant preview that follows your scrolling
- [ ] Your ideas here

> Paste your own Markdown on the left to see it rendered on the right.

### A table

| Tool | Category | Private |
| ---- | -------- | :-----: |
| JSON Formatter | Developer | Yes |
| Merge PDF | Document | Yes |

### Some code

\`\`\`js
const greeting = "Hello, world!";
console.log(greeting);
\`\`\`

Inline \`code\`, ~~strikethrough~~ and a [link](https://everyutili.com).

---

1. First
2. Second
3. Third
`;

const PREVIEW_STYLES = `[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-2 [&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1:first-child]:mt-0
[&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-1.5 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight
[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:mt-4 [&_h4]:font-semibold
[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6
[&_li]:my-1 [&_li:has(input)]:list-none [&_li>input]:mr-2 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:bg-muted/30 [&_blockquote]:py-1 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground
[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]
[&_pre]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted/60 [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0
[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_tr:nth-child(even)]:bg-muted/20
[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg [&_hr]:my-6 [&_hr]:border-border`;

const EXPORT_CSS = "body{max-width:760px;margin:2rem auto;padding:0 1rem;font:16px/1.6 system-ui,sans-serif;color:#1f2328}pre{background:#f6f8fa;padding:1rem;overflow:auto;border-radius:6px}code{background:#f6f8fa;padding:.15em .35em;border-radius:4px}pre code{padding:0;background:none}table{border-collapse:collapse}td,th{border:1px solid #d0d7de;padding:.4em .8em}blockquote{border-left:4px solid #d0d7de;margin-left:0;padding-left:1rem;color:#57606a}img{max-width:100%}";

function markdownTitle(markdown: string): string {
  const heading = markdown.match(/^#{1,6}\s+(.+)$/m);
  return heading ? heading[1].trim() : "Markdown snippet";
}

export default function MarkdownPreviewer() {
  useTrackTool("markdown-previewer");
  const [markdown, setMarkdown] = React.useState(SAMPLE);
  const [breaks, setBreaks] = React.useState(false);
  const [syncScroll, setSyncScroll] = React.useState(true);
  const [tab, setTab] = React.useState<"preview" | "html">("preview");
  const previewRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const html = React.useMemo(() => sanitizeHtml(marked.parse(markdown, { async: false, breaks, gfm: true }) as string), [markdown, breaks]);

  const words = markdown.trim() === "" ? 0 : markdown.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 238));

  const onScrollRatio = (ratio: number) => {
    const el = previewRef.current;
    if (!syncScroll || !el) return;
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
  };

  const save = async () => {
    await saveToolResult("markdown-previewer", { title: markdownTitle(markdown), summary: `${markdown.length.toLocaleString()} chars`, data: markdown });
    historyRef.current?.refresh();
  };
  const restore = (item: ToolHistoryItem) => {
    if (item.data) setMarkdown(item.data);
  };
  const exportHtml = () => `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${markdownTitle(markdown).replace(/</g, "&lt;")}</title>\n<style>${EXPORT_CSS}</style>\n</head>\n<body>\n${html}\n</body>\n</html>\n`;

  const toolbar = (
    <>
      <ToolbarButton icon={<FileText className="h-3.5 w-3.5" />} onClick={() => setMarkdown(SAMPLE)}>
        Sample
      </ToolbarButton>
      <ToolbarButton icon={<FileUp className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()}>
        Open
      </ToolbarButton>
      <input ref={fileRef} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setMarkdown(await f.text()); }} />
      <ToolbarButton icon={<Eraser className="h-3.5 w-3.5" />} onClick={() => setMarkdown("")} disabled={!markdown}>
        Clear
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarToggle label="Line breaks" checked={breaks} onChange={setBreaks} />
      <ToolbarToggle label="Sync scroll" checked={syncScroll} onChange={setSyncScroll} />
      <div className="ml-auto flex items-center gap-2">
        <CopyButton value={html} size="sm" variant="outline" disabled={!markdown}>
          Copy HTML
        </CopyButton>
        <ToolbarButton icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadBlob(new Blob([markdown], { type: "text/markdown" }), "document.md")} disabled={!markdown}>
          .md
        </ToolbarButton>
        <ToolbarButton icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadBlob(new Blob([exportHtml()], { type: "text/html" }), "document.html")} disabled={!markdown}>
          .html
        </ToolbarButton>
        <ToolbarButton icon={<Save className="h-3.5 w-3.5" />} onClick={save} disabled={!markdown}>
          Save
        </ToolbarButton>
      </div>
    </>
  );

  const tabButtons = (
    <div className="flex gap-0.5" role="tablist" aria-label="Output view">
      {(["preview", "html"] as const).map((t) => (
        <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded px-2.5 py-1 text-xs font-medium transition-colors", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          {t === "preview" ? "Preview" : "HTML"}
        </button>
      ))}
    </div>
  );

  return (
    <FileDropTarget label="Drop a Markdown file" onFiles={async (f) => setMarkdown(await f[0].text())} className="space-y-4">
      <Workspace
        toolbar={toolbar}
        status={
          <>
            <span>{words.toLocaleString()} words</span>
            <span>{markdown.length.toLocaleString()} characters</span>
            <span>{markdown === "" ? 0 : markdown.split("\n").length} lines</span>
            <span>~{minutes} min read</span>
          </>
        }
      >
        <SplitPane
          left={
            <Pane title="Markdown">
              <CodeEditor value={markdown} onChange={setMarkdown} language="markdown" wordWrap onScrollRatio={onScrollRatio} ariaLabel="Markdown input" />
            </Pane>
          }
          right={
            <Pane title={tabButtons} className="[&>header]:py-1">
              {tab === "preview" ? <div ref={previewRef} className={cn("h-full overflow-auto p-5 text-sm leading-relaxed", PREVIEW_STYLES)} dangerouslySetInnerHTML={{ __html: html }} /> : <CodeEditor value={html} language="html" readOnly wordWrap ariaLabel="Generated HTML" />}
            </Pane>
          }
        />
      </Workspace>
      <ToolHistoryList ref={historyRef} toolSlug="markdown-previewer" onRestore={restore} />
    </FileDropTarget>
  );
}

"use client";

import * as React from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Eye, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const SAMPLE = `# Welcome to EveryUtili

This is a **live Markdown previewer** — everything renders _entirely_ in your browser.

## Features

- No sign-up required
- Instant preview
- Sanitized HTML output

> Paste your own Markdown to see it rendered on the right.

\`\`\`js
console.log("Hello, world!");
\`\`\`

[Learn more](https://everyutili.com)
`;

function markdownTitle(markdown: string): string {
  const heading = markdown.match(/^#{1,6}\s+(.+)$/m);
  return heading ? heading[1].trim() : "Markdown snippet";
}

export default function MarkdownPreviewer() {
  useTrackTool("markdown-previewer");
  const [markdown, setMarkdown] = React.useState(SAMPLE);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const html = React.useMemo(() => {
    const rawHtml = marked.parse(markdown, { async: false, breaks: true }) as string;
    return DOMPurify.sanitize(rawHtml);
  }, [markdown]);

  const saveResult = async () => {
    if (!markdown) return;
    await saveToolResult("markdown-previewer", {
      title: markdownTitle(markdown),
      summary: `${markdown.length.toLocaleString()} chars`,
      data: markdown,
    });
    historyRef.current?.refresh();
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (item.data) setMarkdown(item.data);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">Markdown</p>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            rows={18}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button size="sm" variant="outline" onClick={saveResult} disabled={!markdown}>
            <Save className="h-3.5 w-3.5" /> Save result
          </Button>
        </Card>

        <Card className="space-y-2 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Eye className="h-4 w-4 text-muted-foreground" /> Preview
          </p>
          <div
            className="max-w-none overflow-auto rounded-lg border border-border bg-muted/10 p-4 text-sm leading-relaxed
              [&_h1]:mt-4 [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:first:mt-0
              [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight
              [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold
              [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6
              [&_li]:my-0.5 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
              [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground
              [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs
              [&_pre]:my-2 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0
              [&_hr]:my-4 [&_hr]:border-border"
            style={{ minHeight: "420px", maxHeight: "420px" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Card>
      </div>

      <ToolHistoryList ref={historyRef} toolSlug="markdown-previewer" onRestore={restoreResult} />
    </div>
  );
}

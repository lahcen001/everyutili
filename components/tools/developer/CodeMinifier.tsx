"use client";

import * as React from "react";
import { Minimize, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { formatBytes } from "@/lib/format";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

type Mode = "html" | "css";

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
  <head>
    <!-- page title -->
    <title>Demo</title>
  </head>
  <body>
    <p>Hello   world</p>
    <pre>  keep   this   spacing  </pre>
  </body>
</html>`;

const SAMPLE_CSS = `/* base styles */
body {
  margin: 0 ;
  padding : 0;
  font-family: sans-serif ;
}

.card {
  color: #333 ;
  content: " / " ;
}`;

function minifyCss(css: string): string {
  let result = "";
  let i = 0;
  const n = css.length;

  while (i < n) {
    const ch = css[i];

    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }

    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && css[j] !== ch) {
        if (css[j] === "\\") j++;
        j++;
      }
      j = Math.min(j + 1, n);
      result += css.slice(i, j);
      i = j;
      continue;
    }

    result += ch;
    i++;
  }

  return result
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

function minifyHtml(html: string): string {
  let stripped = "";
  let i = 0;
  const n = html.length;

  while (i < n) {
    if (html[i] === "<" && html[i + 1] === "!" && html[i + 2] === "-" && html[i + 3] === "-") {
      const end = html.indexOf("-->", i + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    stripped += html[i];
    i++;
  }

  const segments: { text: string; preserve: boolean }[] = [];
  let cursor = 0;
  const tagPattern = /<(pre|textarea|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(stripped)) !== null) {
    if (match.index > cursor) {
      segments.push({ text: stripped.slice(cursor, match.index), preserve: false });
    }
    segments.push({ text: match[0], preserve: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < stripped.length) {
    segments.push({ text: stripped.slice(cursor), preserve: false });
  }

  return segments
    .map((seg) => {
      if (seg.preserve) return seg.text;
      return seg.text
        .replace(/>\s+</g, "><")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join("\n")
        .replace(/\n+/g, "\n");
    })
    .join("")
    .trim();
}

function tagLabel(mode: Mode): string {
  return mode === "html" ? "HTML" : "CSS";
}

export default function CodeMinifier() {
  useTrackTool("code-minifier");
  const [mode, setMode] = React.useState<Mode>("html");
  const [htmlInput, setHtmlInput] = React.useState(SAMPLE_HTML);
  const [cssInput, setCssInput] = React.useState(SAMPLE_CSS);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const input = mode === "html" ? htmlInput : cssInput;
  const setInput = mode === "html" ? setHtmlInput : setCssInput;

  const output = React.useMemo(
    () => (mode === "html" ? minifyHtml(htmlInput) : minifyCss(cssInput)),
    [mode, htmlInput, cssInput]
  );

  const beforeBytes = new Blob([input]).size;
  const afterBytes = new Blob([output]).size;
  const savedPct = beforeBytes > 0 ? Math.max(0, Math.round((1 - afterBytes / beforeBytes) * 100)) : 0;

  const saveResult = async () => {
    if (!output) return;
    await saveToolResult("code-minifier", {
      title: `Minified ${tagLabel(mode)}`,
      summary: `${formatBytes(beforeBytes)} → ${formatBytes(afterBytes)}`,
      data: output,
    });
    historyRef.current?.refresh();
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (item.data) setInput(item.data);
  };

  return (
    <div className="space-y-6">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="html">HTML</TabsTrigger>
          <TabsTrigger value="css">CSS</TabsTrigger>
        </TabsList>
        <TabsContent value="html" />
        <TabsContent value="css" />
      </Tabs>

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Minimize className="h-4 w-4" /> Minified automatically as you type
        </span>
        <Badge variant="success" className="ml-auto">
          Saved {savedPct}% ({formatBytes(beforeBytes)} → {formatBytes(afterBytes)})
        </Badge>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">{tagLabel(mode)} input</p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={16}
            spellCheck={false}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Card>

        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">Minified output</p>
          <pre className="h-[calc(16*1.35rem+1.5rem)] min-h-[300px] overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs">
            {output || "—"}
          </pre>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={output} variant="secondary" disabled={!output}>
              Copy result
            </CopyButton>
            <Button size="sm" variant="outline" onClick={saveResult} disabled={!output}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          </div>
        </Card>
      </div>

      <ToolHistoryList ref={historyRef} toolSlug="code-minifier" onRestore={restoreResult} />
    </div>
  );
}

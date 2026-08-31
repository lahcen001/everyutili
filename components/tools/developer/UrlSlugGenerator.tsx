"use client";

import * as React from "react";
import { Link2, Save } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

type Separator = "-" | "_";

const DEFAULT_MAX_LENGTH = 60;

function slugify(text: string, separator: Separator, maxLength: number): string {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const withSeparators = normalized
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`\\${separator}+`, "g"), separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), "");

  if (withSeparators.length <= maxLength) return withSeparators;

  const truncated = withSeparators.slice(0, maxLength);
  const lastSeparatorIdx = truncated.lastIndexOf(separator);
  const trimmed = lastSeparatorIdx > 0 ? truncated.slice(0, lastSeparatorIdx) : truncated;
  return trimmed.replace(new RegExp(`\\${separator}+$`), "");
}

export default function UrlSlugGenerator() {
  useTrackTool("url-slug-generator");
  const [input, setInput] = React.useState("10 Best Practices for Writing Clean Code in 2026!");
  const [separator, setSeparator] = React.useState<Separator>("-");
  const [maxLength, setMaxLength] = React.useState(DEFAULT_MAX_LENGTH);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const slug = React.useMemo(
    () => slugify(input, separator, Math.max(1, maxLength || DEFAULT_MAX_LENGTH)),
    [input, separator, maxLength]
  );

  const saveResult = async () => {
    if (!slug) return;
    const preview = input.length > 60 ? `${input.slice(0, 60)}…` : input;
    await saveToolResult("url-slug-generator", {
      title: slug,
      summary: `from: ${preview}`,
      data: slug,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Title or text</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            placeholder="Enter a blog post title or page name…"
            className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        <div className="flex flex-wrap items-end gap-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Separator</span>
            <div className="flex overflow-hidden rounded-lg border border-border">
              <button
                onClick={() => setSeparator("-")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  separator === "-" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                Hyphen (-)
              </button>
              <button
                onClick={() => setSeparator("_")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  separator === "_" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                Underscore (_)
              </button>
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Max length</span>
            <input
              type="number"
              min={1}
              value={maxLength}
              onChange={(e) => setMaxLength(Number(e.target.value))}
              className="w-24 rounded-lg border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>
      </Card>

      <Card className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Link2 className="h-4 w-4 text-muted-foreground" /> Slug
          </p>
          <CopyButton value={slug} size="sm" variant="outline" disabled={!slug} />
        </div>
        <div className="min-h-[48px] break-all rounded-lg border border-border bg-muted/20 p-3 font-mono text-sm">
          {slug || <span className="font-sans text-muted-foreground">Your generated slug will appear here.</span>}
        </div>
        <Button size="sm" variant="outline" onClick={saveResult} disabled={!slug}>
          <Save className="h-3.5 w-3.5" /> Save result
        </Button>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="url-slug-generator" />
    </div>
  );
}

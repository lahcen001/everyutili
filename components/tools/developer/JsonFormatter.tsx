"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AlertCircle, CheckCircle2, Sparkles, TreePine, Code2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { JsonTreeViewer } from "@/components/tools/developer/JsonTreeViewer";
import { jsonToCsv } from "@/lib/jsonToCsv";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
      Loading editor…
    </div>
  ),
});

const SAMPLE = JSON.stringify(
  { id: 1, name: "EveryUtili", tags: ["fast", "private", "free"], active: true },
  null,
  2
);

interface ParseResult {
  parsed: unknown;
  error: string | null;
}

function parseJson(raw: string): ParseResult {
  try {
    return { parsed: JSON.parse(raw), error: null };
  } catch (e) {
    return { parsed: undefined, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

function snippetTitle(value: unknown): string {
  if (Array.isArray(value)) return `Array (${value.length} items)`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return `Object (${keys.length} keys)`;
  }
  return "JSON snippet";
}

export default function JsonFormatter() {
  useTrackTool("json-formatter");
  const [raw, setRaw] = React.useState(SAMPLE);
  const { parsed, error } = React.useMemo(() => parseJson(raw), [raw]);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const saveSnippet = React.useCallback(async (formatted: string, value: unknown) => {
    await saveToolResult("json-formatter", {
      title: snippetTitle(value),
      summary: `${formatted.length.toLocaleString()} characters`,
      data: formatted,
    });
    historyRef.current?.refresh();
  }, []);

  const formatJson = async () => {
    try {
      const value = JSON.parse(raw);
      const formatted = JSON.stringify(value, null, 2);
      setRaw(formatted);
      await saveSnippet(formatted, value);
    } catch {
      // leave raw untouched; error already surfaced
    }
  };

  const minifyJson = () => {
    try {
      const value = JSON.parse(raw);
      setRaw(JSON.stringify(value));
    } catch {
      // leave raw untouched
    }
  };

  const restoreSnippet = (item: ToolHistoryItem) => {
    if (item.data) setRaw(item.data);
  };

  const csv = React.useMemo(() => {
    if (error) return "";
    try {
      return jsonToCsv(parsed);
    } catch {
      return "";
    }
  }, [parsed, error]);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <Button size="sm" variant="outline" onClick={formatJson} disabled={!!error}>
          <Sparkles className="h-3.5 w-3.5" /> Format
        </Button>
        <Button size="sm" variant="outline" onClick={minifyJson} disabled={!!error}>
          <Code2 className="h-3.5 w-3.5" /> Minify
        </Button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {error ? (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-4 w-4" /> Invalid JSON
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Valid JSON
            </span>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <MonacoEditor
            height="420px"
            defaultLanguage="json"
            value={raw}
            onChange={(value) => setRaw(value ?? "")}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </Card>

        <Tabs defaultValue="tree">
          <TabsList>
            <TabsTrigger value="tree">
              <TreePine className="mr-1 h-3.5 w-3.5" /> Tree View
            </TabsTrigger>
            <TabsTrigger value="csv">CSV Export</TabsTrigger>
          </TabsList>
          <TabsContent value="tree">
            {!error ? (
              <JsonTreeViewer data={parsed} />
            ) : (
              <div className="flex h-[420px] items-center justify-center rounded-lg border border-border text-sm text-muted-foreground">
                Fix JSON errors to preview the tree
              </div>
            )}
          </TabsContent>
          <TabsContent value="csv">
            {!error && csv ? (
              <div className="space-y-2">
                <pre className="max-h-[370px] overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs">
                  {csv}
                </pre>
                <CopyButton value={csv} size="sm" variant="outline">
                  Copy CSV
                </CopyButton>
              </div>
            ) : (
              <div className="flex h-[420px] items-center justify-center rounded-lg border border-border text-sm text-muted-foreground">
                No tabular data to export
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CopyButton value={raw} variant="secondary">
        Copy JSON
      </CopyButton>

      <ToolHistoryList ref={historyRef} toolSlug="json-formatter" onRestore={restoreSnippet} />
    </div>
  );
}

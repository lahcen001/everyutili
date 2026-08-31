"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AlertCircle, CheckCircle2, Download, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { downloadBlob } from "@/lib/downloadBlob";
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
  [
    { name: "Ada Lovelace", role: "Engineer", city: "London" },
    { name: "Grace Hopper", role: "Admiral", city: "New York" },
  ],
  null,
  2
);

interface ConvertResult {
  csv: string;
  rowCount: number;
  error: string | null;
}

function convert(raw: string): ConvertResult {
  try {
    const parsed = JSON.parse(raw);
    const csv = jsonToCsv(parsed);
    const rowCount = Array.isArray(parsed) ? parsed.length : 1;
    return { csv, rowCount, error: null };
  } catch (e) {
    return { csv: "", rowCount: 0, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

export default function JsonToCsvConverter() {
  useTrackTool("json-to-csv");
  const [input, setInput] = React.useState(SAMPLE);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const { csv, rowCount, error } = React.useMemo(() => convert(input), [input]);

  const saveResult = async () => {
    if (!csv) return;
    await saveToolResult("json-to-csv", {
      title: `${rowCount} row${rowCount === 1 ? "" : "s"} exported`,
      summary: `${csv.length.toLocaleString()} characters`,
      data: csv,
    });
    historyRef.current?.refresh();
  };

  const downloadCsv = () => {
    if (!csv) return;
    downloadBlob(new Blob([csv], { type: "text/csv" }), "converted.csv");
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (item.data) setInput(item.data);
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <p className="text-sm text-muted-foreground">
          Paste a JSON array of objects (or a single object) to convert to CSV.
        </p>
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
            value={input}
            onChange={(value) => setInput(value ?? "")}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </Card>

        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">CSV output</p>
          {!error && csv ? (
            <pre className="h-[370px] overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs">
              {csv}
            </pre>
          ) : (
            <div className="flex h-[370px] items-center justify-center rounded-lg border border-border text-sm text-muted-foreground">
              {error ? "Fix JSON errors to convert" : "No tabular data to export"}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <CopyButton value={csv} variant="secondary" disabled={!csv}>
              Copy CSV
            </CopyButton>
            <Button size="sm" variant="outline" onClick={downloadCsv} disabled={!csv}>
              <Download className="h-3.5 w-3.5" /> Download .csv
            </Button>
            <Button size="sm" variant="outline" onClick={saveResult} disabled={!csv}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          </div>
        </Card>
      </div>

      <ToolHistoryList ref={historyRef} toolSlug="json-to-csv" onRestore={restoreResult} />
    </div>
  );
}

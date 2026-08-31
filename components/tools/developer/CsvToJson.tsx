"use client";

import * as React from "react";
import { ArrowLeftRight, FileJson2, Save } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { jsonToCsv } from "@/lib/jsonToCsv";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

type Mode = "csv-to-json" | "json-to-csv";

const SAMPLE_CSV = `name,role,city\nAda Lovelace,Engineer,London\nGrace Hopper,Admiral,New York`;
const SAMPLE_JSON = JSON.stringify(
  [
    { name: "Ada Lovelace", role: "Engineer", city: "London" },
    { name: "Grace Hopper", role: "Admiral", city: "New York" },
  ],
  null,
  2
);

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function csvToJson(csv: string): { result: string; error: string | null } {
  try {
    const lines = csv.trim().split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length === 0) return { result: "[]", error: null };
    const headers = parseCsvLine(lines[0]);
    const rows = lines.slice(1).map((line) => {
      const cells = parseCsvLine(line);
      return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
    });
    return { result: JSON.stringify(rows, null, 2), error: null };
  } catch (e) {
    return { result: "", error: e instanceof Error ? e.message : "Failed to parse CSV" };
  }
}

function jsonToCsvSafe(json: string): { result: string; error: string | null } {
  try {
    const parsed = JSON.parse(json);
    return { result: jsonToCsv(parsed), error: null };
  } catch (e) {
    return { result: "", error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

export default function CsvToJson() {
  useTrackTool("csv-to-json");
  const [mode, setMode] = React.useState<Mode>("csv-to-json");
  const [input, setInput] = React.useState(SAMPLE_CSV);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const { result, error } = React.useMemo(
    () => (mode === "csv-to-json" ? csvToJson(input) : jsonToCsvSafe(input)),
    [mode, input]
  );

  const swap = () => {
    const next = mode === "csv-to-json" ? "json-to-csv" : "csv-to-json";
    setMode(next);
    setInput(result || (next === "csv-to-json" ? SAMPLE_CSV : SAMPLE_JSON));
  };

  const saveResult = async () => {
    if (!result) return;
    await saveToolResult("csv-to-json", {
      title: mode === "csv-to-json" ? "Converted to JSON" : "Converted to CSV",
      summary: `${result.length.toLocaleString()} chars`,
      data: result,
    });
    historyRef.current?.refresh();
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (item.data) setInput(item.data);
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            onClick={() => setMode("csv-to-json")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "csv-to-json" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            CSV → JSON
          </button>
          <button
            onClick={() => setMode("json-to-csv")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "json-to-csv" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            JSON → CSV
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={swap}>
          <ArrowLeftRight className="h-3.5 w-3.5" /> Swap
        </Button>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">{mode === "csv-to-json" ? "CSV input" : "JSON input"}</p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={14}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Card>

        <Card className="space-y-2 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <FileJson2 className="h-4 w-4 text-muted-foreground" />
            {mode === "csv-to-json" ? "JSON output" : "CSV output"}
          </p>
          {error ? (
            <div className="flex h-[300px] items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 px-3 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <textarea
              readOnly
              value={result}
              rows={14}
              className="w-full resize-none rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs focus:outline-none"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <CopyButton value={result} variant="secondary" disabled={!result}>
              Copy result
            </CopyButton>
            <Button size="sm" variant="outline" onClick={saveResult} disabled={!result}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          </div>
        </Card>
      </div>

      <ToolHistoryList ref={historyRef} toolSlug="csv-to-json" onRestore={restoreResult} />
    </div>
  );
}

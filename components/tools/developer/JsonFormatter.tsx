"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Download, Eraser, FileUp, FileText, Minimize2, Save, Sparkles, Wand2 } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { JsonTreeViewer } from "@/components/tools/developer/JsonTreeViewer";
import { CodeEditor, type EditorMarker, type JumpRequest } from "@/components/tools/developer/workspace/CodeEditor";
import { SplitPane } from "@/components/tools/developer/workspace/SplitPane";
import { Pane, ToolbarButton, ToolbarSelect, ToolbarSeparator, ToolbarToggle, Workspace } from "@/components/tools/developer/workspace/Workspace";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { jsonStats, minifyJsonAst, parseJsonAst, printJson, repairJson, toTableRows } from "@/lib/json";
import { queryJsonPath } from "@/lib/jsonPath";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";

const SAMPLE = JSON.stringify(
  {
    id: 1,
    name: "EveryUtili",
    version: "2.4.0",
    active: true,
    tags: ["fast", "private", "free"],
    owner: { name: "Ada", email: "ada@example.com", roles: ["admin", "editor"] },
    users: [
      { id: 101, name: "Grace", plan: "pro", seats: 12 },
      { id: 102, name: "Linus", plan: "free", seats: 1 },
      { id: 103, name: "Margaret", plan: "team", seats: 40 },
    ],
    bigId: 12345678901234567890,
  },
  null,
  2
);

type ViewTab = "formatted" | "tree" | "table" | "query";
const TABS: { id: ViewTab; label: string }[] = [
  { id: "formatted", label: "Formatted" },
  { id: "tree", label: "Tree" },
  { id: "table", label: "Table" },
  { id: "query", label: "Query" },
];
const INDENTS = [
  { value: "2", label: "2 spaces" },
  { value: "4", label: "4 spaces" },
  { value: "tab", label: "Tab" },
];
const TABLE_ROW_LIMIT = 500;
const TABLE_COLUMN_LIMIT = 40;

function cell(v: unknown): string {
  if (v === undefined) return "";
  if (v === null) return "null";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

export default function JsonFormatter() {
  useTrackTool("json-formatter");
  const [raw, setRaw] = React.useState(SAMPLE);
  const [indent, setIndent] = React.useState("2");
  const [sortKeys, setSortKeys] = React.useState(false);
  const [tab, setTab] = React.useState<ViewTab>("formatted");
  const [query, setQuery] = React.useState("$.users[*].name");
  const [cursor, setCursor] = React.useState({ line: 1, column: 1 });
  const [jump, setJump] = React.useState<JumpRequest | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const outcome = React.useMemo(() => parseJsonAst(raw), [raw]);
  const printOpts = { indent: indent === "tab" ? ("tab" as const) : Number(indent), sortKeys };
  const formatted = outcome.ok ? printJson(outcome.ast, printOpts) : "";
  const stats = outcome.ok ? jsonStats(outcome.ast) : null;
  // Tree, table and query work on real JS values (very large integers display rounded there; the Formatted tab keeps them exact).
  const value = React.useMemo(() => {
    if (!outcome.ok) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }, [outcome, raw]);
  const repair = React.useMemo(() => {
    if (outcome.ok || raw.trim() === "") return null;
    const r = repairJson(raw);
    return r.fixes.length > 0 && parseJsonAst(r.text).ok ? r : null;
  }, [outcome, raw]);

  const markers = React.useMemo<EditorMarker[]>(() => (outcome.ok ? [] : [{ line: outcome.error.line, column: outcome.error.column, message: outcome.error.message }]), [outcome]);
  const lines = raw === "" ? 0 : raw.split("\n").length;
  const bytes = new Blob([raw]).size;

  const queryResult = React.useMemo(() => {
    if (value === undefined || !query.trim()) return null;
    try {
      return { matches: queryJsonPath(value, query), error: null };
    } catch (e) {
      return { matches: [], error: e instanceof Error ? e.message : "Invalid path" };
    }
  }, [value, query]);
  const table = React.useMemo(() => (value === undefined ? null : toTableRows(value)), [value]);

  const format = () => outcome.ok && setRaw(printJson(outcome.ast, printOpts));
  const minify = () => outcome.ok && setRaw(minifyJsonAst(outcome.ast, sortKeys));
  const goToError = () => {
    if (!outcome.ok) setJump({ line: outcome.error.line, column: outcome.error.column, nonce: Date.now() });
  };
  const openFile = async (file: File | undefined) => {
    if (!file) return;
    setRaw(await file.text());
  };
  const save = async () => {
    if (!outcome.ok) return;
    const title = Array.isArray(value) ? `Array (${value.length} items)` : value && typeof value === "object" ? `Object (${Object.keys(value as object).length} keys)` : "JSON snippet";
    await saveToolResult("json-formatter", { title, summary: `${formatted.length.toLocaleString()} characters`, data: formatted });
    historyRef.current?.refresh();
  };
  const restore = (item: ToolHistoryItem) => {
    if (item.data) setRaw(item.data);
  };

  const toolbar = (
    <>
      <ToolbarButton icon={<Sparkles className="h-3.5 w-3.5" />} onClick={format} disabled={!outcome.ok} title="Rewrite the input with the chosen indentation">
        Format
      </ToolbarButton>
      <ToolbarButton icon={<Minimize2 className="h-3.5 w-3.5" />} onClick={minify} disabled={!outcome.ok}>
        Minify
      </ToolbarButton>
      {repair && (
        <ToolbarButton icon={<Wand2 className="h-3.5 w-3.5" />} onClick={() => setRaw(repair.text)} title={`Fix: ${repair.fixes.join(", ")}`} className="border-primary text-primary">
          Repair
        </ToolbarButton>
      )}
      <ToolbarSeparator />
      <ToolbarSelect label="Indent" value={indent} onChange={setIndent} options={INDENTS} />
      <ToolbarToggle label="Sort keys" checked={sortKeys} onChange={setSortKeys} />
      <ToolbarSeparator />
      <ToolbarButton icon={<FileText className="h-3.5 w-3.5" />} onClick={() => setRaw(SAMPLE)}>
        Sample
      </ToolbarButton>
      <ToolbarButton icon={<FileUp className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()}>
        Open
      </ToolbarButton>
      <input ref={fileRef} type="file" accept=".json,application/json,text/plain" className="hidden" onChange={(e) => { void openFile(e.target.files?.[0]); e.target.value = ""; }} />
      <ToolbarButton icon={<Eraser className="h-3.5 w-3.5" />} onClick={() => setRaw("")} disabled={!raw}>
        Clear
      </ToolbarButton>
      <div className="ml-auto flex items-center gap-2">
        <CopyButton value={outcome.ok ? formatted : raw} size="sm" variant="outline" disabled={!raw}>
          Copy
        </CopyButton>
        <ToolbarButton icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadBlob(new Blob([formatted], { type: "application/json" }), "formatted.json")} disabled={!outcome.ok}>
          Download
        </ToolbarButton>
        <ToolbarButton icon={<Save className="h-3.5 w-3.5" />} onClick={save} disabled={!outcome.ok}>
          Save
        </ToolbarButton>
      </div>
    </>
  );

  const status = (
    <>
      {outcome.ok ? (
        <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> Valid JSON
        </span>
      ) : raw.trim() === "" ? (
        <span>Paste, type or drop JSON</span>
      ) : (
        <button onClick={goToError} className="flex items-center gap-1 text-left font-medium text-destructive hover:underline" title="Jump to the error">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Line {outcome.error.line}, column {outcome.error.column}: {outcome.error.message}
        </button>
      )}
      <span className="tabular-nums">
        Ln {cursor.line}, Col {cursor.column}
      </span>
      <span>{formatBytes(bytes)}</span>
      <span>{lines.toLocaleString()} lines</span>
      {stats && (
        <span>
          depth {stats.depth} · {stats.keys.toLocaleString()} keys
        </span>
      )}
    </>
  );

  const tabButtons = (
    <div className="flex gap-0.5" role="tablist" aria-label="Output view">
      {TABS.map((t) => (
        <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("rounded px-2.5 py-1 text-xs font-medium transition-colors", tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          {t.label}
        </button>
      ))}
    </div>
  );

  const invalidNotice = (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{raw.trim() === "" ? "Nothing to show yet." : "Fix the JSON error to see this view."}</div>
  );

  return (
    <div className="space-y-4">
      <Workspace toolbar={toolbar} status={status}>
        <SplitPane
          left={
            <Pane title="Input" actions={<span className="font-normal">drop a .json file here</span>}>
              <div
                className={cn("relative h-full", dragging && "ring-2 ring-inset ring-primary")}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void openFile(e.dataTransfer.files?.[0]);
                }}
              >
                <CodeEditor value={raw} onChange={setRaw} language="json" markers={markers} jumpTo={jump} onCursor={setCursor} ariaLabel="JSON input" />
              </div>
            </Pane>
          }
          right={
            <Pane title={tabButtons} className="[&>header]:py-1">
              {tab === "formatted" &&
                (outcome.ok ? <CodeEditor value={formatted} language="json" readOnly ariaLabel="Formatted JSON" /> : invalidNotice)}
              {tab === "tree" && (outcome.ok && value !== undefined ? <JsonTreeViewer data={value} /> : invalidNotice)}
              {tab === "table" &&
                (!outcome.ok ? (
                  invalidNotice
                ) : !table ? (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">The table view needs an array of objects, such as [{`{"id": 1}`}, {`{"id": 2}`}].</div>
                ) : (
                  <div className="h-full overflow-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="border-b border-border px-2 py-1.5 text-left font-medium text-muted-foreground">#</th>
                          {table.columns.slice(0, TABLE_COLUMN_LIMIT).map((c) => (
                            <th key={c} className="border-b border-border px-2 py-1.5 text-left font-medium">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.slice(0, TABLE_ROW_LIMIT).map((r, i) => (
                          <tr key={i} className="odd:bg-muted/20">
                            <td className="border-b border-border/60 px-2 py-1 text-muted-foreground">{i + 1}</td>
                            {table.columns.slice(0, TABLE_COLUMN_LIMIT).map((c) => (
                              <td key={c} className="max-w-64 truncate border-b border-border/60 px-2 py-1 font-mono">
                                {cell(r[c])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(table.rows.length > TABLE_ROW_LIMIT || table.columns.length > TABLE_COLUMN_LIMIT) && (
                      <p className="p-2 text-xs text-muted-foreground">
                        Showing the first {Math.min(table.rows.length, TABLE_ROW_LIMIT)} of {table.rows.length} rows and {Math.min(table.columns.length, TABLE_COLUMN_LIMIT)} of {table.columns.length} columns.
                      </p>
                    )}
                  </div>
                ))}
              {tab === "query" &&
                (!outcome.ok ? (
                  invalidNotice
                ) : (
                  <div className="flex h-full flex-col">
                    <div className="border-b border-border p-2">
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="$.users[*].name" aria-label="JSONPath expression" spellCheck={false} className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs outline-none focus:ring-2 focus:ring-primary" />
                      <p className="mt-1 text-[11px] text-muted-foreground">JSONPath: $.a.b, $.list[0], $.list[-1], $.list[*].x, $..price, $.list[1:3]</p>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto p-2">
                      {queryResult?.error ? (
                        <p role="alert" className="text-xs text-destructive">
                          {queryResult.error}
                        </p>
                      ) : queryResult && queryResult.matches.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No matches.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          <li className="text-[11px] text-muted-foreground">{queryResult?.matches.length.toLocaleString()} match{queryResult?.matches.length === 1 ? "" : "es"}</li>
                          {queryResult?.matches.slice(0, 200).map((m) => (
                            <li key={m.path} className="rounded-md border border-border bg-muted/20 p-2">
                              <div className="font-mono text-[11px] text-muted-foreground">{m.path}</div>
                              <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">{JSON.stringify(m.value, null, 2)}</pre>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
            </Pane>
          }
        />
      </Workspace>

      <ToolHistoryList ref={historyRef} toolSlug="json-formatter" onRestore={restore} />
    </div>
  );
}

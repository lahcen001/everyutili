"use client";

import * as React from "react";

import { ConverterWorkspace } from "@/components/tools/developer/workspace/ConverterWorkspace";
import { DataTable } from "@/components/tools/developer/workspace/DataTable";
import { ToolbarSelect, ToolbarToggle } from "@/components/tools/developer/workspace/Workspace";
import { useTrackTool } from "@/hooks/useTrackTool";
import { parseCsv } from "@/lib/csv";
import { parseJsonAst } from "@/lib/json";
import { jsonToCsv } from "@/lib/jsonToCsv";
import { cn } from "@/lib/utils";

const SAMPLE = JSON.stringify(
  [
    { id: 1, name: "Grace Hopper", team: { name: "Compilers", size: 12 }, skills: ["COBOL", "Math"], note: 'Says "hello, world"' },
    { id: 2, name: "Linus Torvalds", team: { name: "Kernel", size: 40 }, skills: ["C", "Git"], note: "Line one\nLine two" },
    { id: 3, name: "Margaret Hamilton", team: { name: "Apollo", size: 7 }, skills: [], note: "" },
  ],
  null,
  2
);
const DELIMITERS = [
  { value: ",", label: "Comma" },
  { value: ";", label: "Semicolon" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe" },
];

export default function JsonToCsvConverter() {
  useTrackTool("json-to-csv");
  const [raw, setRaw] = React.useState(SAMPLE);
  const [delimiter, setDelimiter] = React.useState(",");
  const [header, setHeader] = React.useState(true);
  const [flatten, setFlatten] = React.useState(true);
  const [joinArrays, setJoinArrays] = React.useState(false);
  const [quoteAll, setQuoteAll] = React.useState(false);
  const [bom, setBom] = React.useState(false);
  const [formulaGuard, setFormulaGuard] = React.useState(false);
  const [view, setView] = React.useState<"text" | "table">("text");

  const result = React.useMemo(() => {
    if (raw.trim() === "") return { csv: "", error: null, rows: 0, columns: 0 };
    const parsed = parseJsonAst(raw);
    if (!parsed.ok) return { csv: "", error: { message: parsed.error.message, line: parsed.error.line, column: parsed.error.column }, rows: 0, columns: 0 };
    const value = JSON.parse(raw) as unknown;
    const csv = jsonToCsv(value, { delimiter, header, flatten, arrays: joinArrays ? "join" : "json", quoteAll, bom, formulaGuard });
    return { csv, error: null, rows: Array.isArray(value) ? value.length : 1, columns: 0 };
  }, [raw, delimiter, header, flatten, joinArrays, quoteAll, bom, formulaGuard]);

  const table = React.useMemo(() => {
    if (view !== "table" || !result.csv) return null;
    const p = parseCsv(result.csv.replace(/^﻿/, ""), { delimiter: delimiter as ",", header, inferTypes: false });
    return p.ok ? p.data : null;
  }, [view, result.csv, delimiter, header]);

  return (
    <ConverterWorkspace
      slug="json-to-csv"
      input={raw}
      onInput={setRaw}
      inputLanguage="json"
      outputLanguage="plaintext"
      output={result.csv}
      error={result.error}
      inputTitle="JSON input"
      outputTitle={
        <div className="flex gap-0.5" role="tablist" aria-label="Output view">
          {(["text", "table"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("rounded px-2.5 py-1 text-xs font-medium transition-colors", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {v === "text" ? "CSV text" : "Table"}
            </button>
          ))}
        </div>
      }
      historyTitle="JSON → CSV"
      onSample={() => setRaw(SAMPLE)}
      fileAccept=".json,application/json,text/plain"
      download={{ name: "data.csv", mime: "text/csv;charset=utf-8" }}
      emptyMessage="Paste a JSON array of objects to convert it to CSV."
      stats={result.error ? null : <span>{result.rows.toLocaleString()} row{result.rows === 1 ? "" : "s"}</span>}
      outputView={view === "table" && table ? <DataTable columns={table.columns} rows={table.rows} /> : undefined}
      options={
        <>
          <ToolbarSelect label="Delimiter" value={delimiter} onChange={setDelimiter} options={DELIMITERS} />
          <ToolbarToggle label="Header row" checked={header} onChange={setHeader} />
          <ToolbarToggle label="Flatten objects" checked={flatten} onChange={setFlatten} />
          <ToolbarToggle label="Join arrays" checked={joinArrays} onChange={setJoinArrays} />
          <ToolbarToggle label="Quote all" checked={quoteAll} onChange={setQuoteAll} />
          <ToolbarToggle label="Excel BOM" checked={bom} onChange={setBom} />
          <ToolbarToggle label="Formula guard" checked={formulaGuard} onChange={setFormulaGuard} />
        </>
      }
    />
  );
}

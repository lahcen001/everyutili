"use client";

import * as React from "react";
import { ArrowLeftRight } from "lucide-react";

import { ConverterWorkspace } from "@/components/tools/developer/workspace/ConverterWorkspace";
import { DataTable } from "@/components/tools/developer/workspace/DataTable";
import { ToolbarButton, ToolbarSelect, ToolbarToggle } from "@/components/tools/developer/workspace/Workspace";
import { useTrackTool } from "@/hooks/useTrackTool";
import { csvToJsonText, delimiterName, type CsvOptions } from "@/lib/csv";
import { parseJsonAst } from "@/lib/json";
import { jsonToCsv } from "@/lib/jsonToCsv";
import { cn } from "@/lib/utils";

type Mode = "csv-to-json" | "json-to-csv";

const SAMPLE_CSV = `id,name,team,joined,active,note
1,"Hopper, Grace",Compilers,1952-03-01,true,"Said ""hello"""
2,Linus Torvalds,Kernel,1991-08-25,true,"Line one
Line two"
3,Margaret Hamilton,Apollo,1965-01-01,false,
`;
const SAMPLE_JSON = JSON.stringify(
  [
    { id: 1, name: "Hopper, Grace", team: "Compilers", active: true },
    { id: 2, name: "Linus Torvalds", team: "Kernel", active: true },
  ],
  null,
  2
);
const DELIMITERS = [
  { value: "auto", label: "Auto-detect" },
  { value: ",", label: "Comma" },
  { value: ";", label: "Semicolon" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe" },
];

export default function CsvToJson() {
  useTrackTool("csv-to-json");
  const [mode, setMode] = React.useState<Mode>("csv-to-json");
  const [input, setInput] = React.useState(SAMPLE_CSV);
  const [delimiter, setDelimiter] = React.useState("auto");
  const [header, setHeader] = React.useState(true);
  const [trim, setTrim] = React.useState(false);
  const [inferTypes, setInferTypes] = React.useState(true);
  const [emptyAsNull, setEmptyAsNull] = React.useState(false);
  const [asObjects, setAsObjects] = React.useState(true);
  const [view, setView] = React.useState<"json" | "table">("json");

  const toJson = mode === "csv-to-json";

  const result = React.useMemo(() => {
    if (input.trim() === "") return { text: "", error: null, info: null as string | null, warnings: [] as string[], table: null as null | { columns: string[]; rows: unknown[][] } };
    if (toJson) {
      const r = csvToJsonText(input, { delimiter: delimiter as CsvOptions["delimiter"], header, trim, inferTypes, emptyAsNull, asObjects });
      if (!r.ok) return { text: "", error: { message: r.message }, info: null, warnings: [], table: null };
      return { text: r.text, error: null, info: `${r.parsed.rows.length.toLocaleString()} rows · ${r.parsed.columns.length} columns · ${delimiterName(r.parsed.delimiter)}`, warnings: r.parsed.warnings, table: { columns: r.parsed.columns, rows: r.parsed.rows } };
    }
    const parsed = parseJsonAst(input);
    if (!parsed.ok) return { text: "", error: { message: parsed.error.message, line: parsed.error.line, column: parsed.error.column }, info: null, warnings: [], table: null };
    return { text: jsonToCsv(JSON.parse(input)), error: null, info: null, warnings: [], table: null };
  }, [input, toJson, delimiter, header, trim, inferTypes, emptyAsNull, asObjects]);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setInput(next === "csv-to-json" ? SAMPLE_CSV : SAMPLE_JSON);
  };
  const swap = () => {
    if (result.error || !result.text) return;
    setInput(result.text);
    setMode(toJson ? "json-to-csv" : "csv-to-json");
  };

  return (
    <ConverterWorkspace
      slug="csv-to-json"
      input={input}
      onInput={setInput}
      inputLanguage={toJson ? "plaintext" : "json"}
      outputLanguage={toJson ? "json" : "plaintext"}
      output={result.text}
      error={result.error}
      inputTitle={toJson ? "CSV input" : "JSON input"}
      outputTitle={
        toJson ? (
          <div className="flex gap-0.5" role="tablist" aria-label="Output view">
            {(["json", "table"] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("rounded px-2.5 py-1 text-xs font-medium transition-colors", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                {v === "json" ? "JSON" : "Table"}
              </button>
            ))}
          </div>
        ) : (
          "CSV output"
        )
      }
      historyTitle={toJson ? "CSV → JSON" : "JSON → CSV"}
      onSample={() => setInput(toJson ? SAMPLE_CSV : SAMPLE_JSON)}
      fileAccept={toJson ? ".csv,.tsv,.txt,text/csv,text/plain" : ".json,application/json,text/plain"}
      download={{ name: toJson ? "data.json" : "data.csv", mime: toJson ? "application/json" : "text/csv;charset=utf-8" }}
      emptyMessage="Paste CSV or JSON on the left to convert it."
      stats={
        <>
          {result.info && <span>{result.info}</span>}
          {result.warnings.length > 0 && (
            <span className="text-amber-600 dark:text-amber-400" title={result.warnings.join("\n")}>
              ⚠ {result.warnings[0]}
            </span>
          )}
        </>
      }
      outputView={toJson && view === "table" && result.table ? <DataTable columns={result.table.columns} rows={result.table.rows} /> : undefined}
      options={
        <>
          <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Direction">
            {(["csv-to-json", "json-to-csv"] as const).map((m) => (
              <button key={m} onClick={() => switchMode(m)} aria-pressed={mode === m} className={cn("h-8 px-3 text-sm font-medium transition-colors", mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {m === "csv-to-json" ? "CSV → JSON" : "JSON → CSV"}
              </button>
            ))}
          </div>
          <ToolbarButton icon={<ArrowLeftRight className="h-3.5 w-3.5" />} onClick={swap} disabled={!!result.error || !result.text}>
            Swap
          </ToolbarButton>
          {toJson && (
            <>
              <ToolbarSelect label="Delimiter" value={delimiter} onChange={setDelimiter} options={DELIMITERS} />
              <ToolbarToggle label="Header row" checked={header} onChange={setHeader} />
              <ToolbarToggle label="Detect types" checked={inferTypes} onChange={setInferTypes} />
              <ToolbarToggle label="Trim" checked={trim} onChange={setTrim} />
              <ToolbarToggle label="Empty → null" checked={emptyAsNull} onChange={setEmptyAsNull} />
              <ToolbarToggle label="Objects" checked={asObjects} onChange={setAsObjects} />
            </>
          )}
        </>
      }
    />
  );
}

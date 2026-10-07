"use client";

import * as React from "react";

import { ConverterWorkspace } from "@/components/tools/developer/workspace/ConverterWorkspace";
import { ToolbarSelect, ToolbarToggle } from "@/components/tools/developer/workspace/Workspace";
import { useTrackTool } from "@/hooks/useTrackTool";
import { SQL_DIALECTS, formatSql, minifySql, type SqlFormatOptions } from "@/lib/sql";
import { cn } from "@/lib/utils";

const SAMPLE = `-- Active customers and their biggest orders
WITH recent AS (select user_id, max(total) as best from orders where created_at > now() - interval '90 days' group by user_id)
select u.id, u.name, r.best /* largest order */ from users u left join recent r on r.user_id = u.id where u.active = true and r.best > 100 and u.country in ('US','CA','GB') order by r.best desc limit 20;`;

export default function SqlFormatter() {
  useTrackTool("sql-formatter");
  const [input, setInput] = React.useState(SAMPLE);
  const [action, setAction] = React.useState<"format" | "minify">("format");
  const [dialect, setDialect] = React.useState<SqlFormatOptions["dialect"]>("postgresql");
  const [keywordCase, setKeywordCase] = React.useState<SqlFormatOptions["keywordCase"]>("upper");
  const [indent, setIndent] = React.useState("2");
  const [commaFirst, setCommaFirst] = React.useState(false);

  const result = React.useMemo(() => {
    if (input.trim() === "") return { text: "", error: null };
    if (action === "minify") return { text: minifySql(input), error: null };
    const r = formatSql(input, { dialect, keywordCase, indent: indent === "tab" ? "tab" : indent === "4" ? 4 : 2, linesBetweenQueries: 1, commaFirst });
    return r.ok ? { text: r.text, error: null } : { text: "", error: r.error };
  }, [input, action, dialect, keywordCase, indent, commaFirst]);

  const saved = input.length && result.text ? Math.max(0, Math.round((1 - result.text.length / input.length) * 100)) : 0;

  return (
    <ConverterWorkspace
      slug="sql-formatter"
      input={input}
      onInput={setInput}
      inputLanguage="sql"
      outputLanguage="sql"
      output={result.text}
      error={result.error}
      inputTitle="SQL input"
      outputTitle={action === "format" ? "Formatted SQL" : "Minified SQL"}
      historyTitle={action === "format" ? "Formatted SQL" : "Minified SQL"}
      onSample={() => setInput(SAMPLE)}
      fileAccept=".sql,text/plain"
      download={{ name: action === "format" ? "formatted.sql" : "minified.sql", mime: "text/plain" }}
      emptyMessage="Paste a SQL query to format it."
      stats={action === "minify" && result.text ? <span>{saved}% smaller</span> : <span>{SQL_DIALECTS.find((d) => d.value === dialect)?.label}</span>}
      options={
        <>
          <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Action">
            {(["format", "minify"] as const).map((a) => (
              <button key={a} onClick={() => setAction(a)} aria-pressed={action === a} className={cn("h-8 px-3 text-sm font-medium capitalize transition-colors", action === a ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {a}
              </button>
            ))}
          </div>
          {action === "format" && (
            <>
              <ToolbarSelect label="Dialect" value={dialect} onChange={(v) => setDialect(v as SqlFormatOptions["dialect"])} options={SQL_DIALECTS} />
              <ToolbarSelect
                label="Keywords"
                value={keywordCase}
                onChange={(v) => setKeywordCase(v as SqlFormatOptions["keywordCase"])}
                options={[
                  { value: "upper", label: "UPPER" },
                  { value: "lower", label: "lower" },
                  { value: "preserve", label: "As typed" },
                ]}
              />
              <ToolbarSelect label="Indent" value={indent} onChange={setIndent} options={[{ value: "2", label: "2 spaces" }, { value: "4", label: "4 spaces" }, { value: "tab", label: "Tab" }]} />
              <ToolbarToggle label="Comma first" checked={commaFirst} onChange={setCommaFirst} />
            </>
          )}
        </>
      }
    />
  );
}

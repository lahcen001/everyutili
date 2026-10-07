import { format, type SqlLanguage } from "sql-formatter";

export const SQL_DIALECTS: { value: SqlLanguage; label: string }[] = [
  { value: "sql", label: "Standard SQL" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "mariadb", label: "MariaDB" },
  { value: "sqlite", label: "SQLite" },
  { value: "transactsql", label: "SQL Server (T-SQL)" },
  { value: "plsql", label: "Oracle PL/SQL" },
  { value: "bigquery", label: "BigQuery" },
  { value: "snowflake", label: "Snowflake" },
  { value: "redshift", label: "Redshift" },
  { value: "spark", label: "Spark" },
  { value: "hive", label: "Hive" },
  { value: "trino", label: "Trino" },
  { value: "db2", label: "DB2" },
  { value: "duckdb", label: "DuckDB" },
  { value: "clickhouse", label: "ClickHouse" },
];

export interface SqlFormatOptions {
  dialect: SqlLanguage;
  keywordCase: "upper" | "lower" | "preserve";
  indent: 2 | 4 | "tab";
  linesBetweenQueries: number;
  commaFirst: boolean;
}

export type SqlResult = { ok: true; text: string } | { ok: false; error: { message: string; line?: number; column?: number } };

export function formatSql(sql: string, o: SqlFormatOptions): SqlResult {
  try {
    const text = format(sql, {
      language: o.dialect,
      keywordCase: o.keywordCase,
      tabWidth: o.indent === "tab" ? 2 : o.indent,
      useTabs: o.indent === "tab",
      linesBetweenQueries: o.linesBetweenQueries,
      expressionWidth: 80,
      ...(o.commaFirst ? { logicalOperatorNewline: "before" as const } : {}),
    });
    return { ok: true, text: o.commaFirst ? commaFirst(text) : text };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Could not format this SQL";
    const m = /at line (\d+) column (\d+)/.exec(raw);
    const first = raw.split("\n")[0].replace(/^Parse error:?\s*/i, "");
    return { ok: false, error: { message: first, line: m ? Number(m[1]) : undefined, column: m ? Number(m[2]) : undefined } };
  }
}

/** Move trailing commas to the start of the next line: `a,` / `b` → `a` / `, b`. */
export function commaFirst(sql: string): string {
  const lines = sql.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/,\s*$/.test(line) && !/^\s*(--|\/\*)/.test(line) && i + 1 < lines.length && lines[i + 1].trim() !== "") {
      out.push(line.replace(/,\s*$/, ""));
      const next = lines[i + 1];
      const indent = next.match(/^\s*/)![0];
      lines[i + 1] = `${indent.length >= 2 ? indent.slice(0, -2) : indent}, ${next.trimStart()}`;
    } else out.push(line);
  }
  return out.join("\n");
}

/**
 * Remove comments and collapse whitespace without touching string literals,
 * quoted identifiers ("x", `x`, [x]) or $$ bodies. Spaces next to ( ) , ; are dropped.
 */
export function minifySql(sql: string): string {
  let out = "";
  let space = false;
  const emit = (token: string) => {
    if (space && out && !/[(,;]$/.test(out) && !/^[),;]/.test(token)) out += " ";
    space = false;
    out += token;
  };
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const next = sql[i + 1];
    if (c === "-" && next === "-") {
      while (i < n && sql[i] !== "\n") i++;
      space = true;
    } else if (c === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      space = true;
    } else if (c === "'" || c === '"' || c === "`") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === c && sql[j + 1] === c) j += 2;
        else if (sql[j] === "\\" && c === "'") j += 2;
        else if (sql[j] === c) break;
        else j++;
      }
      emit(sql.slice(i, j + 1));
      i = j + 1;
    } else if (c === "[") {
      const end = sql.indexOf("]", i);
      const j = end === -1 ? n : end + 1;
      emit(sql.slice(i, j));
      i = j;
    } else if (c === "$" && next === "$") {
      const end = sql.indexOf("$$", i + 2);
      const j = end === -1 ? n : end + 2;
      emit(sql.slice(i, j));
      i = j;
    } else if (/\s/.test(c)) {
      i++;
      space = true;
    } else {
      emit(c);
      i++;
    }
  }
  return out;
}

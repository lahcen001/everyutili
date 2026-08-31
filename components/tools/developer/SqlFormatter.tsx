"use client";

import * as React from "react";
import { Sparkles, Code2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const SAMPLE = `select u.id, u.name, o.total from users u left join orders o on o.user_id = u.id where u.active = true and o.total > 100 group by u.id, u.name order by o.total desc limit 20;`;

const LINE_BREAK_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "LEFT JOIN",
  "RIGHT JOIN",
  "INNER JOIN",
  "OUTER JOIN",
  "FULL JOIN",
  "JOIN",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "INSERT INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE FROM",
  "LIMIT",
  "OFFSET",
  "UNION ALL",
  "UNION",
];

const ALL_KEYWORDS = [
  ...LINE_BREAK_KEYWORDS,
  "AND",
  "OR",
  "ON",
  "AS",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "NOT",
  "NULL",
  "IS",
  "IN",
  "LIKE",
  "BETWEEN",
  "DISTINCT",
  "ASC",
  "DESC",
];

const MULTI_WORD_KEYWORDS = ALL_KEYWORDS.filter((k) => k.includes(" ")).sort((a, b) => b.length - a.length);
const SINGLE_WORD_KEYWORDS = new Set(
  ALL_KEYWORDS.filter((k) => !k.includes(" ")).map((k) => k.toUpperCase())
);
const LINE_BREAK_SET = new Set(LINE_BREAK_KEYWORDS.map((k) => k.toUpperCase()));

interface Token {
  text: string;
  kind: "keyword" | "string" | "paren-open" | "paren-close" | "comma" | "word" | "punct";
}

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const upperSql = sql;

  while (i < upperSql.length) {
    const ch = upperSql[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < upperSql.length) {
        if (upperSql[j] === "\\") {
          j += 2;
          continue;
        }
        if (upperSql[j] === ch) {
          if (upperSql[j + 1] === ch) {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      j = Math.min(j + 1, upperSql.length);
      tokens.push({ text: upperSql.slice(i, j), kind: "string" });
      i = j;
      continue;
    }

    if (ch === "(") {
      tokens.push({ text: "(", kind: "paren-open" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ text: ")", kind: "paren-close" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ text: ",", kind: "comma" });
      i++;
      continue;
    }
    if (ch === ";") {
      tokens.push({ text: ";", kind: "punct" });
      i++;
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let j = i + 1;
      while (j < upperSql.length && /[a-zA-Z0-9_.]/.test(upperSql[j])) j++;
      const word = upperSql.slice(i, j);

      let matchedMulti: string | null = null;
      for (const kw of MULTI_WORD_KEYWORDS) {
        const parts = kw.split(" ");
        const candidate = [word.toUpperCase()];
        let k = j;
        let ok = true;
        for (let p = 1; p < parts.length; p++) {
          while (k < upperSql.length && /\s/.test(upperSql[k])) k++;
          const wStart = k;
          while (k < upperSql.length && /[a-zA-Z0-9_]/.test(upperSql[k])) k++;
          if (wStart === k) {
            ok = false;
            break;
          }
          candidate.push(upperSql.slice(wStart, k).toUpperCase());
        }
        if (ok && candidate.join(" ") === kw) {
          matchedMulti = kw;
          j = k;
          break;
        }
      }

      if (matchedMulti) {
        tokens.push({ text: matchedMulti, kind: "keyword" });
        i = j;
        continue;
      }

      if (SINGLE_WORD_KEYWORDS.has(word.toUpperCase())) {
        tokens.push({ text: word.toUpperCase(), kind: "keyword" });
      } else {
        tokens.push({ text: word, kind: "word" });
      }
      i = j;
      continue;
    }

    let j = i + 1;
    while (j < upperSql.length && !/[\s(),'"a-zA-Z_]/.test(upperSql[j])) j++;
    tokens.push({ text: upperSql.slice(i, j), kind: "word" });
    i = j;
  }

  return tokens;
}

function formatSql(sql: string): string {
  const trimmed = sql.trim();
  if (!trimmed) return "";
  const tokens = tokenize(trimmed);

  let output = "";
  let indent = 0;
  let atLineStart = true;

  for (let idx = 0; idx < tokens.length; idx++) {
    const token = tokens[idx];
    const prev = tokens[idx - 1];

    if (token.kind === "paren-close") indent = Math.max(0, indent - 1);

    if (token.kind === "keyword" && LINE_BREAK_SET.has(token.text)) {
      if (output.length > 0) output += "\n";
      output += "  ".repeat(indent) + token.text;
      atLineStart = false;
    } else if (token.kind === "comma" || token.kind === "punct") {
      output += token.text;
      atLineStart = false;
    } else if (token.kind === "paren-close") {
      output += token.text;
      atLineStart = false;
    } else {
      const needsSpace =
        !atLineStart &&
        prev &&
        prev.kind !== "paren-open" &&
        !(token.kind === "paren-open" && (prev.kind === "word" || prev.kind === "keyword"));
      if (needsSpace) output += " ";
      output += token.text;
      atLineStart = false;
    }

    if (token.kind === "paren-open") indent += 1;
  }

  return output;
}

function minifySql(sql: string): string {
  const tokens = tokenize(sql.trim());
  let output = "";
  for (let idx = 0; idx < tokens.length; idx++) {
    const token = tokens[idx];
    const prev = tokens[idx - 1];
    if (token.kind === "comma" || token.kind === "paren-close" || token.kind === "punct") {
      output += token.text;
      continue;
    }
    const needsSpace =
      idx > 0 &&
      prev &&
      prev.kind !== "paren-open" &&
      !(token.kind === "paren-open" && (prev.kind === "word" || prev.kind === "keyword"));
    if (needsSpace) output += " ";
    output += token.text;
  }
  return output;
}

export default function SqlFormatter() {
  useTrackTool("sql-formatter");
  const [input, setInput] = React.useState(SAMPLE);
  const [output, setOutput] = React.useState("");
  const [lastAction, setLastAction] = React.useState<"format" | "minify" | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const format = () => {
    setOutput(formatSql(input));
    setLastAction("format");
  };

  const minify = () => {
    setOutput(minifySql(input));
    setLastAction("minify");
  };

  const saveResult = async () => {
    if (!output) return;
    await saveToolResult("sql-formatter", {
      title: lastAction === "minify" ? "Minified SQL" : "Formatted SQL",
      summary: `${output.length.toLocaleString()} characters`,
      data: output,
    });
    historyRef.current?.refresh();
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (item.data) setInput(item.data);
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <Button size="sm" variant="outline" onClick={format}>
          <Sparkles className="h-3.5 w-3.5" /> Format
        </Button>
        <Button size="sm" variant="outline" onClick={minify}>
          <Code2 className="h-3.5 w-3.5" /> Minify
        </Button>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">SQL input</p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={16}
            spellCheck={false}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Card>

        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">
            {lastAction === "minify" ? "Minified output" : "Formatted output"}
          </p>
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

      <ToolHistoryList ref={historyRef} toolSlug="sql-formatter" onRestore={restoreResult} />
    </div>
  );
}

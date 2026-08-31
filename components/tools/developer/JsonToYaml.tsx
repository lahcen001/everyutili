"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ArrowLeftRight, AlertCircle, CheckCircle2, Download, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { downloadBlob } from "@/lib/downloadBlob";
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

type Mode = "json-to-yaml" | "yaml-to-json";

const SAMPLE_JSON = JSON.stringify(
  {
    id: 1,
    name: "EveryUtili",
    active: true,
    tags: ["fast", "private", "free"],
    meta: { version: "1.0", stars: null },
  },
  null,
  2
);

const RESERVED_WORDS = new Set(["true", "false", "null", "~", "yes", "no", "on", "off"]);
const NUMBER_LIKE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]\d+)?$/;

function needsQuotes(str: string): boolean {
  if (str.length === 0) return true;
  if (RESERVED_WORDS.has(str.toLowerCase())) return true;
  if (NUMBER_LIKE.test(str)) return true;
  if (/^[\s]|[\s]$/.test(str)) return true;
  if (/[:#\-?[\]{}|>'"%@`,&*!]/.test(str[0])) return true;
  if (/:( |$)|#/.test(str)) return true;
  if (/[\n\t]/.test(str)) return true;
  return false;
}

function yamlScalarString(str: string): string {
  if (!needsQuotes(str)) return str;
  return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

function yamlScalar(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "string") return yamlScalarString(value);
  return yamlScalarString(String(value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonToYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]\n`;
    return value
      .map((item) => {
        if (isPlainObject(item) || Array.isArray(item)) {
          const nested = jsonToYaml(item, indent + 1);
          const lines = nested.split("\n").filter((l) => l.length > 0);
          const first = lines[0]?.trimStart() ?? "";
          const rest = lines.slice(1).join("\n");
          return `${pad}- ${first}${rest ? `\n${rest}` : ""}\n`;
        }
        return `${pad}- ${yamlScalar(item)}\n`;
      })
      .join("");
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return `${pad}{}\n`;
    return entries
      .map(([key, val]) => {
        const keyStr = needsQuotes(key) ? yamlScalarString(key) : key;
        if (isPlainObject(val)) {
          const keys = Object.keys(val);
          if (keys.length === 0) return `${pad}${keyStr}: {}\n`;
          return `${pad}${keyStr}:\n${jsonToYaml(val, indent + 1)}`;
        }
        if (Array.isArray(val)) {
          if (val.length === 0) return `${pad}${keyStr}: []\n`;
          return `${pad}${keyStr}:\n${jsonToYaml(val, indent)}`;
        }
        return `${pad}${keyStr}: ${yamlScalar(val)}\n`;
      })
      .join("");
  }

  return `${pad}${yamlScalar(value)}\n`;
}

function convertJsonToYaml(raw: string): { result: string; error: string | null } {
  try {
    const parsed = JSON.parse(raw);
    const yaml = jsonToYaml(parsed).trimEnd();
    return { result: yaml.length > 0 ? yaml : "{}", error: null };
  } catch (e) {
    return { result: "", error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

function parseYamlScalar(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    const quote = trimmed[0];
    const inner = trimmed.slice(1, -1);
    return quote === '"' ? inner.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\") : inner.replace(/''/g, "'");
  }
  if (trimmed === "null" || trimmed === "~") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (NUMBER_LIKE.test(trimmed)) return Number(trimmed);
  if (trimmed === "[]") return [];
  if (trimmed === "{}") return {};
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((part) => parseYamlScalar(part.trim()));
  }
  return trimmed;
}

interface YamlLine {
  indent: number;
  content: string;
}

function tokenizeYaml(text: string): YamlLine[] {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith("#");
    })
    .map((line) => {
      const match = line.match(/^(\s*)(.*)$/);
      const indent = match ? match[1].length : 0;
      const content = (match ? match[2] : line).replace(/\s+#.*$/, "").trimEnd();
      return { indent, content };
    });
}

function parseYamlBlock(lines: YamlLine[], start: number, indent: number): { value: unknown; next: number } {
  if (start >= lines.length) return { value: null, next: start };

  const first = lines[start];
  if (first.content.startsWith("- ") || first.content === "-") {
    const arr: unknown[] = [];
    let i = start;
    while (i < lines.length && lines[i].indent === indent && (lines[i].content.startsWith("- ") || lines[i].content === "-")) {
      const itemContent = lines[i].content === "-" ? "" : lines[i].content.slice(2);
      if (itemContent.trim() === "") {
        const { value, next } = parseYamlBlock(lines, i + 1, indent + 1);
        arr.push(value);
        i = next;
      } else if (/^[^:#]+:\s*(.*)$/.test(itemContent) && !itemContent.trim().startsWith("[") && !itemContent.trim().startsWith("{")) {
        const virtualLine: YamlLine = { indent: indent + 2, content: itemContent };
        const rest = lines.slice(i + 1);
        const { value, next } = parseYamlBlock([virtualLine, ...rest], 0, indent + 2);
        arr.push(value);
        i = i + 1 + (next - 1);
      } else {
        arr.push(parseYamlScalar(itemContent));
        i++;
      }
    }
    return { value: arr, next: i };
  }

  const obj: Record<string, unknown> = {};
  let i = start;
  while (i < lines.length && lines[i].indent === indent) {
    const line = lines[i];
    if (line.content.startsWith("- ")) break;
    const colonIdx = findKeyColon(line.content);
    if (colonIdx === -1) {
      i++;
      continue;
    }
    const rawKey = line.content.slice(0, colonIdx).trim();
    const key = unquoteKey(rawKey);
    const valuePart = line.content.slice(colonIdx + 1).trim();

    if (valuePart === "") {
      const nextLine = lines[i + 1];
      const isListContinuation =
        nextLine && nextLine.indent === indent && (nextLine.content.startsWith("- ") || nextLine.content === "-");
      if (nextLine && (nextLine.indent > indent || isListContinuation)) {
        const { value, next } = parseYamlBlock(lines, i + 1, nextLine.indent);
        obj[key] = value;
        i = next;
      } else {
        obj[key] = null;
        i++;
      }
    } else {
      obj[key] = parseYamlScalar(valuePart);
      i++;
    }
  }
  return { value: obj, next: i };
}

function findKeyColon(content: string): number {
  let inQuotes: string | null = null;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === inQuotes) inQuotes = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuotes = ch;
      continue;
    }
    if (ch === ":" && (i === content.length - 1 || content[i + 1] === " ")) {
      return i;
    }
  }
  return -1;
}

function unquoteKey(key: string): string {
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    return key.slice(1, -1);
  }
  return key;
}

function convertYamlToJson(raw: string): { result: string; error: string | null } {
  try {
    if (raw.trim() === "") return { result: "{}", error: null };
    const lines = tokenizeYaml(raw);
    if (lines.length === 0) return { result: "{}", error: null };
    const { value } = parseYamlBlock(lines, 0, lines[0].indent);
    return { result: JSON.stringify(value, null, 2), error: null };
  } catch (e) {
    return { result: "", error: e instanceof Error ? e.message : "Invalid YAML" };
  }
}

export default function JsonToYaml() {
  useTrackTool("json-to-yaml");
  const [mode, setMode] = React.useState<Mode>("json-to-yaml");
  const [input, setInput] = React.useState(SAMPLE_JSON);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const { result, error } = React.useMemo(
    () => (mode === "json-to-yaml" ? convertJsonToYaml(input) : convertYamlToJson(input)),
    [mode, input]
  );

  const swap = () => {
    const next: Mode = mode === "json-to-yaml" ? "yaml-to-json" : "json-to-yaml";
    setMode(next);
    if (result) setInput(result);
  };

  const saveResult = async () => {
    if (!result) return;
    await saveToolResult("json-to-yaml", {
      title: mode === "json-to-yaml" ? "JSON → YAML" : "YAML → JSON",
      summary: `${result.length.toLocaleString()} characters`,
      data: result,
    });
    historyRef.current?.refresh();
  };

  const downloadResult = () => {
    if (!result) return;
    const ext = mode === "json-to-yaml" ? "yaml" : "json";
    const type = mode === "json-to-yaml" ? "text/yaml" : "application/json";
    downloadBlob(new Blob([result], { type }), `converted.${ext}`);
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (item.data) setInput(item.data);
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            onClick={() => setMode("json-to-yaml")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "json-to-yaml" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            JSON → YAML
          </button>
          <button
            onClick={() => setMode("yaml-to-json")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "yaml-to-json" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            YAML → JSON
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={swap} disabled={!result}>
          <ArrowLeftRight className="h-3.5 w-3.5" /> Swap
        </Button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {error ? (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-4 w-4" /> Invalid {mode === "json-to-yaml" ? "JSON" : "YAML"}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Valid
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
            defaultLanguage={mode === "json-to-yaml" ? "json" : "yaml"}
            language={mode === "json-to-yaml" ? "json" : "yaml"}
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
          <p className="text-sm font-medium">{mode === "json-to-yaml" ? "YAML output" : "JSON output"}</p>
          <pre className="h-[370px] overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs">
            {result || "—"}
          </pre>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={result} variant="secondary" disabled={!result}>
              Copy result
            </CopyButton>
            <Button size="sm" variant="outline" onClick={downloadResult} disabled={!result}>
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
            <Button size="sm" variant="outline" onClick={saveResult} disabled={!result}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          </div>
        </Card>
      </div>

      <ToolHistoryList ref={historyRef} toolSlug="json-to-yaml" onRestore={restoreResult} />
    </div>
  );
}

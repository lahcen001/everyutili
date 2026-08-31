"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Braces, CheckCircle2, Download, FileCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { downloadBlob } from "@/lib/downloadBlob";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { generateTypeScript, generateZodSchema, type OutputKind } from "@/lib/jsonToTypescript";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
      Loading editor…
    </div>
  ),
});

const SAMPLE = JSON.stringify(
  {
    id: 1,
    name: "EveryUtili",
    active: true,
    tags: ["fast", "private", "free"],
    owner: { username: "omni", verified: true },
  },
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

export default function JsonToTypeScript() {
  useTrackTool("json-to-typescript");
  const [raw, setRaw] = React.useState(SAMPLE);
  const [outputKind, setOutputKind] = React.useState<OutputKind>("interface");
  const [optionalFields, setOptionalFields] = React.useState(false);
  const [generateZod, setGenerateZod] = React.useState(false);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const { parsed, error } = React.useMemo(() => parseJson(raw), [raw]);

  const generatedCode = React.useMemo(() => {
    if (error) return "";
    try {
      const typeCode = generateTypeScript(parsed, { outputKind, optionalFields, generateZod });
      if (!generateZod) return typeCode;
      const zodCode = generateZodSchema(parsed, optionalFields);
      return `${typeCode}\n${zodCode}`;
    } catch {
      return "";
    }
  }, [parsed, error, outputKind, optionalFields, generateZod]);

  const handleGenerate = async () => {
    if (error || !generatedCode) return;
    await saveToolResult("json-to-typescript", {
      title: outputKind === "interface" ? "Root interface" : "Root type alias",
      summary: `${generatedCode.length.toLocaleString()} characters generated`,
      data: raw,
    });
    historyRef.current?.refresh();
  };

  const handleDownload = () => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: "text/plain" });
    downloadBlob(blob, "types.d.ts");
  };

  const restoreInput = (item: ToolHistoryItem) => {
    if (item.data) setRaw(item.data);
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4 p-3">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setOutputKind("interface")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              outputKind === "interface"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            interface
          </button>
          <button
            onClick={() => setOutputKind("type")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              outputKind === "type"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            type alias
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={optionalFields}
            onChange={(e) => setOptionalFields(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          Optional fields (?)
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={generateZod}
            onChange={(e) => setGenerateZod(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          Generate Zod schema
        </label>

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

        {!error && generatedCode ? (
          <pre className="h-[420px] overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs">
            {generatedCode}
          </pre>
        ) : (
          <div className="flex h-[420px] items-center justify-center rounded-lg border border-border text-sm text-muted-foreground">
            Fix JSON errors to generate types
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleGenerate} disabled={!!error || !generatedCode}>
          <Braces className="h-4 w-4" /> Generate & save
        </Button>
        <CopyButton value={generatedCode} variant="secondary" disabled={!generatedCode}>
          Copy code
        </CopyButton>
        <Button variant="outline" onClick={handleDownload} disabled={!generatedCode}>
          <Download className="h-4 w-4" /> Download .d.ts
        </Button>
        {generateZod && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileCode className="h-3.5 w-3.5" /> Zod block is generated as plain text — no zod dependency added
          </span>
        )}
      </div>

      <ToolHistoryList ref={historyRef} toolSlug="json-to-typescript" onRestore={restoreInput} />
    </div>
  );
}

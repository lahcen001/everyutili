"use client";

import * as React from "react";

import { ConverterWorkspace } from "@/components/tools/developer/workspace/ConverterWorkspace";
import { ToolbarSelect, ToolbarToggle } from "@/components/tools/developer/workspace/Workspace";
import { useTrackTool } from "@/hooks/useTrackTool";
import { parseJsonAst } from "@/lib/json";
import { generateTypeScript, type OutputKind } from "@/lib/jsonToTypescript";

const SAMPLE = JSON.stringify(
  {
    id: 1,
    name: "EveryUtili",
    active: true,
    tags: ["fast", "private", "free"],
    owner: { username: "omni", verified: true, bio: null },
    users: [
      { id: 101, name: "Grace", plan: "pro" },
      { id: 102, name: "Linus", plan: "free", seats: 1 },
    ],
  },
  null,
  2
);

export default function JsonToTypeScript() {
  useTrackTool("json-to-typescript");
  const [raw, setRaw] = React.useState(SAMPLE);
  const [outputKind, setOutputKind] = React.useState<OutputKind>("interface");
  const [rootName, setRootName] = React.useState("Root");
  const [optionalFields, setOptionalFields] = React.useState(false);
  const [exportTypes, setExportTypes] = React.useState(true);
  const [readonly, setReadonly] = React.useState(false);
  const [generateZod, setGenerateZod] = React.useState(false);

  const result = React.useMemo(() => {
    if (raw.trim() === "") return { code: "", error: null };
    const parsed = parseJsonAst(raw);
    if (!parsed.ok) return { code: "", error: { message: parsed.error.message, line: parsed.error.line, column: parsed.error.column } };
    try {
      return { code: generateTypeScript(JSON.parse(raw), { outputKind, rootName, optionalFields, exportTypes, readonly, generateZod }), error: null };
    } catch (e) {
      return { code: "", error: { message: e instanceof Error ? e.message : "Could not generate types" } };
    }
  }, [raw, outputKind, rootName, optionalFields, exportTypes, readonly, generateZod]);

  return (
    <ConverterWorkspace
      slug="json-to-typescript"
      input={raw}
      onInput={setRaw}
      inputLanguage="json"
      outputLanguage="typescript"
      output={result.code}
      error={result.error}
      inputTitle="JSON input"
      outputTitle={generateZod ? "TypeScript + Zod" : "TypeScript"}
      historyTitle={outputKind === "interface" ? "Interfaces" : "Type aliases"}
      onSample={() => setRaw(SAMPLE)}
      fileAccept=".json,application/json,text/plain"
      download={{ name: "types.ts", mime: "text/plain" }}
      emptyMessage="Paste a JSON sample to generate types."
      options={
        <>
          <ToolbarSelect
            label="Output"
            value={outputKind}
            onChange={(v) => setOutputKind(v as OutputKind)}
            options={[
              { value: "interface", label: "interface" },
              { value: "type", label: "type alias" },
            ]}
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Root name
            <input value={rootName} onChange={(e) => setRootName(e.target.value)} spellCheck={false} aria-label="Root type name" className="h-8 w-28 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
          </label>
          <ToolbarToggle label="export" checked={exportTypes} onChange={setExportTypes} />
          <ToolbarToggle label="All optional" checked={optionalFields} onChange={setOptionalFields} />
          <ToolbarToggle label="readonly" checked={readonly} onChange={setReadonly} />
          <ToolbarToggle label="Zod schema" checked={generateZod} onChange={setGenerateZod} />
        </>
      }
    />
  );
}

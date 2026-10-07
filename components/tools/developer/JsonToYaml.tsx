"use client";

import * as React from "react";
import { ArrowLeftRight } from "lucide-react";

import { ConverterWorkspace } from "@/components/tools/developer/workspace/ConverterWorkspace";
import { ToolbarButton, ToolbarSelect, ToolbarToggle } from "@/components/tools/developer/workspace/Workspace";
import { useTrackTool } from "@/hooks/useTrackTool";
import { jsonToYaml, yamlToJson } from "@/lib/yamlConvert";
import { cn } from "@/lib/utils";

type Mode = "json-to-yaml" | "yaml-to-json";

const SAMPLE_JSON = JSON.stringify(
  { name: "EveryUtili", version: "2.4.0", active: true, ports: [80, 443], database: { host: "localhost", port: 5432, options: { ssl: true, timeout: null } }, description: "Line one\nLine two" },
  null,
  2
);
const SAMPLE_YAML = `# Docker Compose style example
name: EveryUtili
version: "2.4.0"
active: true
ports: [80, 443]
database: &db
  host: localhost
  port: 5432
replica:
  <<: *db
  host: replica.local
description: |
  Line one
  Line two
`;

export default function JsonToYaml() {
  useTrackTool("json-to-yaml");
  const [mode, setMode] = React.useState<Mode>("json-to-yaml");
  const [input, setInput] = React.useState(SAMPLE_JSON);
  const [indent, setIndent] = React.useState("2");
  const [sortKeys, setSortKeys] = React.useState(false);

  const toYaml = mode === "json-to-yaml";
  const result = React.useMemo(() => {
    if (input.trim() === "") return { ok: true as const, text: "" };
    return toYaml ? jsonToYaml(input, { indent: indent === "4" ? 4 : 2, sortKeys }) : yamlToJson(input, { indent: indent === "tab" ? "tab" : Number(indent), sortKeys });
  }, [input, toYaml, indent, sortKeys]);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setInput(next === "json-to-yaml" ? SAMPLE_JSON : SAMPLE_YAML);
  };
  const swap = () => {
    if (!result.ok || !result.text) return;
    setInput(result.text);
    setMode(toYaml ? "yaml-to-json" : "json-to-yaml");
  };

  return (
    <ConverterWorkspace
      slug="json-to-yaml"
      input={input}
      onInput={setInput}
      inputLanguage={toYaml ? "json" : "yaml"}
      outputLanguage={toYaml ? "yaml" : "json"}
      output={result.ok ? result.text : ""}
      error={result.ok ? null : result.error}
      inputTitle={toYaml ? "JSON input" : "YAML input"}
      outputTitle={toYaml ? "YAML output" : "JSON output"}
      historyTitle={toYaml ? "JSON → YAML" : "YAML → JSON"}
      onSample={() => setInput(toYaml ? SAMPLE_JSON : SAMPLE_YAML)}
      fileAccept={toYaml ? ".json,application/json,text/plain" : ".yaml,.yml,text/yaml,text/plain"}
      download={{ name: toYaml ? "converted.yaml" : "converted.json", mime: toYaml ? "text/yaml" : "application/json" }}
      emptyMessage="Paste JSON or YAML on the left to convert it."
      options={
        <>
          <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Direction">
            {(["json-to-yaml", "yaml-to-json"] as const).map((m) => (
              <button key={m} onClick={() => switchMode(m)} aria-pressed={mode === m} className={cn("h-8 px-3 text-sm font-medium transition-colors", mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {m === "json-to-yaml" ? "JSON → YAML" : "YAML → JSON"}
              </button>
            ))}
          </div>
          <ToolbarButton icon={<ArrowLeftRight className="h-3.5 w-3.5" />} onClick={swap} disabled={!result.ok || !result.text}>
            Swap
          </ToolbarButton>
          <ToolbarSelect label="Indent" value={indent} onChange={setIndent} options={toYaml ? [{ value: "2", label: "2 spaces" }, { value: "4", label: "4 spaces" }] : [{ value: "2", label: "2 spaces" }, { value: "4", label: "4 spaces" }, { value: "tab", label: "Tab" }]} />
          <ToolbarToggle label="Sort keys" checked={sortKeys} onChange={setSortKeys} />
        </>
      }
    />
  );
}

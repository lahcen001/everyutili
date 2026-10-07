"use client";

import * as React from "react";

import { ConverterWorkspace } from "@/components/tools/developer/workspace/ConverterWorkspace";
import { ToolbarToggle } from "@/components/tools/developer/workspace/Workspace";
import { useTrackTool } from "@/hooks/useTrackTool";
import { CASES, applyCase, type CaseId } from "@/lib/textCase";
import { cn } from "@/lib/utils";

const SAMPLE = "the quick brown fox jumps over the lazy dog.\nGETHttpResponse code is 404 — not found!";

export default function TextCaseConverter() {
  useTrackTool("text-case-converter");
  const [input, setInput] = React.useState(SAMPLE);
  const [caseId, setCaseId] = React.useState<CaseId>("capitalized");
  const [perLine, setPerLine] = React.useState(false);

  const output = React.useMemo(() => applyCase(input, caseId, perLine), [input, caseId, perLine]);
  const info = CASES.find((c) => c.id === caseId)!;

  return (
    <ConverterWorkspace
      slug="text-case-converter"
      input={input}
      onInput={setInput}
      inputLanguage="plaintext"
      outputLanguage="plaintext"
      output={output}
      error={null}
      inputTitle="Your text"
      outputTitle={info.label}
      historyTitle={info.label}
      onSample={() => setInput(SAMPLE)}
      fileAccept=".txt,text/plain"
      download={{ name: "converted.txt", mime: "text/plain" }}
      emptyMessage="Type or paste text to convert it."
      stats={<span>e.g. {info.example}</span>}
      options={
        <>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Case style">
            {CASES.map((c) => (
              <button key={c.id} onClick={() => setCaseId(c.id)} aria-pressed={caseId === c.id} title={c.example} className={cn("h-8 rounded-md border px-2.5 text-xs font-medium transition-colors", caseId === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                {c.label}
              </button>
            ))}
          </div>
          <ToolbarToggle label="Each line separately" checked={perLine || !!info.identifier} onChange={setPerLine} />
        </>
      }
    />
  );
}

"use client";

import * as React from "react";

import { ConverterWorkspace } from "@/components/tools/developer/workspace/ConverterWorkspace";
import { ToolbarToggle } from "@/components/tools/developer/workspace/Workspace";
import { useTrackTool } from "@/hooks/useTrackTool";
import { TITLE_STYLES, toTitleCase, type TitleStyle } from "@/lib/titleCase";
import { cn } from "@/lib/utils";

const SAMPLE = "the art of war: a guide to winning without a fight\nwhat NASA learned from the iPhone about well-known design";

export default function TitleCaseConverter() {
  useTrackTool("title-case-converter");
  const [input, setInput] = React.useState(SAMPLE);
  const [style, setStyle] = React.useState<TitleStyle>("ap");
  const [preserveCaps, setPreserveCaps] = React.useState(true);

  const output = React.useMemo(() => toTitleCase(input, { style, preserveCaps }), [input, style, preserveCaps]);
  const info = TITLE_STYLES.find((s) => s.id === style)!;

  return (
    <ConverterWorkspace
      slug="title-case-converter"
      input={input}
      onInput={setInput}
      inputLanguage="plaintext"
      outputLanguage="plaintext"
      output={output}
      error={null}
      inputTitle="Headlines — one per line"
      outputTitle={`${info.label} title case`}
      historyTitle={`${info.label} title case`}
      onSample={() => setInput(SAMPLE)}
      fileAccept=".txt,text/plain"
      download={{ name: "titles.txt", mime: "text/plain" }}
      emptyMessage="Type or paste a headline."
      stats={<span>{info.hint}</span>}
      options={
        <>
          <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Style">
            {TITLE_STYLES.map((s) => (
              <button key={s.id} onClick={() => setStyle(s.id)} aria-pressed={style === s.id} title={s.hint} className={cn("h-8 px-3 text-sm font-medium transition-colors", style === s.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {s.label}
              </button>
            ))}
          </div>
          <ToolbarToggle label="Keep acronyms & brands (NASA, iPhone)" checked={preserveCaps} onChange={setPreserveCaps} />
        </>
      }
    />
  );
}

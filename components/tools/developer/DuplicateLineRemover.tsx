"use client";

import * as React from "react";

import { ConverterWorkspace } from "@/components/tools/developer/workspace/ConverterWorkspace";
import { ToolbarSelect, ToolbarToggle } from "@/components/tools/developer/workspace/Workspace";
import { useTrackTool } from "@/hooks/useTrackTool";
import { processLines, seededRng, type LineMode, type LineOptions, type LineSort } from "@/lib/lines";

const SAMPLE = ["banana", "Apple", "cherry", "apple", "", "banana", "  cherry  ", "date", "Banana", "item10", "item2", "item1", "date"].join("\n");

const MODES: { value: LineMode; label: string }[] = [
  { value: "unique", label: "Remove duplicates (keep first)" },
  { value: "duplicates", label: "Show only duplicated lines" },
  { value: "only-unique", label: "Keep only lines that appear once" },
  { value: "count", label: "Count occurrences" },
];
const SORTS: { value: LineSort; label: string }[] = [
  { value: "none", label: "Keep order" },
  { value: "az", label: "A → Z" },
  { value: "za", label: "Z → A" },
  { value: "natural", label: "Natural (2 before 10)" },
  { value: "natural-desc", label: "Natural, descending" },
  { value: "length", label: "Shortest first" },
  { value: "length-desc", label: "Longest first" },
  { value: "reverse", label: "Reverse order" },
  { value: "shuffle", label: "Shuffle" },
];

export default function DuplicateLineRemover() {
  useTrackTool("duplicate-line-remover");
  const [input, setInput] = React.useState(SAMPLE);
  const [mode, setMode] = React.useState<LineMode>("unique");
  const [sort, setSort] = React.useState<LineSort>("none");
  const [caseInsensitive, setCaseInsensitive] = React.useState(true);
  const [trim, setTrim] = React.useState(true);
  const [removeEmpty, setRemoveEmpty] = React.useState(true);
  // a new shuffle is requested by changing this number, so the output stays pure
  const [shuffleSeed, setShuffleSeed] = React.useState(1);

  const result = React.useMemo(() => {
    const opts: LineOptions = { mode, sort, caseInsensitive, trim, removeEmpty };
    return processLines(input, opts, seededRng(shuffleSeed));
  }, [input, mode, sort, caseInsensitive, trim, removeEmpty, shuffleSeed]);

  return (
    <ConverterWorkspace
      slug="duplicate-line-remover"
      input={input}
      onInput={setInput}
      inputLanguage="plaintext"
      outputLanguage="plaintext"
      output={result.lines.join("\n")}
      error={null}
      inputTitle="Lines"
      outputTitle="Result"
      historyTitle={MODES.find((m) => m.value === mode)?.label ?? "Lines"}
      onSample={() => setInput(SAMPLE)}
      fileAccept=".txt,.csv,.log,text/plain"
      download={{ name: "lines.txt", mime: "text/plain" }}
      emptyMessage="Paste a list — one item per line."
      stats={
        <>
          <span>
            {result.inputLines.toLocaleString()} → {result.outputLines.toLocaleString()} lines
          </span>
          {mode === "unique" && <span>{result.duplicatesRemoved.toLocaleString()} duplicate{result.duplicatesRemoved === 1 ? "" : "s"} removed</span>}
          {result.emptyRemoved > 0 && <span>{result.emptyRemoved.toLocaleString()} empty line{result.emptyRemoved === 1 ? "" : "s"} removed</span>}
        </>
      }
      options={
        <>
          <ToolbarSelect label="Mode" value={mode} onChange={(v) => setMode(v as LineMode)} options={MODES} />
          <ToolbarSelect
            label="Sort"
            value={sort}
            onChange={(v) => {
              setSort(v as LineSort);
              if (v === "shuffle") setShuffleSeed(Math.floor(Math.random() * 2e9) + 1);
            }}
            options={SORTS}
          />
          <ToolbarToggle label="Ignore case" checked={caseInsensitive} onChange={setCaseInsensitive} />
          <ToolbarToggle label="Trim spaces" checked={trim} onChange={setTrim} />
          <ToolbarToggle label="Drop empty lines" checked={removeEmpty} onChange={setRemoveEmpty} />
          {sort === "shuffle" && (
            <button onClick={() => setShuffleSeed(Math.floor(Math.random() * 2e9) + 1)} className="h-8 rounded-md border border-border px-3 text-sm hover:bg-muted">
              Shuffle again
            </button>
          )}
        </>
      }
    />
  );
}

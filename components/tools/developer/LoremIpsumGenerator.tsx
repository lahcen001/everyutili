"use client";

import * as React from "react";
import { Download, RefreshCw } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { CodeEditor } from "@/components/tools/developer/workspace/CodeEditor";
import { Pane, ToolbarButton, ToolbarSelect, ToolbarToggle, Workspace } from "@/components/tools/developer/workspace/Workspace";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { DEFAULT_LOREM, countText, generateLorem, type LoremFormat, type LoremOptions, type LoremUnit } from "@/lib/lorem";
import { cn } from "@/lib/utils";

const MAX: Record<LoremUnit, number> = { paragraphs: 100, sentences: 500, words: 5000 };

export default function LoremIpsumGenerator() {
  useTrackTool("lorem-ipsum-generator");
  const [opts, setOpts] = React.useState<LoremOptions>(DEFAULT_LOREM);
  const [text, setText] = React.useState(() => generateLorem(DEFAULT_LOREM));

  const make = (next: LoremOptions) => setText(generateLorem(next));
  const update = (patch: Partial<LoremOptions>) => {
    const next = { ...opts, ...patch };
    next.count = Math.min(MAX[next.unit], Math.max(1, Math.floor(next.count) || 1));
    setOpts(next);
    make(next);
  };
  const { words, characters } = countText(text);
  const html = opts.format !== "text";

  const toolbar = (
    <>
      <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Unit">
        {(["paragraphs", "sentences", "words"] as const).map((u) => (
          <button key={u} onClick={() => update({ unit: u, count: u === "words" ? 50 : u === "sentences" ? 5 : 3 })} aria-pressed={opts.unit === u} className={cn("h-8 px-3 text-sm font-medium capitalize transition-colors", opts.unit === u ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {u}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Count
        <input type="number" min={1} max={MAX[opts.unit]} value={opts.count} onChange={(e) => update({ count: Number(e.target.value) })} className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm text-foreground" />
      </label>
      <ToolbarSelect
        label="Format"
        value={opts.format}
        onChange={(v) => update({ format: v as LoremFormat })}
        options={[
          { value: "text", label: "Plain text" },
          { value: "html", label: "HTML <p> tags" },
          { value: "list", label: "HTML list" },
        ]}
      />
      <ToolbarToggle label='Start with "Lorem ipsum"' checked={opts.startWithLorem} onChange={(v) => update({ startWithLorem: v })} />
      <div className="ml-auto flex items-center gap-2">
        <ToolbarButton icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => make(opts)}>
          Regenerate
        </ToolbarButton>
        <CopyButton value={text} size="sm" variant="outline">
          Copy
        </CopyButton>
        <ToolbarButton icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadBlob(new Blob([text], { type: html ? "text/html" : "text/plain" }), html ? "lorem.html" : "lorem.txt")}>
          Download
        </ToolbarButton>
      </div>
    </>
  );

  return (
    <Workspace
      toolbar={toolbar}
      status={
        <>
          <span>{words.toLocaleString()} words</span>
          <span>{characters.toLocaleString()} characters</span>
          <span>Placeholder text only — it is not saved anywhere.</span>
        </>
      }
    >
      <Pane title="Generated text">
        <CodeEditor value={text} language={html ? "html" : "plaintext"} readOnly wordWrap ariaLabel="Generated Lorem Ipsum" />
      </Pane>
    </Workspace>
  );
}

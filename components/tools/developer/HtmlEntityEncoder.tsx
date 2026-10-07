"use client";

import * as React from "react";
import { ArrowLeftRight, Search } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { ConverterWorkspace } from "@/components/tools/developer/workspace/ConverterWorkspace";
import { ToolbarButton, ToolbarSelect } from "@/components/tools/developer/workspace/Workspace";
import { useTrackTool } from "@/hooks/useTrackTool";
import { ENTITY_TABLE, decodeEntities, encodeEntities, type EntityScope, type NumericStyle } from "@/lib/htmlEntities";
import { cn } from "@/lib/utils";

type Mode = "encode" | "decode";
const SAMPLE_ENCODE = `<p class="note">Café & crème — 5 < 6 © 2024 “quoted” ✓ 😀</p>`;
const SAMPLE_DECODE = "&lt;p class=&quot;note&quot;&gt;Caf&eacute; &amp; cr&egrave;me &mdash; 5 &lt; 6 &copy; 2024 &#10003; &#x1F600;&lt;/p&gt;";

function EntityReference() {
  const [q, setQ] = React.useState("");
  const rows = ENTITY_TABLE.filter((e) => !q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase()) || e.char === q.trim()).slice(0, 150);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or paste a character…" aria-label="Search entities" className="h-7 flex-1 bg-transparent text-sm outline-none" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Char</th>
              <th className="px-3 py-1.5 text-left font-medium">Entity</th>
              <th className="px-3 py-1.5 text-left font-medium">Code</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.name} className="border-b border-border/60">
                <td className="px-3 py-1 text-base">{e.char}</td>
                <td className="px-3 py-1 font-mono">&amp;{e.name};</td>
                <td className="px-3 py-1 font-mono text-muted-foreground">&amp;#{e.code};</td>
                <td className="px-2 py-1 text-right">
                  <CopyButton value={`&${e.name};`} size="sm" variant="ghost" className="h-6 px-2 text-xs" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HtmlEntityEncoder() {
  useTrackTool("html-entity-encoder");
  const [mode, setMode] = React.useState<Mode>("encode");
  const [input, setInput] = React.useState(SAMPLE_ENCODE);
  const [scope, setScope] = React.useState<EntityScope>("non-ascii");
  const [style, setStyle] = React.useState<NumericStyle>("named");
  const [view, setView] = React.useState<"result" | "reference">("result");

  const encode = mode === "encode";
  const output = React.useMemo(() => (encode ? encodeEntities(input, { scope, style }) : decodeEntities(input)), [input, encode, scope, style]);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setInput(next === "encode" ? SAMPLE_ENCODE : SAMPLE_DECODE);
  };

  return (
    <ConverterWorkspace
      slug="html-entity-encoder"
      input={input}
      onInput={setInput}
      inputLanguage={encode ? "html" : "plaintext"}
      outputLanguage={encode ? "plaintext" : "html"}
      output={output}
      error={null}
      inputTitle={encode ? "Text or HTML" : "Text with entities"}
      outputTitle={
        <div className="flex gap-0.5" role="tablist" aria-label="Output view">
          {(["result", "reference"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("rounded px-2.5 py-1 text-xs font-medium transition-colors", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {v === "result" ? (encode ? "Encoded" : "Decoded") : "Entity reference"}
            </button>
          ))}
        </div>
      }
      historyTitle={encode ? "Encoded entities" : "Decoded entities"}
      onSample={() => setInput(encode ? SAMPLE_ENCODE : SAMPLE_DECODE)}
      fileAccept=".html,.htm,.txt,text/html,text/plain"
      download={{ name: encode ? "encoded.txt" : "decoded.txt", mime: "text/plain" }}
      emptyMessage="Paste text or HTML to convert it."
      outputView={view === "reference" ? <EntityReference /> : undefined}
      options={
        <>
          <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Direction">
            {(["encode", "decode"] as const).map((m) => (
              <button key={m} onClick={() => switchMode(m)} aria-pressed={mode === m} className={cn("h-8 px-3 text-sm font-medium capitalize transition-colors", mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {m}
              </button>
            ))}
          </div>
          <ToolbarButton icon={<ArrowLeftRight className="h-3.5 w-3.5" />} onClick={() => { setInput(output); setMode(encode ? "decode" : "encode"); }} disabled={!output}>
            Swap
          </ToolbarButton>
          {encode && (
            <>
              <ToolbarSelect
                label="Encode"
                value={scope}
                onChange={(v) => setScope(v as EntityScope)}
                options={[
                  { value: "minimal", label: "Only & < > \" '" },
                  { value: "non-ascii", label: "Plus all non-ASCII" },
                  { value: "all", label: "Every character" },
                ]}
              />
              <ToolbarSelect
                label="Style"
                value={style}
                onChange={(v) => setStyle(v as NumericStyle)}
                options={[
                  { value: "named", label: "Named (&copy;)" },
                  { value: "decimal", label: "Decimal (&#169;)" },
                  { value: "hex", label: "Hex (&#xA9;)" },
                ]}
              />
            </>
          )}
        </>
      }
    />
  );
}

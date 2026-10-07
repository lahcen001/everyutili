"use client";

import * as React from "react";

import { ConverterWorkspace } from "@/components/tools/developer/workspace/ConverterWorkspace";
import { CodeEditor } from "@/components/tools/developer/workspace/CodeEditor";
import { ToolbarToggle } from "@/components/tools/developer/workspace/Workspace";
import { useTrackTool } from "@/hooks/useTrackTool";
import { CATEGORY_INFO, cleanInvisible, countByCategory, hex, revealInvisible, scanInvisible, type InvisibleCategory } from "@/lib/invisibleChars";
import { cn } from "@/lib/utils";

const SAMPLE = "Hel​lo wor‌ld — this te­xt has hid​den char⁠acters, a bidi‮ mark and a family \u{1F468}‍\u{1F469}‍\u{1F467} emoji.";

type View = "clean" | "reveal" | "report";
const DEFAULTS = new Set(Object.entries(CATEGORY_INFO).filter(([, v]) => v.removeByDefault).map(([k]) => k as InvisibleCategory));

export default function ZeroWidthRemover() {
  useTrackTool("zero-width-remover");
  const [input, setInput] = React.useState(SAMPLE);
  const [remove, setRemove] = React.useState<Set<InvisibleCategory>>(DEFAULTS);
  const [view, setView] = React.useState<View>("clean");

  const hits = React.useMemo(() => scanInvisible(input), [input]);
  const counts = React.useMemo(() => countByCategory(hits), [hits]);
  const output = React.useMemo(() => cleanInvisible(input, remove), [input, remove]);
  const willRemove = hits.filter((h) => remove.has(h.category)).length;

  const toggle = (c: InvisibleCategory, on: boolean) =>
    setRemove((prev) => {
      const next = new Set(prev);
      if (on) next.add(c);
      else next.delete(c);
      return next;
    });

  const tabs = (
    <div className="flex gap-0.5" role="tablist" aria-label="Output view">
      {([["clean", "Cleaned text"], ["reveal", "Reveal hidden"], ["report", `Report (${hits.length})`]] as const).map(([id, label]) => (
        <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cn("rounded px-2.5 py-1 text-xs font-medium transition-colors", view === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          {label}
        </button>
      ))}
    </div>
  );

  const outputView =
    view === "reveal" ? (
      <CodeEditor value={revealInvisible(input)} language="plaintext" readOnly wordWrap ariaLabel="Text with hidden characters shown" />
    ) : view === "report" ? (
      <div className="h-full overflow-auto p-3">
        {hits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hidden characters found — this text is clean.</p>
        ) : (
          <>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1.5 font-medium">Type</th>
                  <th className="py-1.5 text-right font-medium">Found</th>
                  <th className="py-1.5 pl-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(counts) as InvisibleCategory[]).map((c) => (
                  <tr key={c} className="border-b border-border/60">
                    <td className="py-1.5">
                      <p className="font-medium">{CATEGORY_INFO[c].label}</p>
                      <p className="text-muted-foreground">{CATEGORY_INFO[c].note}</p>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{counts[c]}</td>
                    <td className="py-1.5 pl-4">{remove.has(c) ? (c === "space" ? "replaced with a space" : "removed") : "kept"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Positions (character number)</h3>
            <ul className="space-y-0.5 font-mono text-xs">
              {hits.slice(0, 200).map((h, i) => (
                <li key={i}>
                  #{h.index + 1} · {hex(h.codePoint)} · {h.name}
                </li>
              ))}
              {hits.length > 200 && <li className="text-muted-foreground">…and {hits.length - 200} more</li>}
            </ul>
          </>
        )}
      </div>
    ) : undefined;

  return (
    <ConverterWorkspace
      slug="zero-width-remover"
      input={input}
      onInput={setInput}
      inputLanguage="plaintext"
      outputLanguage="plaintext"
      output={output}
      error={null}
      inputTitle="Text to check"
      outputTitle={tabs}
      historyTitle={`${willRemove} hidden characters removed`}
      onSample={() => setInput(SAMPLE)}
      fileAccept=".txt,.md,.csv,text/plain"
      download={{ name: "cleaned.txt", mime: "text/plain" }}
      emptyMessage="Paste text to look for hidden characters."
      outputView={outputView}
      stats={hits.length === 0 ? <span className="font-medium text-emerald-600 dark:text-emerald-400">No hidden characters</span> : <span className="font-medium text-amber-600 dark:text-amber-400">{hits.length} hidden character{hits.length === 1 ? "" : "s"} found · {willRemove} will be removed</span>}
      options={
        <>
          <span className="text-xs text-muted-foreground">Remove:</span>
          {(Object.keys(CATEGORY_INFO) as InvisibleCategory[]).map((c) => (
            <span key={c} title={CATEGORY_INFO[c].note}>
              <ToolbarToggle label={`${CATEGORY_INFO[c].label.split(" / ")[0].split(" (")[0]}${counts[c] ? ` (${counts[c]})` : ""}`} checked={remove.has(c)} onChange={(v) => toggle(c, v)} />
            </span>
          ))}
        </>
      }
    />
  );
}

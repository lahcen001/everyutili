"use client";

import * as React from "react";
import { Save } from "lucide-react";

import { CodeEditor, type EditorDecoration } from "@/components/tools/developer/workspace/CodeEditor";
import { SplitPane } from "@/components/tools/developer/workspace/SplitPane";
import { Pane, ToolbarButton, Workspace } from "@/components/tools/developer/workspace/Workspace";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { CHEAT_SHEET, REGEX_PRESETS } from "@/lib/regexLibrary";
import { explainFlags, explainRegex } from "@/lib/regexExplain";
import type { RegexMode, RegexResponse } from "@/lib/regex";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";
import type { RegexWorkerResponse } from "@/workers/regex.worker";

type Tab = "matches" | "replace" | "split" | "explain" | "cheatsheet";
const TABS: { id: Tab; label: string }[] = [
  { id: "matches", label: "Matches" },
  { id: "replace", label: "Replace" },
  { id: "split", label: "Split" },
  { id: "explain", label: "Explain" },
  { id: "cheatsheet", label: "Cheat sheet" },
];
const FLAGS: { flag: string; label: string; hint: string }[] = [
  { flag: "g", label: "g", hint: "global — find every match" },
  { flag: "i", label: "i", hint: "ignore case" },
  { flag: "m", label: "m", hint: "multiline — ^ and $ match per line" },
  { flag: "s", label: "s", hint: "dot-all — . matches newlines" },
  { flag: "u", label: "u", hint: "unicode" },
  { flag: "y", label: "y", hint: "sticky" },
  { flag: "d", label: "d", hint: "indices (capture group positions)" },
];
const TIMEOUT_MS = 1500;

type Run = { key: string; result?: RegexResponse; timedOut?: boolean };

function visible(text: string): string {
  return text.replace(/\n/g, "↵").replace(/\t/g, "⇥").replace(/ /g, "·");
}

export default function RegexTester() {
  useTrackTool("regex-tester");
  const initial = REGEX_PRESETS[4];
  const [pattern, setPattern] = React.useState(initial.pattern);
  const [flags, setFlags] = React.useState(initial.flags);
  const [text, setText] = React.useState(initial.sample);
  const [replacement, setReplacement] = React.useState("$<day>/$<month>/$<year>");
  const [tab, setTab] = React.useState<Tab>("matches");
  const [run, setRun] = React.useState<Run | null>(null);
  const workerRef = React.useRef<Worker | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const mode: RegexMode = tab === "replace" ? "replace" : tab === "split" ? "split" : "match";
  const key = JSON.stringify([pattern, flags, text, mode, replacement]);

  // Run in a worker so a pattern that backtracks forever can be abandoned instead of freezing the page.
  React.useEffect(() => {
    const debounce = window.setTimeout(() => {
      workerRef.current ??= new Worker(new URL("@/workers/regex.worker.ts", import.meta.url));
      const worker = workerRef.current;
      const id = Math.random();
      const kill = window.setTimeout(() => {
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        setRun({ key, timedOut: true });
      }, TIMEOUT_MS);
      worker.onmessage = (e: MessageEvent<RegexWorkerResponse>) => {
        window.clearTimeout(kill);
        setRun({ key, result: e.data.result });
      };
      worker.postMessage({ id, pattern, flags, text, mode, replacement });
    }, 120);
    return () => window.clearTimeout(debounce);
  }, [key, pattern, flags, text, mode, replacement]);

  React.useEffect(() => () => workerRef.current?.terminate(), []);

  const current = run?.key === key ? run : null;
  const result = current?.result;
  const timedOut = current?.timedOut;
  const matches = result?.matches ?? [];

  const decorations = React.useMemo<EditorDecoration[]>(() => {
    const out: EditorDecoration[] = [];
    matches.forEach((m, i) => {
      if (m.end > m.index) out.push({ start: m.index, end: m.end, className: i % 2 ? "regex-match-b" : "regex-match-a", hover: `Match ${i + 1}` });
      m.ranges?.forEach((r, gi) => r && r[1] > r[0] && out.push({ start: r[0], end: r[1], className: "regex-group", hover: `Group ${gi + 1}` }));
    });
    return out;
  }, [matches]);

  const explanation = React.useMemo(() => (pattern ? explainRegex(pattern) : []), [pattern]);
  const toggleFlag = (f: string) => setFlags((prev) => (prev.includes(f) ? prev.replace(f, "") : prev + f));

  const loadPreset = (id: string) => {
    const p = REGEX_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPattern(p.pattern);
    setFlags(p.flags);
    setText(p.sample);
  };
  const save = async () => {
    await saveToolResult("regex-tester", { title: `/${pattern}/${flags}`, summary: `${result?.total ?? 0} matches`, data: JSON.stringify({ pattern, flags, text }) });
    historyRef.current?.refresh();
  };
  const restore = (item: ToolHistoryItem) => {
    try {
      const s = JSON.parse(item.data ?? "") as { pattern: string; flags: string; text: string };
      setPattern(s.pattern);
      setFlags(s.flags);
      setText(s.text);
    } catch {
      /* not a saved regex state */
    }
  };

  const toolbar = (
    <>
      <div className="flex min-w-72 flex-1 items-center gap-1 rounded-md border border-border bg-background px-2 focus-within:ring-2 focus-within:ring-primary">
        <span className="font-mono text-muted-foreground" aria-hidden>
          /
        </span>
        <input value={pattern} onChange={(e) => setPattern(e.target.value)} spellCheck={false} placeholder="pattern" aria-label="Regular expression" className="h-8 min-w-0 flex-1 bg-transparent font-mono text-sm outline-none" />
        <span className="font-mono text-muted-foreground" aria-hidden>
          /{flags}
        </span>
      </div>
      <div className="flex gap-0.5" role="group" aria-label="Flags">
        {FLAGS.map((f) => (
          <button key={f.flag} onClick={() => toggleFlag(f.flag)} aria-pressed={flags.includes(f.flag)} title={f.hint} className={cn("h-8 w-7 rounded-md border font-mono text-sm transition-colors", flags.includes(f.flag) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
            {f.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Library
        <select value="" onChange={(e) => loadPreset(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground" aria-label="Load a common pattern">
          <option value="">Common patterns…</option>
          {REGEX_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="ml-auto flex items-center gap-2">
        <CopyButton value={`/${pattern}/${flags}`} size="sm" variant="outline" disabled={!pattern}>
          Copy regex
        </CopyButton>
        <ToolbarButton icon={<Save className="h-3.5 w-3.5" />} onClick={save} disabled={!pattern}>
          Save
        </ToolbarButton>
      </div>
    </>
  );

  const status = (
    <>
      {result && !result.ok ? (
        <span className="font-medium text-destructive">Invalid pattern</span>
      ) : timedOut ? (
        <span className="font-medium text-destructive">Stopped — took over {TIMEOUT_MS / 1000}s</span>
      ) : (
        <span className="font-medium text-foreground">
          {(result?.total ?? 0).toLocaleString()} match{result?.total === 1 ? "" : "es"}
          {!flags.includes("g") && result?.total ? " (add g to find all)" : ""}
        </span>
      )}
      <span>
        /{pattern}/{flags}
      </span>
      <span>{text.length.toLocaleString()} characters</span>
    </>
  );

  const tabButtons = (
    <div className="flex flex-wrap gap-0.5" role="tablist" aria-label="Result view">
      {TABS.map((t) => (
        <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("rounded px-2.5 py-1 text-xs font-medium transition-colors", tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          {t.label}
        </button>
      ))}
    </div>
  );

  const errorBox = (message: string) => (
    <div role="alert" className="m-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );

  let body: React.ReactNode;
  if (result && !result.ok) body = errorBox(result.error ?? "Invalid regular expression");
  else if (timedOut) body = errorBox("This pattern took too long and was stopped. It probably has catastrophic backtracking — nested quantifiers such as (a+)+ are the usual cause.");
  else if (tab === "cheatsheet")
    body = (
      <div className="h-full space-y-4 overflow-auto p-3">
        {CHEAT_SHEET.map((g) => (
          <section key={g.group}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.group}</h3>
            <dl className="grid grid-cols-[minmax(0,12rem)_1fr] gap-x-3 gap-y-1 text-xs">
              {g.items.map(([token, meaning]) => (
                <React.Fragment key={token}>
                  <dt className="font-mono font-medium">{token}</dt>
                  <dd className="text-muted-foreground">{meaning}</dd>
                </React.Fragment>
              ))}
            </dl>
          </section>
        ))}
      </div>
    );
  else if (tab === "explain")
    body = !pattern ? (
      <p className="p-4 text-sm text-muted-foreground">Type a pattern to see it explained.</p>
    ) : (
      <div className="h-full overflow-auto p-3">
        <ul className="space-y-1">
          {explanation.map((item, i) => (
            <li key={i} className="flex gap-3 text-xs" style={{ paddingLeft: item.depth * 16 }}>
              <code className="min-w-16 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono font-medium">{item.token}</code>
              <span className="text-muted-foreground">{item.meaning}</span>
            </li>
          ))}
        </ul>
        {flags && (
          <>
            <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Flags</h3>
            <ul className="space-y-1">
              {explainFlags(flags).map((f) => (
                <li key={f.token} className="flex gap-3 text-xs">
                  <code className="min-w-16 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono font-medium">{f.token}</code>
                  <span className="text-muted-foreground">{f.meaning}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  else if (tab === "replace")
    body = (
      <div className="flex h-full flex-col">
        <div className="border-b border-border p-2">
          <input value={replacement} onChange={(e) => setReplacement(e.target.value)} spellCheck={false} aria-label="Replacement" placeholder="Replacement, e.g. $2-$1 or $<name>" className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs outline-none focus:ring-2 focus:ring-primary" />
          <p className="mt-1 text-[11px] text-muted-foreground">$1 $2… insert groups, $&lt;name&gt; a named group, $&amp; the whole match, $$ a dollar sign.</p>
        </div>
        <div className="min-h-0 flex-1">
          <CodeEditor value={result?.replaced ?? ""} language="plaintext" readOnly wordWrap ariaLabel="Replaced text" />
        </div>
      </div>
    );
  else if (tab === "split")
    body = (
      <div className="h-full overflow-auto p-3">
        <p className="mb-2 text-xs text-muted-foreground">{result?.parts?.length ?? 0} parts</p>
        <ol className="space-y-1">
          {(result?.parts ?? []).slice(0, 500).map((p, i) => (
            <li key={i} className="flex gap-2 rounded border border-border bg-muted/20 px-2 py-1 font-mono text-xs">
              <span className="text-muted-foreground">{i + 1}</span>
              <span className="break-all">{p === "" ? <em className="text-muted-foreground">(empty)</em> : visible(p)}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  else
    body =
      !pattern ? (
        <p className="p-4 text-sm text-muted-foreground">Type a pattern above to find matches.</p>
      ) : matches.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{current ? "No matches." : "Matching…"}</p>
      ) : (
        <ul className="h-full space-y-2 overflow-auto p-3">
          {matches.slice(0, 200).map((m, i) => (
            <li key={i} className="rounded-lg border border-border bg-muted/20 p-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Match {i + 1}</span>
                <span className="tabular-nums">
                  {m.index}–{m.end}
                </span>
              </div>
              <div className="mt-1 break-all font-mono text-xs">{m.text === "" ? <em className="text-muted-foreground">(empty match)</em> : visible(m.text)}</div>
              {(m.groups.length > 0 || Object.keys(m.named).length > 0) && (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-border pt-2 text-xs">
                  {m.groups.map((g, gi) => {
                    const name = Object.entries(m.named).find(([, v]) => v === g && g !== undefined)?.[0];
                    return (
                      <React.Fragment key={gi}>
                        <dt className="text-muted-foreground">{name ? `${gi + 1} · ${name}` : `Group ${gi + 1}`}</dt>
                        <dd className="break-all font-mono">{g === undefined ? <em className="text-muted-foreground">undefined</em> : g === "" ? <em className="text-muted-foreground">(empty)</em> : visible(g)}</dd>
                      </React.Fragment>
                    );
                  })}
                </dl>
              )}
            </li>
          ))}
          {(result?.truncated || matches.length > 200) && <li className="text-xs text-muted-foreground">Showing the first {Math.min(matches.length, 200)} of {result?.total.toLocaleString()} matches.</li>}
        </ul>
      );

  return (
    <div className="space-y-4">
      <Workspace toolbar={toolbar} status={status}>
        <SplitPane
          initial={52}
          left={
            <Pane title="Test string" actions={<span className="font-normal">matches are highlighted</span>}>
              <CodeEditor value={text} onChange={setText} language="plaintext" decorations={decorations} ariaLabel="Test string" />
            </Pane>
          }
          right={
            <Pane title={tabButtons} className="[&>header]:py-1">
              {body}
            </Pane>
          }
        />
      </Workspace>
      <ToolHistoryList ref={historyRef} toolSlug="regex-tester" onRestore={restore} />
    </div>
  );
}

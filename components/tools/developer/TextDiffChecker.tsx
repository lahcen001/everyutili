"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { ArrowLeftRight, Download, Eraser, FileUp, Save } from "lucide-react";
import type { DiffOnMount } from "@monaco-editor/react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { ToolbarButton, ToolbarSelect, ToolbarSeparator, ToolbarToggle, Workspace } from "@/components/tools/developer/workspace/Workspace";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { diffStats, unifiedPatch } from "@/lib/diffText";
import { downloadBlob } from "@/lib/downloadBlob";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";

const DiffEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.DiffEditor), {
  ssr: false,
  loading: () => <div className="flex h-full min-h-48 items-center justify-center text-sm text-muted-foreground">Loading editor…</div>,
});

const SAMPLE_A = `function greet(name) {
  console.log("Hello, " + name);
  return true;
}

const users = ["ada", "grace", "linus"];
users.forEach(greet);
`;
const SAMPLE_B = `function greet(name, punctuation = "!") {
  console.log(\`Hello, \${name}\${punctuation}\`);
  return true;
}

const users = ["ada", "grace", "linus", "margaret"];
users.forEach((u) => greet(u));
`;

const LANGUAGES = [
  { value: "plaintext", label: "Plain text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "json", label: "JSON" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "markdown", label: "Markdown" },
  { value: "yaml", label: "YAML" },
  { value: "sql", label: "SQL" },
  { value: "python", label: "Python" },
];

export default function TextDiffChecker() {
  useTrackTool("text-diff-checker");
  const { resolvedTheme } = useTheme();
  const [original, setOriginal] = React.useState(SAMPLE_A);
  const [modified, setModified] = React.useState(SAMPLE_B);
  const [sideBySide, setSideBySide] = React.useState(true);
  const [ignoreWhitespace, setIgnoreWhitespace] = React.useState(false);
  const [ignoreCase, setIgnoreCase] = React.useState(false);
  const [wrap, setWrap] = React.useState(false);
  const [language, setLanguage] = React.useState("javascript");
  const originalFile = React.useRef<HTMLInputElement>(null);
  const modifiedFile = React.useRef<HTMLInputElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const opts = { ignoreWhitespace, ignoreCase };
  const stats = React.useMemo(() => diffStats(original, modified, { ignoreWhitespace, ignoreCase }), [original, modified, ignoreWhitespace, ignoreCase]);
  const patch = React.useMemo(() => (stats.identical ? "" : unifiedPatch(original, modified, { ignoreWhitespace, ignoreCase })), [stats.identical, original, modified, ignoreWhitespace, ignoreCase]);

  const handleMount: DiffOnMount = (editor) => {
    editor.getOriginalEditor().onDidChangeModelContent(() => setOriginal(editor.getOriginalEditor().getValue()));
    editor.getModifiedEditor().onDidChangeModelContent(() => setModified(editor.getModifiedEditor().getValue()));
  };

  const openInto = async (file: File | undefined, set: (v: string) => void) => {
    if (file) set(await file.text());
  };
  const save = async () => {
    await saveToolResult("text-diff-checker", { title: stats.identical ? "Identical texts" : `+${stats.added} −${stats.removed} lines`, summary: `${original.length.toLocaleString()} → ${modified.length.toLocaleString()} characters`, data: JSON.stringify({ original, modified }) });
    historyRef.current?.refresh();
  };
  const restore = (item: ToolHistoryItem) => {
    try {
      const s = JSON.parse(item.data ?? "") as { original: string; modified: string };
      setOriginal(s.original);
      setModified(s.modified);
    } catch {
      /* not a saved diff */
    }
  };

  const toolbar = (
    <>
      <ToolbarButton icon={<ArrowLeftRight className="h-3.5 w-3.5" />} onClick={() => { setOriginal(modified); setModified(original); }}>
        Swap
      </ToolbarButton>
      <ToolbarButton icon={<FileUp className="h-3.5 w-3.5" />} onClick={() => originalFile.current?.click()}>
        Open original
      </ToolbarButton>
      <ToolbarButton icon={<FileUp className="h-3.5 w-3.5" />} onClick={() => modifiedFile.current?.click()}>
        Open changed
      </ToolbarButton>
      <input ref={originalFile} type="file" className="hidden" onChange={(e) => { void openInto(e.target.files?.[0], setOriginal); e.target.value = ""; }} />
      <input ref={modifiedFile} type="file" className="hidden" onChange={(e) => { void openInto(e.target.files?.[0], setModified); e.target.value = ""; }} />
      <ToolbarButton icon={<Eraser className="h-3.5 w-3.5" />} onClick={() => { setOriginal(""); setModified(""); }} disabled={!original && !modified}>
        Clear
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarToggle label="Side by side" checked={sideBySide} onChange={setSideBySide} />
      <ToolbarToggle label="Ignore whitespace" checked={ignoreWhitespace} onChange={setIgnoreWhitespace} />
      <ToolbarToggle label="Ignore case" checked={ignoreCase} onChange={setIgnoreCase} />
      <ToolbarToggle label="Wrap" checked={wrap} onChange={setWrap} />
      <ToolbarSelect label="Language" value={language} onChange={setLanguage} options={LANGUAGES} />
      <div className="ml-auto flex items-center gap-2">
        <CopyButton value={patch} size="sm" variant="outline" disabled={!patch}>
          Copy patch
        </CopyButton>
        <ToolbarButton icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadBlob(new Blob([patch], { type: "text/x-diff" }), "changes.patch")} disabled={!patch}>
          Patch
        </ToolbarButton>
        <ToolbarButton icon={<Save className="h-3.5 w-3.5" />} onClick={save} disabled={!original && !modified}>
          Save
        </ToolbarButton>
      </div>
    </>
  );

  const status = (
    <>
      {stats.identical ? (
        <span className="font-medium text-emerald-600 dark:text-emerald-400">{original === "" && modified === "" ? "Paste or type text on both sides" : "No differences"}</span>
      ) : (
        <>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">+{stats.added.toLocaleString()} added</span>
          <span className="font-medium text-destructive">−{stats.removed.toLocaleString()} removed</span>
          <span>{stats.unchanged.toLocaleString()} unchanged lines</span>
        </>
      )}
      <span>Both sides are editable — type or paste directly.</span>
    </>
  );

  return (
    <div className="space-y-4">
      <Workspace toolbar={toolbar} status={status}>
        <div className="grid h-full grid-rows-[auto_1fr] gap-2">
          {sideBySide && (
            <div className="grid grid-cols-2 gap-3 px-1 text-xs font-medium text-muted-foreground">
              <span>Original</span>
              <span>Changed</span>
            </div>
          )}
          <div className="min-h-0 overflow-hidden rounded-lg border border-border">
            <DiffEditor
              height="100%"
              original={original}
              modified={modified}
              language={language}
              theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
              onMount={handleMount}
              options={{
                renderSideBySide: sideBySide,
                ignoreTrimWhitespace: ignoreWhitespace,
                originalEditable: true,
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false,
                wordWrap: wrap ? "on" : "off",
                renderOverviewRuler: true,
                enableSplitViewResizing: true,
                fixedOverflowWidgets: true,
              }}
            />
          </div>
        </div>
      </Workspace>
      <ToolHistoryList ref={historyRef} toolSlug="text-diff-checker" onRestore={restore} />
    </div>
  );
}

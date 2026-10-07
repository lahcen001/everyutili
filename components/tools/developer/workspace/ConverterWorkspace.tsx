"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Download, Eraser, FileText, FileUp, Save } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { CodeEditor, type EditorMarker, type JumpRequest } from "@/components/tools/developer/workspace/CodeEditor";
import { SplitPane } from "@/components/tools/developer/workspace/SplitPane";
import { Pane, ToolbarButton, ToolbarSeparator, Workspace } from "@/components/tools/developer/workspace/Workspace";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";

export interface ConverterError {
  message: string;
  line?: number;
  column?: number;
}

interface ConverterWorkspaceProps {
  /** tool slug, used for saving to history */
  slug: string;
  input: string;
  onInput: (value: string) => void;
  inputLanguage: string;
  outputLanguage: string;
  output: string;
  error: ConverterError | null;
  inputTitle: string;
  outputTitle: React.ReactNode;
  /** options and mode switches shown at the start of the toolbar */
  options?: React.ReactNode;
  onSample?: () => void;
  fileAccept?: string;
  download: { name: string; mime: string };
  /** extra items for the status bar */
  stats?: React.ReactNode;
  /** replaces the read-only output editor (e.g. a table preview) */
  outputView?: React.ReactNode;
  /** extra buttons at the end of the toolbar, before Copy */
  extraActions?: React.ReactNode;
  /** a human title for a saved history entry */
  historyTitle: string;
  emptyMessage?: string;
}

/** Input editor | output editor, with the toolbar, status bar, file drop, copy, download and history every converter needs. */
export function ConverterWorkspace({ slug, input, onInput, inputLanguage, outputLanguage, output, error, inputTitle, outputTitle, options, onSample, fileAccept, download, stats, outputView, extraActions, historyTitle, emptyMessage }: ConverterWorkspaceProps) {
  const [cursor, setCursor] = React.useState({ line: 1, column: 1 });
  const [jump, setJump] = React.useState<JumpRequest | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const markers = React.useMemo<EditorMarker[]>(() => (error?.line ? [{ line: error.line, column: error.column ?? 1, message: error.message }] : []), [error]);
  const lines = input === "" ? 0 : input.split("\n").length;
  const empty = input.trim() === "";

  const openFile = async (file: File | undefined) => {
    if (file) onInput(await file.text());
  };
  const save = async () => {
    if (error || !output) return;
    await saveToolResult(slug, { title: historyTitle, summary: `${output.length.toLocaleString()} characters`, data: input });
    historyRef.current?.refresh();
  };
  const restore = (item: ToolHistoryItem) => {
    if (item.data) onInput(item.data);
  };

  const toolbar = (
    <>
      {options}
      {options && <ToolbarSeparator />}
      {onSample && (
        <ToolbarButton icon={<FileText className="h-3.5 w-3.5" />} onClick={onSample}>
          Sample
        </ToolbarButton>
      )}
      <ToolbarButton icon={<FileUp className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()}>
        Open
      </ToolbarButton>
      <input ref={fileRef} type="file" accept={fileAccept} className="hidden" onChange={(e) => { void openFile(e.target.files?.[0]); e.target.value = ""; }} />
      <ToolbarButton icon={<Eraser className="h-3.5 w-3.5" />} onClick={() => onInput("")} disabled={!input}>
        Clear
      </ToolbarButton>
      <div className="ml-auto flex items-center gap-2">
        {extraActions}
        <CopyButton value={output} size="sm" variant="outline" disabled={!output || !!error}>
          Copy
        </CopyButton>
        <ToolbarButton icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadBlob(new Blob([output], { type: download.mime }), download.name)} disabled={!output || !!error}>
          Download
        </ToolbarButton>
        <ToolbarButton icon={<Save className="h-3.5 w-3.5" />} onClick={save} disabled={!output || !!error}>
          Save
        </ToolbarButton>
      </div>
    </>
  );

  const status = (
    <>
      {empty ? (
        <span>Paste, type or drop a file</span>
      ) : error ? (
        <button onClick={() => error.line && setJump({ line: error.line, column: error.column ?? 1, nonce: Date.now() })} className="flex items-center gap-1 text-left font-medium text-destructive hover:underline" disabled={!error.line}>
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error.line ? `Line ${error.line}${error.column ? `, column ${error.column}` : ""}: ` : ""}
          {error.message}
        </button>
      ) : (
        <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> Converted
        </span>
      )}
      <span className="tabular-nums">
        Ln {cursor.line}, Col {cursor.column}
      </span>
      <span>{formatBytes(new Blob([input]).size)}</span>
      <span>{lines.toLocaleString()} lines</span>
      {stats}
    </>
  );

  return (
    <div className="space-y-4">
      <Workspace toolbar={toolbar} status={status}>
        <SplitPane
          left={
            <Pane title={inputTitle} actions={<span className="font-normal">drop a file here</span>}>
              <div
                className={cn("h-full", dragging && "ring-2 ring-inset ring-primary")}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void openFile(e.dataTransfer.files?.[0]);
                }}
              >
                <CodeEditor value={input} onChange={onInput} language={inputLanguage} markers={markers} jumpTo={jump} onCursor={setCursor} ariaLabel={inputTitle} />
              </div>
            </Pane>
          }
          right={
            <Pane title={outputTitle}>
              {error || empty ? (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{empty ? (emptyMessage ?? "The result appears here.") : "Fix the error in the input to see the result."}</div>
              ) : (
                (outputView ?? <CodeEditor value={output} language={outputLanguage} readOnly ariaLabel={typeof outputTitle === "string" ? outputTitle : "Output"} />)
              )}
            </Pane>
          }
        />
      </Workspace>
      <ToolHistoryList ref={historyRef} toolSlug={slug} onRestore={restore} />
    </div>
  );
}

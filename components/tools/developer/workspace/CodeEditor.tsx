"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type { OnMount } from "@monaco-editor/react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="flex h-full min-h-48 items-center justify-center text-sm text-muted-foreground">Loading editor…</div>,
});

export interface EditorMarker {
  line: number;
  column: number;
  message: string;
}

export interface JumpRequest {
  line: number;
  column: number;
  /** change this to jump again to the same spot */
  nonce: number;
}

export interface EditorDecoration {
  /** character offsets into the text */
  start: number;
  end: number;
  className: string;
  hover?: string;
}

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  markers?: EditorMarker[];
  jumpTo?: JumpRequest | null;
  onCursor?: (pos: { line: number; column: number }) => void;
  wordWrap?: boolean;
  ariaLabel?: string;
  decorations?: EditorDecoration[];
  /** called with 0–1 as the editor scrolls, for keeping a preview in step */
  onScrollRatio?: (ratio: number) => void;
}

type Monaco = Parameters<OnMount>[1];
type Editor = Parameters<OnMount>[0];

/** The one Monaco wrapper for every developer tool: fills its parent, follows the site theme, shows error squiggles. */
export function CodeEditor({ value, onChange, language = "json", readOnly = false, markers, jumpTo, onCursor, wordWrap = false, ariaLabel, decorations, onScrollRatio }: CodeEditorProps) {
  const { resolvedTheme } = useTheme();
  const editorRef = React.useRef<Editor | null>(null);
  const monacoRef = React.useRef<Monaco | null>(null);
  const decorationRef = React.useRef<ReturnType<Editor["createDecorationsCollection"]> | null>(null);
  const [ready, setReady] = React.useState(false);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onDidChangeCursorPosition((e) => onCursor?.({ line: e.position.lineNumber, column: e.position.column }));
    editor.onDidScrollChange((e) => {
      const max = e.scrollHeight - editor.getLayoutInfo().height;
      if (e.scrollTopChanged && max > 0) onScrollRatio?.(Math.min(1, Math.max(0, e.scrollTop / max)));
    });
    setReady(true);
  };

  React.useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!ready || !editor || !monaco || !model) return;
    monaco.editor.setModelMarkers(
      model,
      "tool",
      (markers ?? []).map((m) => ({
        severity: monaco.MarkerSeverity.Error,
        message: m.message,
        startLineNumber: m.line,
        startColumn: m.column,
        endLineNumber: m.line,
        endColumn: Math.max(m.column + 1, model.getLineMaxColumn(Math.min(m.line, model.getLineCount()))),
      }))
    );
  }, [markers, ready, value]);

  React.useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!ready || !editor || !monaco || !model || !decorations) return;
    decorationRef.current ??= editor.createDecorationsCollection();
    decorationRef.current.set(
      decorations.map((d) => {
        const a = model.getPositionAt(d.start);
        const b = model.getPositionAt(d.end);
        return {
          range: new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column),
          options: { inlineClassName: d.className, hoverMessage: d.hover ? { value: d.hover } : undefined },
        };
      })
    );
  }, [decorations, ready, value]);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!ready || !editor || !jumpTo) return;
    editor.revealPositionInCenter({ lineNumber: jumpTo.line, column: jumpTo.column });
    editor.setPosition({ lineNumber: jumpTo.line, column: jumpTo.column });
    editor.focus();
  }, [jumpTo, ready]);

  return (
    <MonacoEditor
      height="100%"
      language={language}
      value={value}
      onChange={(v) => onChange?.(v ?? "")}
      onMount={handleMount}
      theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineHeight: 20,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: wordWrap ? "on" : "off",
        tabSize: 2,
        renderLineHighlight: readOnly ? "none" : "line",
        padding: { top: 10, bottom: 10 },
        smoothScrolling: true,
        bracketPairColorization: { enabled: true },
        folding: true,
        ariaLabel,
        fixedOverflowWidgets: true,
      }}
    />
  );
}

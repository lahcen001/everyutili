"use client";

import * as React from "react";

import { ConverterWorkspace } from "@/components/tools/developer/workspace/ConverterWorkspace";
import { ToolbarToggle } from "@/components/tools/developer/workspace/Workspace";
import { useTrackTool } from "@/hooks/useTrackTool";
import { formatBytes } from "@/lib/format";
import { beautifyCss, gzipSize, minifyCss, minifyHtml, minifyJs, minifyJson, minifySvg } from "@/lib/minify";
import { cn } from "@/lib/utils";

type Mode = "html" | "css" | "js" | "json" | "svg";

const MODES: { id: Mode; label: string; language: string; ext: string; mime: string }[] = [
  { id: "html", label: "HTML", language: "html", ext: "html", mime: "text/html" },
  { id: "css", label: "CSS", language: "css", ext: "css", mime: "text/css" },
  { id: "js", label: "JavaScript", language: "javascript", ext: "js", mime: "text/javascript" },
  { id: "json", label: "JSON", language: "json", ext: "json", mime: "application/json" },
  { id: "svg", label: "SVG", language: "xml", ext: "svg", mime: "image/svg+xml" },
];

const SAMPLES: Record<Mode, string> = {
  html: `<!DOCTYPE html>
<html>
  <head>
    <!-- page title -->
    <title>Demo</title>
    <style>
      body { margin: 0 ; font-family: sans-serif }
    </style>
  </head>
  <body>
    <p>Hello   <b>big</b> <i>world</i></p>
    <pre>  keep   this   spacing  </pre>
  </body>
</html>`,
  css: `/* base styles */
body {
  margin: 0 ;
  padding : 0;
  font-family: sans-serif ;
}

.card > a :hover {
  color: #333 ;
  width: calc(100% - 2rem);
  content: " / " ;
}`,
  js: `// add two numbers
function add(firstNumber, secondNumber) {
  const total = firstNumber + secondNumber;
  return total;
}

console.log("Sum:", add(2, 3));`,
  json: `{
  "name": "EveryUtili",
  "tags": [ "fast", "private" ],
  "nested": { "a": 1, "b": null }
}`,
  svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <!-- circle -->
  <metadata>made in an editor</metadata>
  <circle cx="12" cy="12" r="10" fill="none" stroke="#000" stroke-width="2"/>
</svg>`,
};

type JsOutcome = { ok: true; text: string } | { ok: false; message: string; line?: number; column?: number };

export default function CodeMinifier() {
  useTrackTool("code-minifier");
  const [mode, setMode] = React.useState<Mode>("html");
  const [input, setInput] = React.useState(SAMPLES.html);
  const [keepComments, setKeepComments] = React.useState(false);
  const [beautify, setBeautify] = React.useState(false);
  const [js, setJs] = React.useState<{ input: string; result: JsOutcome } | null>(null);
  const [gzip, setGzip] = React.useState<{ text: string; size: number | null } | null>(null);

  const info = MODES.find((m) => m.id === mode)!;
  const canBeautify = mode === "css" || mode === "json";
  const beautifying = canBeautify && beautify;

  React.useEffect(() => {
    if (mode !== "js" || input.trim() === "") return;
    let cancelled = false;
    void minifyJs(input).then((result) => {
      if (!cancelled) setJs({ input, result });
    });
    return () => {
      cancelled = true;
    };
  }, [mode, input]);

  const result = React.useMemo<{ text: string; error: { message: string; line?: number; column?: number } | null; pending: boolean }>(() => {
    if (input.trim() === "") return { text: "", error: null, pending: false };
    switch (mode) {
      case "html":
        return { text: minifyHtml(input, { keepComments }), error: null, pending: false };
      case "css":
        return { text: beautifying ? beautifyCss(input) : minifyCss(input, { keepComments }), error: null, pending: false };
      case "svg":
        return { text: minifySvg(input), error: null, pending: false };
      case "json": {
        const r = minifyJson(input, beautifying);
        return r.ok ? { text: r.text, error: null, pending: false } : { text: "", error: r, pending: false };
      }
      case "js": {
        if (!js || js.input !== input) return { text: "", error: null, pending: true };
        return js.result.ok ? { text: js.result.text, error: null, pending: false } : { text: "", error: js.result, pending: false };
      }
    }
  }, [input, mode, keepComments, beautifying, js]);

  React.useEffect(() => {
    if (!result.text) return;
    let cancelled = false;
    void gzipSize(result.text).then((size) => {
      if (!cancelled) setGzip({ text: result.text, size });
    });
    return () => {
      cancelled = true;
    };
  }, [result.text]);

  const inBytes = new Blob([input]).size;
  const outBytes = new Blob([result.text]).size;
  const saved = inBytes > 0 && result.text ? Math.round((1 - outBytes / inBytes) * 100) : 0;
  const gz = gzip && gzip.text === result.text ? gzip.size : null;

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setInput(SAMPLES[next]);
    setBeautify(false);
  };

  return (
    <ConverterWorkspace
      slug="code-minifier"
      input={input}
      onInput={setInput}
      inputLanguage={info.language}
      outputLanguage={info.language}
      output={result.text}
      error={result.error}
      inputTitle={`${info.label} input`}
      outputTitle={beautifying ? `Beautified ${info.label}` : `Minified ${info.label}`}
      historyTitle={`${info.label} ${beautifying ? "beautified" : "minified"}`}
      onSample={() => setInput(SAMPLES[mode])}
      fileAccept={`.${info.ext},text/plain`}
      download={{ name: `${beautifying ? "pretty" : "min"}.${info.ext}`, mime: info.mime }}
      emptyMessage={result.pending ? "Minifying…" : "Paste code to minify it."}
      stats={
        result.text && !beautifying ? (
          <span className={cn(saved > 0 && "font-medium text-emerald-600 dark:text-emerald-400")}>
            {formatBytes(inBytes)} → {formatBytes(outBytes)} ({saved}% smaller){gz !== null && ` · gzip ≈ ${formatBytes(gz)}`}
          </span>
        ) : null
      }
      options={
        <>
          <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Language">
            {MODES.map((m) => (
              <button key={m.id} onClick={() => switchMode(m.id)} aria-pressed={mode === m.id} className={cn("h-8 px-3 text-sm font-medium transition-colors", mode === m.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {m.label}
              </button>
            ))}
          </div>
          {(mode === "html" || mode === "css") && !beautifying && <ToolbarToggle label="Keep comments" checked={keepComments} onChange={setKeepComments} />}
          {canBeautify && <ToolbarToggle label="Beautify instead" checked={beautify} onChange={setBeautify} />}
        </>
      }
    />
  );
}

"use client";

import * as React from "react";

import { ConverterWorkspace } from "@/components/tools/developer/workspace/ConverterWorkspace";
import { ToolbarSelect, ToolbarToggle } from "@/components/tools/developer/workspace/Workspace";
import { useTrackTool } from "@/hooks/useTrackTool";
import { DEFAULT_SLUG, slugify, type SlugOptions } from "@/lib/slug";

const SAMPLE = "10 Tips for Café Owners: Crème Brûlée & More!\nПривет, мир — Hello World\nThe Art of the Deal (2024 Edition)";

export default function UrlSlugGenerator() {
  useTrackTool("url-slug-generator");
  const [input, setInput] = React.useState(SAMPLE);
  const [opts, setOpts] = React.useState<SlugOptions>(DEFAULT_SLUG);
  const [base, setBase] = React.useState("");

  const set = <K extends keyof SlugOptions>(key: K, value: SlugOptions[K]) => setOpts((prev) => ({ ...prev, [key]: value }));
  const slugs = React.useMemo(() => input.split(/\r?\n/).map((line) => slugify(line, opts)), [input, opts]);
  const output = slugs.map((s) => (base.trim() && s ? `${base.trim().replace(/\/+$/, "")}/${s}` : s)).join("\n");
  const empties = slugs.filter((s, i) => s === "" && input.split(/\r?\n/)[i].trim() !== "").length;

  return (
    <ConverterWorkspace
      slug="url-slug-generator"
      input={input}
      onInput={setInput}
      inputLanguage="plaintext"
      outputLanguage="plaintext"
      output={output}
      error={null}
      inputTitle="Titles — one per line"
      outputTitle="Slugs"
      historyTitle="URL slugs"
      onSample={() => setInput(SAMPLE)}
      fileAccept=".txt,text/plain"
      download={{ name: "slugs.txt", mime: "text/plain" }}
      emptyMessage="Type a title to turn it into a URL slug."
      stats={empties > 0 ? <span className="text-amber-600 dark:text-amber-400">{empties} line{empties === 1 ? "" : "s"} became empty — try “Keep non-Latin letters”</span> : <span>{slugs.filter(Boolean).length} slug{slugs.filter(Boolean).length === 1 ? "" : "s"}</span>}
      options={
        <>
          <ToolbarSelect
            label="Separator"
            value={opts.separator}
            onChange={(v) => set("separator", v)}
            options={[
              { value: "-", label: "Hyphen -" },
              { value: "_", label: "Underscore _" },
              { value: ".", label: "Dot ." },
              { value: "", label: "None" },
            ]}
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Max length
            <input type="number" min={0} max={200} value={opts.maxLength || ""} placeholder="none" onChange={(e) => set("maxLength", Math.max(0, Math.floor(Number(e.target.value)) || 0))} className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm text-foreground" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Prefix
            <input value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://site.com/blog" spellCheck={false} className="h-8 w-44 rounded-md border border-border bg-background px-2 text-sm text-foreground" />
          </label>
          <ToolbarToggle label="lowercase" checked={opts.lowercase} onChange={(v) => set("lowercase", v)} />
          <ToolbarToggle label="Transliterate (é→e, ß→ss, Привет→privet)" checked={opts.transliterate} onChange={(v) => set("transliterate", v)} />
          <ToolbarToggle label="Keep non-Latin letters" checked={opts.keepUnicode} onChange={(v) => set("keepUnicode", v)} />
          <ToolbarToggle label="Drop stop words (a, the, of…)" checked={opts.removeStopWords} onChange={(v) => set("removeStopWords", v)} />
        </>
      }
    />
  );
}

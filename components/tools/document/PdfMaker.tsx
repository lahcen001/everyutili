"use client";

import * as React from "react";
import { Download, FileText, FileUp, Loader2, Printer, X } from "lucide-react";

import { DocPreview } from "@/components/tools/document/DocPreview";
import { PageSettingsPanel, ThemePicker } from "@/components/tools/document/DocOptions";
import { CodeEditor } from "@/components/tools/developer/workspace/CodeEditor";
import { SplitPane } from "@/components/tools/developer/workspace/SplitPane";
import { Pane, ToolbarButton, ToolbarSeparator, Workspace } from "@/components/tools/developer/workspace/Workspace";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { DEFAULT_COVER, DEFAULT_TOC, type CoverOptions, type TocOptions } from "@/lib/office/composeDocument";
import { composeDocument, type Composed } from "@/lib/office/composePdf";
import { blocksToHtml, parseHtml, parseMarkdown, parsePlainText, type Block } from "@/lib/office/docModel";
import { FONT_CHOICES, NO_OVERRIDES, applyOverrides, type StyleOverrides } from "@/lib/office/docStyle";
import { BLANK_TEMPLATE_ID, DOC_TEMPLATES, fillTemplateDate } from "@/lib/office/docTemplates";
import { getDocTheme } from "@/lib/office/docThemes";
import { readDocxBlocks } from "@/lib/office/docxRead";
import { formatDocDate } from "@/lib/office/headerFooter";
import { DEFAULT_PAGE, mmToPx, pageDimensionsMm, type PageSettings } from "@/lib/office/pageSettings";
import { htmlToPdfBlob, printDocument } from "@/lib/office/pdfExport";
import { readAnyWorkbook, workbookToBlocks } from "@/lib/office/sheets";
import { DEFAULT_WATERMARK, watermarkDataUrl, type TextWatermark } from "@/lib/office/watermarkImage";
import { sanitizeHtml } from "@/lib/sanitize";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";
import type { WorkBook } from "xlsx";

type Source = "file" | "write";
type WriteMode = "markdown" | "text" | "html";
type Panel = "content" | "style" | "page" | "extras" | "watermark";

const ACCEPT = ".docx,.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.json,.txt,.md,.markdown,.html,.htm";
const SHEET_EXT = ["xlsx", "xls", "xlsm", "ods", "csv", "tsv", "json"];
const PANELS: { id: Panel; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "style", label: "Style" },
  { id: "page", label: "Page" },
  { id: "extras", label: "Cover & contents" },
  { id: "watermark", label: "Watermark" },
];
const ACCENTS = ["2563EB", "0D9488", "16A34A", "D97706", "DC2626", "9333EA", "DB2777", "374151"];

interface LoadedFile {
  name: string;
  kind: "docx" | "sheet";
  blocks: Block[];
  workbook?: WorkBook;
  warnings: string[];
}

const inputClass = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
      {label}
    </label>
  );
}

export default function PdfMaker() {
  useTrackTool("pdf-maker");
  const [today] = React.useState(() => formatDocDate(new Date()));
  const first = DOC_TEMPLATES.find((t) => t.id === "report")!;
  const [source, setSource] = React.useState<Source>("write");
  const [writeMode, setWriteMode] = React.useState<WriteMode>("markdown");
  const [text, setText] = React.useState(() => fillTemplateDate(first.markdown, today));
  const [loaded, setLoaded] = React.useState<LoadedFile | null>(null);
  const [sheetChoice, setSheetChoice] = React.useState<Set<string>>(new Set());
  const [themeId, setThemeId] = React.useState(first.themeId);
  const [overrides, setOverrides] = React.useState<StyleOverrides>(NO_OVERRIDES);
  const [page, setPage] = React.useState<PageSettings>({ ...DEFAULT_PAGE, ...first.page });
  const [fontSize, setFontSize] = React.useState<number | null>(null);
  const [cover, setCover] = React.useState<CoverOptions>({ ...DEFAULT_COVER, ...first.cover, date: today });
  const [toc, setToc] = React.useState<TocOptions>({ ...DEFAULT_TOC, ...first.toc });
  const [watermark, setWatermark] = React.useState<TextWatermark>(DEFAULT_WATERMARK);
  const [docTitle, setDocTitle] = React.useState("");
  const [author, setAuthor] = React.useState("");
  const [panel, setPanel] = React.useState<Panel>("content");
  const [composed, setComposed] = React.useState<Composed | null>(null);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [isBuilding, setIsBuilding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const theme = React.useMemo(() => applyOverrides(getDocTheme(themeId), overrides), [themeId, overrides]);
  const effectiveFont = fontSize ?? theme.baseSize;

  let blocks: Block[] = [];
  let truncated = false;
  if (source === "file" && loaded) {
    if (loaded.kind === "docx") blocks = loaded.blocks;
    else if (loaded.workbook) {
      const result = workbookToBlocks(loaded.workbook, loaded.workbook.SheetNames.filter((n) => sheetChoice.has(n)));
      blocks = result.blocks;
      truncated = result.truncated;
    }
  } else if (source === "write") {
    blocks = writeMode === "markdown" ? parseMarkdown(text) : writeMode === "text" ? parsePlainText(text) : parseHtml(text);
  }
  const bodyHtml = sanitizeHtml(blocksToHtml(blocks));
  const wideTable = blocks.some((b) => b.type === "table" && (b.header?.length ?? b.rows[0]?.length ?? 0) >= 7);
  const firstHeading = blocks.find((b) => b.type === "heading");
  const headingText = firstHeading && "runs" in firstHeading ? firstHeading.runs.map((r) => r.text).join("") : "";
  const metaTitle = docTitle.trim() || cover.title.trim() || headingText || (loaded ? loaded.name.replace(/\.[^.]+$/, "") : "Document");
  const meta = { title: metaTitle, author: author.trim() || cover.author.trim(), date: cover.date || today };
  const coverForRender: CoverOptions = { ...cover, title: cover.title || metaTitle, author: cover.author || author };

  React.useEffect(() => {
    if (!bodyHtml) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const next = await composeDocument({ bodyHtml, theme, page, fontSizePt: fontSize ?? undefined, cover: coverForRender, toc });
        if (!cancelled) setComposed(next);
      } catch {
        if (!cancelled) setComposed(null);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // coverForRender is derived from cover, metaTitle and author
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyHtml, theme, page, fontSize, cover, toc, metaTitle, author]);

  const watermarkUrl = React.useMemo(() => {
    const { width, height } = pageDimensionsMm(page);
    return watermarkDataUrl(watermark, mmToPx(width), mmToPx(height));
  }, [watermark, page]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    try {
      if (ext === "docx") {
        const { blocks: docBlocks, warnings } = await readDocxBlocks(file);
        setLoaded({ name: file.name, kind: "docx", blocks: docBlocks, warnings });
        setSource("file");
        setPanel("content");
      } else if (SHEET_EXT.includes(ext)) {
        const { workbook } = await readAnyWorkbook(file);
        setLoaded({ name: file.name, kind: "sheet", blocks: [], workbook, warnings: [] });
        setSheetChoice(new Set(workbook.SheetNames));
        setSource("file");
        setPanel("content");
      } else if (["txt", "md", "markdown", "html", "htm"].includes(ext)) {
        setText(await file.text());
        setWriteMode(ext === "txt" ? "text" : ext.startsWith("htm") ? "html" : "markdown");
        setSource("write");
        setLoaded(null);
      } else {
        setError("This file type isn't supported. Try .docx, .xlsx, .xls, .ods, .csv, .tsv, .json, .txt, .md or .html.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
    }
  };

  const applyTemplate = (id: string) => {
    const t = DOC_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setSource("write");
    setLoaded(null);
    setWriteMode("markdown");
    setText(fillTemplateDate(t.markdown, today));
    setThemeId(t.themeId);
    setOverrides(NO_OVERRIDES);
    setFontSize(null);
    setPage({ ...DEFAULT_PAGE, ...t.page });
    setCover({ ...DEFAULT_COVER, ...t.cover, date: today });
    setToc({ ...DEFAULT_TOC, ...t.toc });
    setWatermark(DEFAULT_WATERMARK);
    setDocTitle("");
    setPanel("content");
  };

  const stem = source === "file" && loaded ? loaded.name.replace(/\.[^.]+$/, "") : metaTitle.replace(/[^\p{L}\p{N}\-_ ]+/gu, "").trim().replace(/\s+/g, "-").toLowerCase() || "document";
  const pages = composed?.layout.slices.length ?? 0;

  const makePdf = async () => {
    if (!composed) return;
    setIsBuilding(true);
    setError(null);
    setProgress(null);
    try {
      const blob = await htmlToPdfBlob(composed.html, theme, page, {
        fontSizePt: fontSize ?? undefined,
        meta,
        coverPages: composed.coverPages,
        watermark: watermark.enabled ? watermark : undefined,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      const fileName = `${stem}.pdf`;
      downloadBlob(blob, fileName);
      await saveToolResult("pdf-maker", { title: fileName, summary: `${pages} pages · ${theme.name} · ${formatBytes(blob.size)}`, blob });
      historyRef.current?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the PDF.");
    } finally {
      setIsBuilding(false);
      setProgress(null);
    }
  };

  const print = () => {
    if (!composed) return;
    setError(null);
    try {
      printDocument(composed.html, theme, page, fontSize ?? undefined, watermark.enabled ? watermarkUrl : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the print view.");
    }
  };

  const toolbar = (
    <>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Template
        <select value="" onChange={(e) => applyTemplate(e.target.value)} aria-label="Start from a template" className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground">
          <option value="">Choose a template…</option>
          {DOC_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id === BLANK_TEMPLATE_ID ? "Blank page" : `${t.name} — ${t.description}`}
            </option>
          ))}
        </select>
      </label>
      <ToolbarButton icon={<FileUp className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()}>
        Open file
      </ToolbarButton>
      <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
      <ToolbarSeparator />
      <div className="ml-auto flex items-center gap-2">
        <ToolbarButton icon={<Printer className="h-3.5 w-3.5" />} onClick={print} disabled={!composed} title="Opens your browser's print dialog — choose Save as PDF there for selectable text">
          Print / Save as PDF
        </ToolbarButton>
        <button onClick={makePdf} disabled={isBuilding || !composed} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
          {isBuilding ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {progress ? `Page ${progress.done}/${progress.total}…` : "Preparing…"}
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" /> Download PDF
            </>
          )}
        </button>
      </div>
    </>
  );

  const tabs = (
    <div className="flex flex-wrap gap-0.5" role="tablist" aria-label="Settings">
      {PANELS.map((p) => (
        <button key={p.id} role="tab" aria-selected={panel === p.id} onClick={() => setPanel(p.id)} className={cn("rounded px-2.5 py-1 text-xs font-medium transition-colors", panel === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          {p.label}
        </button>
      ))}
    </div>
  );

  const contentPanel =
    source === "write" ? (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1 border-b border-border p-2" role="group" aria-label="Input type">
          {(["markdown", "text", "html"] as const).map((m) => (
            <button key={m} onClick={() => setWriteMode(m)} aria-pressed={writeMode === m} className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize", writeMode === m ? "bg-secondary" : "text-muted-foreground hover:bg-muted")}>
              {m === "text" ? "Plain text" : m}
            </button>
          ))}
          {loaded === null && <span className="ml-auto text-[11px] text-muted-foreground">Markdown: # headings, **bold**, tables, lists</span>}
        </div>
        <div className="min-h-0 flex-1">
          <CodeEditor value={text} onChange={setText} language={writeMode === "text" ? "plaintext" : writeMode} wordWrap ariaLabel="Document content" />
        </div>
      </div>
    ) : loaded ? (
      <div className="space-y-3 overflow-auto p-4 text-sm">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="truncate font-medium">{loaded.name}</span>
          <button onClick={() => { setLoaded(null); setSource("write"); }} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
        {loaded.kind === "sheet" && loaded.workbook && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Sheets to include</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {loaded.workbook.SheetNames.map((n) => (
                <label key={n} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={sheetChoice.has(n)} onChange={() => setSheetChoice((prev) => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next; })} className="h-4 w-4 rounded border-border accent-primary" />
                  {n}
                </label>
              ))}
            </div>
            {truncated && <p className="text-xs text-amber-600 dark:text-amber-400">Very long sheets are cut to their first 3,000 rows so the PDF stays usable.</p>}
          </div>
        )}
        {loaded.warnings.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">{loaded.warnings.length} formatting notice{loaded.warnings.length === 1 ? "" : "s"} from the Word file</summary>
            <ul className="mt-1 list-disc space-y-1 pl-4">{loaded.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </details>
        )}
        <p className="text-xs text-muted-foreground">This is a faithful rendering of the file&apos;s content and tables, not a copy of its exact page layout. Use the other tabs to style it.</p>
      </div>
    ) : null;

  const stylePanel = (
    <div className="space-y-4 overflow-auto p-4">
      <ThemePicker value={themeId} onChange={setThemeId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Font">
          <select value={overrides.fontId} onChange={(e) => setOverrides({ ...overrides, fontId: e.target.value })} className={inputClass}>
            {FONT_CHOICES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Text size: ${effectiveFont} pt`}>
          <div className="flex items-center gap-2">
            <input type="range" min={7} max={18} step={0.5} value={effectiveFont} onChange={(e) => setFontSize(Number(e.target.value))} aria-label="Text size in points" className="w-full accent-primary" />
            {fontSize !== null && <button onClick={() => setFontSize(null)} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Reset</button>}
          </div>
        </Field>
        <Field label={`Line spacing: ${(overrides.lineHeight ?? theme.lineHeight).toFixed(2)}`}>
          <div className="flex items-center gap-2">
            <input type="range" min={1} max={2.4} step={0.05} value={overrides.lineHeight ?? theme.lineHeight} onChange={(e) => setOverrides({ ...overrides, lineHeight: Number(e.target.value) })} aria-label="Line spacing" className="w-full accent-primary" />
            {overrides.lineHeight !== null && <button onClick={() => setOverrides({ ...overrides, lineHeight: null })} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Reset</button>}
          </div>
        </Field>
        <Field label="Accent colour">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Accent colour">
            {ACCENTS.map((c) => (
              <button key={c} onClick={() => setOverrides({ ...overrides, accent: c })} aria-label={`#${c}`} aria-pressed={overrides.accent === c} className={cn("h-6 w-6 rounded-full border-2", overrides.accent === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: `#${c}` }} />
            ))}
            <input type="color" value={`#${overrides.accent ?? theme.accent}`.toLowerCase()} onChange={(e) => setOverrides({ ...overrides, accent: e.target.value.slice(1).toUpperCase() })} aria-label="Custom accent colour" className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent p-0" />
            {overrides.accent && <button onClick={() => setOverrides({ ...overrides, accent: null })} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Reset</button>}
          </div>
        </Field>
      </div>
    </div>
  );

  const pagePanel = (
    <div className="space-y-3 overflow-auto p-4">
      <PageSettingsPanel page={page} onChange={setPage} />
      {wideTable && page.orientation === "portrait" && (
        <p className="text-xs text-muted-foreground">
          This table is wide.{" "}
          <button onClick={() => setPage({ ...page, orientation: "landscape" })} className="underline underline-offset-2 hover:text-foreground">Switch to landscape</button>
        </p>
      )}
    </div>
  );

  const extrasPanel = (
    <div className="space-y-5 overflow-auto p-4">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Document details</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title (header variable {title} and PDF properties)">
            <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder={metaTitle} className={inputClass} />
          </Field>
          <Field label="Author">
            <input value={author} onChange={(e) => setAuthor(e.target.value)} className={inputClass} />
          </Field>
        </div>
      </section>
      <section className="space-y-3">
        <Check label="Add a cover page" checked={cover.enabled} onChange={(enabled) => setCover({ ...cover, enabled })} />
        {cover.enabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cover title">
              <input value={cover.title} onChange={(e) => setCover({ ...cover, title: e.target.value })} placeholder={metaTitle} className={inputClass} />
            </Field>
            <Field label="Subtitle">
              <input value={cover.subtitle} onChange={(e) => setCover({ ...cover, subtitle: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Author">
              <input value={cover.author} onChange={(e) => setCover({ ...cover, author: e.target.value })} placeholder={author} className={inputClass} />
            </Field>
            <Field label="Date">
              <input value={cover.date} onChange={(e) => setCover({ ...cover, date: e.target.value })} className={inputClass} />
            </Field>
            <p className="text-xs text-muted-foreground sm:col-span-2">The cover has no header, footer or page number, and numbering starts on the next page.</p>
          </div>
        )}
      </section>
      <section className="space-y-3">
        <Check label="Add a table of contents" checked={toc.enabled} onChange={(enabled) => setToc({ ...toc, enabled })} />
        {toc.enabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Heading">
              <input value={toc.title} onChange={(e) => setToc({ ...toc, title: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Include headings down to">
              <select value={toc.maxLevel} onChange={(e) => setToc({ ...toc, maxLevel: Number(e.target.value) as TocOptions["maxLevel"] })} className={inputClass}>
                <option value={1}>Level 1 (#)</option>
                <option value={2}>Level 2 (##)</option>
                <option value={3}>Level 3 (###)</option>
              </select>
            </Field>
            <p className="text-xs text-muted-foreground sm:col-span-2">Built from your headings, with the real page numbers.</p>
          </div>
        )}
      </section>
    </div>
  );

  const watermarkPanel = (
    <div className="space-y-3 overflow-auto p-4">
      <Check label="Add a text watermark to every page" checked={watermark.enabled} onChange={(enabled) => setWatermark({ ...watermark, enabled })} />
      {watermark.enabled && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Text">
            <input value={watermark.text} onChange={(e) => setWatermark({ ...watermark, text: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Colour">
            <input type="color" value={`#${watermark.color}`.toLowerCase()} onChange={(e) => setWatermark({ ...watermark, color: e.target.value.slice(1).toUpperCase() })} className="h-9 w-full cursor-pointer rounded-lg border border-border bg-background" />
          </Field>
          <Field label={`Opacity: ${Math.round(watermark.opacity * 100)}%`}>
            <input type="range" min={0.03} max={0.6} step={0.01} value={watermark.opacity} onChange={(e) => setWatermark({ ...watermark, opacity: Number(e.target.value) })} className="w-full accent-primary" />
          </Field>
          <Field label={`Angle: ${watermark.angle}°`}>
            <input type="range" min={0} max={90} step={5} value={watermark.angle} onChange={(e) => setWatermark({ ...watermark, angle: Number(e.target.value) })} className="w-full accent-primary" />
          </Field>
          <Field label={`Size: ${Math.round(watermark.size * 100)}% of page width`}>
            <input type="range" min={0.05} max={0.3} step={0.01} value={watermark.size} onChange={(e) => setWatermark({ ...watermark, size: Number(e.target.value) })} className="w-full accent-primary" />
          </Field>
          <div className="flex flex-wrap items-end gap-1.5 sm:col-span-2">
            {["DRAFT", "CONFIDENTIAL", "SAMPLE", "COPY", "PAID", "DO NOT COPY"].map((w) => (
              <button key={w} onClick={() => setWatermark({ ...watermark, text: w })} className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-primary">
                {w}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const body = panel === "content" ? contentPanel : panel === "style" ? stylePanel : panel === "page" ? pagePanel : panel === "extras" ? extrasPanel : watermarkPanel;

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <Workspace
        toolbar={toolbar}
        status={
          <>
            <span className="font-medium text-foreground">{pages > 0 ? `${pages} page${pages === 1 ? "" : "s"}` : bodyHtml ? "Laying out…" : "Nothing to show yet"}</span>
            <span>
              {theme.name} · {page.size.toUpperCase()} {page.orientation}
            </span>
            {pages > 60 && <span className="text-amber-600 dark:text-amber-400">Long document — building the PDF can take a while</span>}
            <span>Download PDF makes image pages; Print / Save as PDF keeps selectable text</span>
          </>
        }
      >
        <SplitPane
          initial={46}
          left={
            <Pane title={tabs} className="[&>header]:py-1">
              {body ?? <div className="p-4 text-sm text-muted-foreground">Nothing loaded.</div>}
            </Pane>
          }
          right={
            <Pane title={<span>Page preview {pages > 0 && <span className="font-normal">— {pages} page{pages === 1 ? "" : "s"}</span>}</span>}>
              <div className="h-full overflow-auto bg-muted/30 p-3">
                <DocPreview html={composed?.html ?? bodyHtml} theme={theme} page={page} layout={composed?.layout ?? null} fontSizePt={fontSize ?? undefined} headerFooter meta={meta} coverPages={composed?.coverPages ?? 0} watermarkUrl={watermark.enabled ? watermarkUrl : null} />
              </div>
            </Pane>
          }
        />
      </Workspace>
      <ToolHistoryList ref={historyRef} toolSlug="pdf-maker" />
    </div>
  );
}

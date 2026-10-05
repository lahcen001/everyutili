"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Copy, Download, FileUp, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SlidePreview } from "@/components/tools/document/SlidePreview";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import {
  SAMPLE_DECK,
  THEMES,
  buildPptx,
  newSlide,
  parseSlides,
  type AspectRatio,
  type SlideDraft,
  type SlideLayout,
} from "@/lib/office/pptx";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/downloadBlob";
import { cn } from "@/lib/utils";

const LAYOUTS: { id: SlideLayout; label: string }[] = [
  { id: "title", label: "Title" },
  { id: "section", label: "Section" },
  { id: "content", label: "Content" },
];

export default function PowerPointMaker() {
  useTrackTool("powerpoint-maker");
  const [themeId, setThemeId] = React.useState(THEMES[0].id);
  const [ratio, setRatio] = React.useState<AspectRatio>("16:9");
  const [slides, setSlides] = React.useState<SlideDraft[]>(() => SAMPLE_DECK.map((s) => ({ ...s })));
  const [selectedId, setSelectedId] = React.useState(SAMPLE_DECK[0].id);
  const [importText, setImportText] = React.useState("");
  const [isBuilding, setIsBuilding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const selectedIndex = Math.max(0, slides.findIndex((s) => s.id === selectedId));
  const selected = slides[selectedIndex];

  const updateSelected = (patch: Partial<SlideDraft>) => {
    setSlides((prev) => prev.map((s) => (s.id === selected?.id ? { ...s, ...patch } : s)));
  };

  const addSlide = () => {
    const slide = newSlide("content");
    setSlides((prev) => {
      const next = [...prev];
      next.splice(selectedIndex + 1, 0, slide);
      return next;
    });
    setSelectedId(slide.id);
  };

  const duplicateSlide = () => {
    if (!selected) return;
    const copy = { ...selected, id: crypto.randomUUID() };
    setSlides((prev) => {
      const next = [...prev];
      next.splice(selectedIndex + 1, 0, copy);
      return next;
    });
    setSelectedId(copy.id);
  };

  const deleteSlide = () => {
    if (slides.length <= 1) return;
    const remaining = slides.filter((s) => s.id !== selected.id);
    setSlides(remaining);
    setSelectedId(remaining[Math.min(selectedIndex, remaining.length - 1)].id);
  };

  const moveSlide = (direction: -1 | 1) => {
    const target = selectedIndex + direction;
    if (target < 0 || target >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      [next[selectedIndex], next[target]] = [next[target], next[selectedIndex]];
      return next;
    });
  };

  const importSlides = () => {
    const parsed = parseSlides(importText);
    if (parsed.length === 0) {
      setError("Nothing to import — add some text or Markdown first.");
      return;
    }
    setError(null);
    setSlides(parsed);
    setSelectedId(parsed[0].id);
  };

  const handleFile = async (file: File) => {
    setImportText(await file.text());
    setError(null);
  };

  const download = async () => {
    setIsBuilding(true);
    setError(null);
    try {
      const blob = await buildPptx(slides, theme, ratio);
      const fileName = "presentation.pptx";
      downloadBlob(blob, fileName);
      await saveToolResult("powerpoint-maker", {
        title: fileName,
        summary: `${slides.length} slide${slides.length === 1 ? "" : "s"} · ${theme.name} · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the presentation.");
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Choose a template</p>
          <div className="flex gap-1" role="group" aria-label="Slide size">
            {(["16:9", "4:3"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRatio(r)}
                aria-pressed={ratio === r}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  ratio === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setThemeId(t.id)}
              aria-pressed={themeId === t.id}
              aria-label={`${t.name} template`}
              className={cn(
                "space-y-1.5 rounded-lg border p-1.5 text-left transition-colors",
                themeId === t.id ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
              )}
            >
              <div className="pointer-events-none">
                <SlidePreview slide={{ id: t.id, layout: "content", title: "Title", body: "Point one\nPoint two" }} theme={t} ratio="16:9" />
              </div>
              <p className="px-1 text-xs font-medium">{t.name}</p>
            </button>
          ))}
        </div>
      </Card>

      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">Import from Markdown or plain text</summary>
        <div className="mt-3 space-y-2">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"# My Talk\n\n## Agenda\n- First point\n- Second point\n\nHeadings start new slides. Without headings, blank lines separate slides."}
            spellCheck={false}
            className="h-40 w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={importSlides} disabled={importText.trim().length === 0}>
              Replace slides
            </Button>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              <FileUp className="h-3.5 w-3.5" /> Upload .md or .txt
              <input
                type="file"
                accept=".md,.txt,text/markdown,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </details>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[180px_1fr]">
        <Card className="max-h-[560px] space-y-2 overflow-y-auto p-2">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => setSelectedId(slide.id)}
              aria-label={`Slide ${i + 1}: ${slide.title || "untitled"}`}
              aria-current={slide.id === selected?.id}
              className={cn(
                "block w-full rounded-md border p-1 text-left transition-colors",
                slide.id === selected?.id ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
              )}
            >
              <div className="pointer-events-none">
                <SlidePreview slide={slide} theme={theme} ratio={ratio} />
              </div>
              <p className="mt-1 truncate px-1 text-[11px] text-muted-foreground">
                {i + 1}. {slide.title || "Untitled"}
              </p>
            </button>
          ))}
          <Button size="sm" variant="outline" className="w-full" onClick={addSlide}>
            <Plus className="h-3.5 w-3.5" /> Add slide
          </Button>
        </Card>

        {selected && (
          <Card className="space-y-4 p-4">
            <div className="overflow-hidden rounded-lg border border-border shadow-sm">
              <SlidePreview slide={selected} theme={theme} ratio={ratio} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1" role="group" aria-label="Slide layout">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => updateSelected({ layout: l.id })}
                    aria-pressed={selected.layout === l.id}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      selected.layout === l.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex gap-1">
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => moveSlide(-1)} disabled={selectedIndex === 0} aria-label="Move slide up">
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => moveSlide(1)} disabled={selectedIndex === slides.length - 1} aria-label="Move slide down">
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={duplicateSlide} aria-label="Duplicate slide">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={deleteSlide} disabled={slides.length <= 1} aria-label="Delete slide">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="slide-title" className="text-xs font-medium text-muted-foreground">
                Title
              </label>
              <input
                id="slide-title"
                value={selected.title}
                onChange={(e) => updateSelected({ title: e.target.value })}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="slide-body" className="text-xs font-medium text-muted-foreground">
                {selected.layout === "content" ? "Bullet points (one per line)" : "Subtitle (one line per row)"}
              </label>
              <textarea
                id="slide-body"
                value={selected.body}
                onChange={(e) => updateSelected({ body: e.target.value })}
                className="h-32 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </Card>
        )}
      </div>

      <Button onClick={download} disabled={isBuilding}>
        {isBuilding ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Creating…
          </>
        ) : (
          <>
            <Download className="h-4 w-4" /> Download .pptx ({slides.length} slide{slides.length === 1 ? "" : "s"})
          </>
        )}
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="powerpoint-maker" />
    </div>
  );
}

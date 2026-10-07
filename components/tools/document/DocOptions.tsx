"use client";

import * as React from "react";

import { DOC_THEMES, type DocTheme } from "@/lib/office/docThemes";
import { PAPER_MM, type PageSettings, type PaperSize, type TextAlign } from "@/lib/office/pageSettings";
import { cn } from "@/lib/utils";

export function ThemePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Document style">
      {DOC_THEMES.map((t: DocTheme) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-lg border p-2.5 text-left transition-colors",
            value === t.id ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
          )}
        >
          <div className="rounded bg-white px-2 py-1.5">
            <p style={{ fontFamily: t.cssFont, color: `#${t.headingColor}`, borderBottom: `2px solid #${t.accent}` }} className="text-sm font-bold leading-tight">
              Heading
            </p>
            <p style={{ fontFamily: t.cssFont, color: `#${t.text}` }} className="mt-1 text-[10px] leading-tight">
              Body text sample
            </p>
          </div>
          <p className="mt-1.5 text-xs font-medium">{t.name}</p>
          <p className="text-[11px] text-muted-foreground">{t.description}</p>
        </button>
      ))}
    </div>
  );
}

const ALIGNS: { id: TextAlign; label: string }[] = [
  { id: "left", label: "L" },
  { id: "center", label: "C" },
  { id: "right", label: "R" },
];

const MARGINS = [
  { label: "Narrow", mm: 12.7 },
  { label: "Normal", mm: 25.4 },
  { label: "Wide", mm: 38.1 },
];

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.id)}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn("px-3 py-1.5 text-sm font-medium transition-colors", value === o.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PageSettingsPanel({ page, onChange }: { page: PageSettings; onChange: (next: PageSettings) => void }) {
  const set = (patch: Partial<PageSettings>) => onChange({ ...page, ...patch });
  const marginPreset = MARGINS.find((m) => Math.abs(m.mm - page.marginMm) < 0.2);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Paper</p>
          <Segmented<PaperSize>
            label="Paper size"
            value={page.size}
            onChange={(size) => set({ size })}
            options={(Object.keys(PAPER_MM) as PaperSize[]).map((id) => ({ id, label: PAPER_MM[id].label }))}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Orientation</p>
          <Segmented
            label="Orientation"
            value={page.orientation}
            onChange={(orientation) => set({ orientation })}
            options={[
              { id: "portrait", label: "Portrait" },
              { id: "landscape", label: "Landscape" },
            ]}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Margins</p>
          <Segmented<string>
            label="Margins"
            value={marginPreset?.label ?? "Custom"}
            onChange={(label) => set({ marginMm: MARGINS.find((m) => m.label === label)?.mm ?? page.marginMm })}
            options={[...MARGINS.map((m) => ({ id: m.label, label: m.label })), ...(marginPreset ? [] : [{ id: "Custom", label: "Custom" }])]}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Header (every page)</span>
          <div className="flex gap-2">
            <input value={page.headerText} onChange={(e) => set({ headerText: e.target.value })} aria-label="Header text" placeholder="{title}" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
            <Segmented<TextAlign> label="Header alignment" value={page.headerAlign} onChange={(headerAlign) => set({ headerAlign })} options={ALIGNS} />
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Footer (every page)</span>
          <div className="flex gap-2">
            <input value={page.footerText} onChange={(e) => set({ footerText: e.target.value })} aria-label="Footer text" placeholder="Page {page} of {pages}" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
            <Segmented<TextAlign> label="Footer alignment" value={page.footerAlign} onChange={(footerAlign) => set({ footerAlign })} options={ALIGNS} />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Variables: {"{page}"} {"{pages}"} {"{title}"} {"{author}"} {"{date}"}</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={page.pageNumbers} onChange={(e) => set({ pageNumbers: e.target.checked })} className="h-4 w-4 rounded border-border" />
        Show page numbers
      </label>
    </div>
  );
}

"use client";

import * as React from "react";
import { Download, Shapes } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <!-- A simple circle -->
  <title>Sample Icon</title>
  <desc>An example SVG for the optimizer</desc>
  <metadata>Created by EveryUtili</metadata>
  <circle id="unusedCircle" cx="50.123456" cy="50.654321" r="40.000001" fill="#6366f1" />
</svg>`;

interface OptimizeOptions {
  removeComments: boolean;
  removeMetadata: boolean;
  cleanUnusedIds: boolean;
  roundPrecision: boolean;
  precision: number;
}

const DEFAULT_OPTIONS: OptimizeOptions = {
  removeComments: true,
  removeMetadata: true,
  cleanUnusedIds: true,
  roundPrecision: true,
  precision: 2,
};

function byteSize(text: string): number {
  return new Blob([text]).size;
}

function removeComments(svg: string): string {
  return svg.replace(/<!--[\s\S]*?-->/g, "");
}

function removeMetadataElements(doc: Document): void {
  const selectors = ["metadata", "title", "desc"];
  for (const selector of selectors) {
    doc.querySelectorAll(selector).forEach((el) => el.remove());
  }
}

function collectReferencedIds(doc: Document): Set<string> {
  const referenced = new Set<string>();
  const attrPattern = /url\(#([^)]+)\)/g;

  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const value = attr.value;
      let match: RegExpExecArray | null;
      attrPattern.lastIndex = 0;
      while ((match = attrPattern.exec(value)) !== null) {
        referenced.add(match[1]);
      }
      if (
        (attr.name === "href" || attr.name === "xlink:href") &&
        value.startsWith("#")
      ) {
        referenced.add(value.slice(1));
      }
    }
  });

  return referenced;
}

function cleanUnusedIdAttributes(doc: Document): void {
  const referenced = collectReferencedIds(doc);
  doc.querySelectorAll("[id]").forEach((el) => {
    const id = el.getAttribute("id");
    if (id && !referenced.has(id)) {
      el.removeAttribute("id");
    }
  });
}

const NUMBER_PATTERN = /-?\d+\.\d+(?:e-?\d+)?/gi;

function roundNumbersInAttribute(value: string, precision: number): string {
  return value.replace(NUMBER_PATTERN, (match) => {
    const rounded = parseFloat(parseFloat(match).toFixed(precision));
    return String(rounded);
  });
}

const NUMERIC_ATTRS = [
  "d",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "points",
  "transform",
  "stroke-width",
  "offset",
];

function roundPrecisionInDoc(doc: Document, precision: number): void {
  doc.querySelectorAll("*").forEach((el) => {
    for (const attrName of NUMERIC_ATTRS) {
      if (el.hasAttribute(attrName)) {
        const value = el.getAttribute(attrName);
        if (value !== null) {
          el.setAttribute(attrName, roundNumbersInAttribute(value, precision));
        }
      }
    }
  });
}

function optimizeSvg(rawSvg: string, options: OptimizeOptions): { output: string; error: string | null } {
  const trimmed = rawSvg.trim();
  if (!trimmed) return { output: "", error: null };

  let working = trimmed;
  if (options.removeComments) {
    working = removeComments(working);
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(working, "image/svg+xml");
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      return { output: "", error: "Could not parse this SVG markup." };
    }

    if (options.removeMetadata) removeMetadataElements(doc);
    if (options.cleanUnusedIds) cleanUnusedIdAttributes(doc);
    if (options.roundPrecision) roundPrecisionInDoc(doc, options.precision);

    const serializer = new XMLSerializer();
    const svgRoot = doc.documentElement;
    return { output: serializer.serializeToString(svgRoot), error: null };
  } catch {
    return { output: "", error: "Could not parse this SVG markup." };
  }
}

export default function SvgOptimizer() {
  useTrackTool("svg-optimizer");
  const [input, setInput] = React.useState(SAMPLE_SVG);
  const [options, setOptions] = React.useState<OptimizeOptions>(DEFAULT_OPTIONS);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const { output, error } = React.useMemo(() => optimizeSvg(input, options), [input, options]);

  const originalSize = React.useMemo(() => byteSize(input), [input]);
  const optimizedSize = React.useMemo(() => byteSize(output), [output]);
  const savedPct =
    originalSize > 0 && output ? Math.max(0, Math.round((1 - optimizedSize / originalSize) * 100)) : 0;

  const handleFiles = (files: File[]) => {
    const file = files.find((f) => f.name.endsWith(".svg") || f.type === "image/svg+xml");
    if (!file) return;
    file.text().then(setInput);
  };

  // Picks up a "Send to..." handoff from another tool via ?from=<id>,
  // feeding it through the same path as a manual drop.
  useIncomingHandoff((file) => handleFiles([file]));

  const toggleOption = (key: keyof Omit<OptimizeOptions, "precision">) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDownload = () => {
    if (!output) return;
    const blob = new Blob([output], { type: "image/svg+xml" });
    downloadBlob(blob, "optimized.svg");
  };

  const handleSave = async () => {
    if (!output) return;
    await saveToolResult("svg-optimizer", {
      title: `Optimized: -${savedPct}%`,
      summary: `${formatBytes(originalSize)} → ${formatBytes(optimizedSize)}`,
      data: output,
    });
    historyRef.current?.refresh();
  };

  const handleRestore = (item: ToolHistoryItem) => {
    if (item.data) setInput(item.data);
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={8}
          placeholder="Paste SVG markup here…"
          spellCheck={false}
          className="w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <DropZone
          onFiles={handleFiles}
          accept=".svg,image/svg+xml"
          multiple={false}
          label="Drag & drop an .svg file here, or click to browse"
          hint="Or paste raw SVG markup into the box above"
        />
      </Card>

      <Card className="flex flex-wrap gap-4 p-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={options.removeComments}
            onChange={() => toggleOption("removeComments")}
            className="h-4 w-4 rounded border-border"
          />
          Remove comments
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={options.removeMetadata}
            onChange={() => toggleOption("removeMetadata")}
            className="h-4 w-4 rounded border-border"
          />
          Remove metadata, title &amp; desc
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={options.cleanUnusedIds}
            onChange={() => toggleOption("cleanUnusedIds")}
            className="h-4 w-4 rounded border-border"
          />
          Clean unused IDs
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={options.roundPrecision}
            onChange={() => toggleOption("roundPrecision")}
            className="h-4 w-4 rounded border-border"
          />
          Round precision (2 decimals)
        </label>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && output && (
        <>
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-sm text-muted-foreground">
              {formatBytes(originalSize)} → {formatBytes(optimizedSize)}
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Saved {savedPct}%
            </span>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="space-y-2 p-4">
              <p className="text-xs font-medium text-muted-foreground">Original</p>
              <div className="flex max-h-64 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/20 p-3">
                <div
                  className="max-h-full max-w-full [&_svg]:max-h-56 [&_svg]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: input }}
                />
              </div>
            </Card>
            <Card className="space-y-2 p-4">
              <p className="text-xs font-medium text-muted-foreground">Optimized</p>
              <div className="flex max-h-64 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/20 p-3">
                <div
                  className="max-h-full max-w-full [&_svg]:max-h-56 [&_svg]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: output }}
                />
              </div>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton value={output} variant="secondary">
              <Shapes className="h-4 w-4" /> Copy optimized SVG
            </CopyButton>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4" /> Download .svg
            </Button>
            <Button variant="outline" onClick={handleSave}>
              Save result
            </Button>
          </div>
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="svg-optimizer" onRestore={handleRestore} />
    </div>
  );
}

"use client";

import * as React from "react";
import { Eraser, Save } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const INVISIBLE_CHARS: Array<{ code: number; name: string }> = [
  { code: 0x00ad, name: "Soft hyphen" },
  { code: 0x180e, name: "Mongolian vowel separator" },
  { code: 0x200b, name: "Zero-width space" },
  { code: 0x200c, name: "Zero-width non-joiner" },
  { code: 0x200d, name: "Zero-width joiner" },
  { code: 0x200e, name: "Left-to-right mark" },
  { code: 0x200f, name: "Right-to-left mark" },
  { code: 0x202a, name: "Left-to-right embedding" },
  { code: 0x202b, name: "Right-to-left embedding" },
  { code: 0x202c, name: "Pop directional formatting" },
  { code: 0x202d, name: "Left-to-right override" },
  { code: 0x202e, name: "Right-to-left override" },
  { code: 0x2060, name: "Word joiner" },
  { code: 0x2066, name: "Left-to-right isolate" },
  { code: 0x2067, name: "Right-to-left isolate" },
  { code: 0x2068, name: "First strong isolate" },
  { code: 0x2069, name: "Pop directional isolate" },
  { code: 0xfeff, name: "Zero-width no-break space (BOM)" },
];

const CHAR_NAME_BY_CODE = new Map(INVISIBLE_CHARS.map((c) => [c.code, c.name]));
const INVISIBLE_CHAR_PATTERN = new RegExp(
  `[${INVISIBLE_CHARS.map((c) => `\\u${c.code.toString(16).padStart(4, "0")}`).join("")}]`,
  "g"
);

interface ScanResult {
  cleaned: string;
  positions: number[];
  charLabel: string;
}

function scanAndClean(text: string): ScanResult {
  const positions: number[] = [];
  const seenCodes = new Set<number>();
  const pattern = new RegExp(INVISIBLE_CHAR_PATTERN);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    positions.push(match.index);
    seenCodes.add(match[0].codePointAt(0) ?? 0);
  }
  const cleaned = text.replace(INVISIBLE_CHAR_PATTERN, "");
  const labels = Array.from(seenCodes).map(
    (code) => CHAR_NAME_BY_CODE.get(code) ?? `U+${code.toString(16).toUpperCase()}`
  );
  return { cleaned, positions, charLabel: labels.join(", ") };
}

export default function ZeroWidthRemover() {
  useTrackTool("zero-width-remover");
  const [input, setInput] = React.useState("");
  const [output, setOutput] = React.useState("");
  const [positions, setPositions] = React.useState<number[]>([]);
  const [charLabel, setCharLabel] = React.useState("");
  const [hasCleaned, setHasCleaned] = React.useState(false);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const clean = async () => {
    const { cleaned, positions: found, charLabel: labels } = scanAndClean(input);
    setOutput(cleaned);
    setPositions(found);
    setCharLabel(labels);
    setHasCleaned(true);
    await saveToolResult("zero-width-remover", {
      title: `${found.length.toLocaleString()} character${found.length === 1 ? "" : "s"} removed`,
      summary: `${cleaned.length.toLocaleString()} characters in output`,
      data: cleaned,
    });
    historyRef.current?.refresh();
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (item.data) setInput(item.data);
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Input text</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
            placeholder="Paste text that may contain invisible or zero-width characters…"
            className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        <Button size="sm" onClick={clean} disabled={!input}>
          <Eraser className="h-3.5 w-3.5" /> Remove invisible characters
        </Button>
      </Card>

      {hasCleaned && (
        <Card className="space-y-1 p-4 text-sm">
          {positions.length === 0 ? (
            <p className="text-muted-foreground">No invisible characters found.</p>
          ) : (
            <>
              <p>
                Found <span className="font-medium">{positions.length.toLocaleString()}</span> invisible
                character{positions.length === 1 ? "" : "s"} at position
                {positions.length === 1 ? "" : "s"}:{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  {positions.slice(0, 50).join(", ")}
                  {positions.length > 50 ? `, +${positions.length - 50} more` : ""}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">Types found: {charLabel}</p>
            </>
          )}
        </Card>
      )}

      <Card className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Cleaned output</p>
          <CopyButton value={output} size="sm" variant="outline" disabled={!output} />
        </div>
        <div className="min-h-[120px] whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-3 text-sm">
          {output || <span className="text-muted-foreground">Cleaned text will appear here.</span>}
        </div>
        <Button size="sm" variant="outline" onClick={clean} disabled={!input}>
          <Save className="h-3.5 w-3.5" /> Save result
        </Button>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="zero-width-remover" onRestore={restoreResult} />
    </div>
  );
}

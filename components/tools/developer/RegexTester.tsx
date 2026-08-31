"use client";

import * as React from "react";
import { Regex, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const FLAG_OPTIONS = [
  { flag: "g", label: "Global" },
  { flag: "i", label: "Ignore case" },
  { flag: "m", label: "Multiline" },
  { flag: "s", label: "Dot-all" },
] as const;

interface MatchResult {
  matches: RegExpMatchArray[];
  error: string | null;
}

function runRegex(pattern: string, flags: string, text: string): MatchResult {
  if (!pattern) return { matches: [], error: null };
  try {
    const effectiveFlags = flags.includes("g") ? flags : `${flags}g`;
    const regex = new RegExp(pattern, effectiveFlags);
    const matches = Array.from(text.matchAll(regex));
    return { matches, error: null };
  } catch (e) {
    return { matches: [], error: e instanceof Error ? e.message : "Invalid regular expression" };
  }
}

const DATA_PREFIX_PATTERN = "Pattern: ";
const DATA_PREFIX_FLAGS = "Flags: ";
const DATA_PREFIX_TEXT_MARKER = "--- Test string ---";

function serializeRegexState(pattern: string, flags: string, text: string): string {
  return `${DATA_PREFIX_PATTERN}${pattern}\n${DATA_PREFIX_FLAGS}${flags}\n${DATA_PREFIX_TEXT_MARKER}\n${text}`;
}

function parseRegexState(data: string): { pattern: string; flags: string; text: string } | null {
  const markerIndex = data.indexOf(DATA_PREFIX_TEXT_MARKER);
  if (markerIndex === -1) return null;
  const head = data.slice(0, markerIndex).split("\n").filter(Boolean);
  const patternLine = head.find((l) => l.startsWith(DATA_PREFIX_PATTERN));
  const flagsLine = head.find((l) => l.startsWith(DATA_PREFIX_FLAGS));
  if (!patternLine || !flagsLine) return null;
  const text = data.slice(markerIndex + DATA_PREFIX_TEXT_MARKER.length).replace(/^\n/, "");
  return {
    pattern: patternLine.slice(DATA_PREFIX_PATTERN.length),
    flags: flagsLine.slice(DATA_PREFIX_FLAGS.length),
    text,
  };
}

function highlightText(text: string, matches: RegExpMatchArray[]) {
  if (matches.length === 0) return [text];
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  matches.forEach((match, i) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (start > lastIndex) segments.push(text.slice(lastIndex, start));
    segments.push(
      <mark key={i} className="rounded bg-primary/25 px-0.5 text-foreground">
        {match[0]}
      </mark>
    );
    lastIndex = end;
  });
  if (lastIndex < text.length) segments.push(text.slice(lastIndex));
  return segments;
}

export default function RegexTester() {
  useTrackTool("regex-tester");
  const [pattern, setPattern] = React.useState("\\b[\\w.-]+@[\\w.-]+\\.\\w+\\b");
  const [flags, setFlags] = React.useState("gi");
  const [text, setText] = React.useState(
    "Contact us at hello@everyutili.com or support@example.com for help."
  );
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const { matches, error } = React.useMemo(() => runRegex(pattern, flags, text), [pattern, flags, text]);
  const highlighted = React.useMemo(() => highlightText(text, matches), [text, matches]);

  const toggleFlag = (flag: string) => {
    setFlags((prev) => (prev.includes(flag) ? prev.replace(flag, "") : prev + flag));
  };

  const saveResult = async () => {
    if (!pattern || error) return;
    await saveToolResult("regex-tester", {
      title: `/${pattern}/${flags}`,
      summary: `${matches.length} match${matches.length === 1 ? "" : "es"}`,
      data: serializeRegexState(pattern, flags, text),
    });
    historyRef.current?.refresh();
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (!item.data) return;
    const parsed = parseRegexState(item.data);
    if (!parsed) return;
    setPattern(parsed.pattern);
    setFlags(parsed.flags);
    setText(parsed.text);
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Regular expression</span>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
            <span className="text-muted-foreground">/</span>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="flex-1 bg-transparent font-mono text-sm focus:outline-none"
              placeholder="pattern"
            />
            <span className="text-muted-foreground">/{flags}</span>
          </div>
        </label>

        <div className="flex flex-wrap gap-3">
          {FLAG_OPTIONS.map((opt) => (
            <label key={opt.flag} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={flags.includes(opt.flag)}
                onChange={() => toggleFlag(opt.flag)}
                className="h-4 w-4 accent-primary"
              />
              {opt.label} ({opt.flag})
            </label>
          ))}
        </div>

        <Button size="sm" variant="outline" onClick={saveResult} disabled={!pattern || !!error}>
          <Save className="h-3.5 w-3.5" /> Save result
        </Button>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Test string</p>
            <Badge variant={matches.length > 0 ? "success" : "outline"}>
              {matches.length} match{matches.length === 1 ? "" : "es"}
            </Badge>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Card>

        <Card className="space-y-2 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Regex className="h-4 w-4 text-muted-foreground" /> Highlighted matches
          </p>
          <div className="max-h-[240px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs">
            {highlighted}
          </div>
          {matches.length > 0 && (
            <div className="max-h-40 space-y-1 overflow-auto">
              {matches.map((match, i) => (
                <div key={i} className="rounded-lg border border-border px-2 py-1 font-mono text-xs">
                  <span className="text-muted-foreground">Match {i + 1}: </span>
                  {match[0]}
                  {match.length > 1 && (
                    <span className="text-muted-foreground"> (groups: {match.slice(1).join(", ")})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ToolHistoryList ref={historyRef} toolSlug="regex-tester" onRestore={restoreResult} />
    </div>
  );
}

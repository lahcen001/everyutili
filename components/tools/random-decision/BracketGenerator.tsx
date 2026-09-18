"use client";

import * as React from "react";
import { Trophy, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const BYE = "— Bye —";

interface Matchup {
  a: string;
  b: string;
}

function parseEntries(input: string): string[] {
  return input
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Pads the entrant list up to the next power of two with byes, so round 1
 * always has clean pairs — entrants matched against a bye automatically
 * advance, the standard convention for a non-power-of-two bracket. Byes are
 * spread one per match slot (up to the bye count) rather than appended to
 * the end, so two byes never land in the same match — a bye only has
 * meaning paired against a real entrant.
 */
function buildRoundOne(entries: string[]): Matchup[] {
  const shuffled = shuffle(entries);
  let bracketSize = 1;
  while (bracketSize < shuffled.length) bracketSize *= 2;
  const byeCount = bracketSize - shuffled.length;
  const matchCount = bracketSize / 2;

  const matchups: Matchup[] = [];
  let entrantIndex = 0;
  for (let m = 0; m < matchCount; m++) {
    const a = shuffled[entrantIndex++];
    const b = m < byeCount ? BYE : shuffled[entrantIndex++];
    matchups.push({ a, b });
  }
  return matchups;
}

function formatBracketAsText(round: Matchup[]): string {
  return round.map((m, i) => `Match ${i + 1}: ${m.a} vs ${m.b}`).join("\n");
}

export default function BracketGenerator() {
  useTrackTool("bracket-generator");
  const [input, setInput] = React.useState(
    "Team Alpha\nTeam Bravo\nTeam Charlie\nTeam Delta\nTeam Echo\nTeam Foxtrot"
  );
  const [roundOne, setRoundOne] = React.useState<Matchup[] | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const entries = React.useMemo(() => parseEntries(input), [input]);
  const byeCount = roundOne ? roundOne.flatMap((m) => [m.a, m.b]).filter((e) => e === BYE).length : 0;

  const generate = () => {
    setRoundOne(buildRoundOne(entries));
  };

  const handleSave = async () => {
    if (!roundOne) return;
    await saveToolResult("bracket-generator", {
      title: `${entries.length}-entrant bracket, round 1`,
      summary: formatBracketAsText(roundOne),
      data: input,
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
          <span className="text-sm font-medium">Entrants</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
            placeholder="One name or team per line…"
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          {entries.length} entrant{entries.length === 1 ? "" : "s"}
        </p>
        <Button onClick={generate} disabled={entries.length < 2}>
          <Trophy className="h-4 w-4" />
          Generate bracket
        </Button>
      </Card>

      {roundOne && (
        <Card className="space-y-3 p-4">
          <p className="text-sm font-medium">Round 1</p>
          <ol className="space-y-2">
            {roundOne.map((m, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
              >
                <span className="text-xs font-medium text-muted-foreground">Match {i + 1}</span>
                <span className="flex-1 text-center font-medium">
                  {m.a} <span className="text-muted-foreground">vs</span> {m.b}
                </span>
              </li>
            ))}
          </ol>
          {byeCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {byeCount} bye{byeCount === 1 ? "" : "s"} added to fill the bracket — entrants matched
              against a bye advance automatically.
            </p>
          )}
          <div className="flex gap-2">
            <CopyButton value={formatBracketAsText(roundOne)} size="sm" variant="outline" />
            <Button size="sm" variant="outline" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="bracket-generator" onRestore={restoreResult} />
    </div>
  );
}

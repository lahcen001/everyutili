"use client";

import * as React from "react";
import { Users, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/tool-shell/CopyButton";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

type SplitMode = "teamCount" | "teamSize";

function parseNames(input: string): string[] {
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

function splitIntoTeams(names: string[], mode: SplitMode, value: number): string[][] {
  const shuffled = shuffle(names);
  const teamCount =
    mode === "teamCount" ? Math.max(1, value) : Math.max(1, Math.ceil(shuffled.length / value));
  const teams: string[][] = Array.from({ length: teamCount }, () => []);
  shuffled.forEach((name, i) => {
    teams[i % teamCount].push(name);
  });
  return teams;
}

function formatTeamsAsText(teams: string[][]): string {
  return teams.map((team, i) => `Team ${i + 1}:\n${team.map((n) => `  ${n}`).join("\n")}`).join("\n\n");
}

export default function TeamGenerator() {
  useTrackTool("team-generator");
  const [input, setInput] = React.useState(
    "Alice\nBob\nCharlie\nDiana\nEthan\nFiona\nGeorge\nHannah"
  );
  const [mode, setMode] = React.useState<SplitMode>("teamCount");
  const [value, setValue] = React.useState(2);
  const [teams, setTeams] = React.useState<string[][] | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const names = React.useMemo(() => parseNames(input), [input]);

  const generate = () => {
    setTeams(splitIntoTeams(names, mode, value));
  };

  const handleSave = async () => {
    if (!teams) return;
    await saveToolResult("team-generator", {
      title: `${teams.length} teams from ${names.length} names`,
      summary: teams.map((t, i) => `Team ${i + 1}: ${t.join(", ")}`).join(" · "),
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
          <span className="text-sm font-medium">Names</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
            placeholder="One name per line…"
            className="w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <p className="text-xs text-muted-foreground">{names.length} name{names.length === 1 ? "" : "s"}</p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setMode("teamCount")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "teamCount" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              Number of teams
            </button>
            <button
              type="button"
              onClick={() => setMode("teamSize")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "teamSize" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              People per team
            </button>
          </div>
          <input
            type="number"
            min={1}
            max={names.length || 1}
            value={value}
            onChange={(e) => setValue(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <Button onClick={generate} disabled={names.length < 2}>
          <Users className="h-4 w-4" />
          Generate teams
        </Button>
      </Card>

      {teams && (
        <Card className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <p className="mb-2 text-sm font-semibold text-primary">Team {i + 1}</p>
                <ul className="space-y-1 text-sm">
                  {team.map((name, j) => (
                    <li key={j}>{name}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <CopyButton value={formatTeamsAsText(teams)} size="sm" variant="outline" />
            <Button size="sm" variant="outline" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="team-generator" onRestore={restoreResult} />
    </div>
  );
}

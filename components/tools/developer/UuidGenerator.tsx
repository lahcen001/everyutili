"use client";

import * as React from "react";
import { Download, Fingerprint, RefreshCw, Save } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatUuid, generateUuid, inspectUuid, type UuidFormat, type UuidVersion } from "@/lib/uuid";
import { cn } from "@/lib/utils";

const VERSIONS: { id: UuidVersion; label: string; hint: string }[] = [
  { id: "v4", label: "v4 (random)", hint: "Fully random. The default for most uses." },
  { id: "v7", label: "v7 (time-ordered)", hint: "Starts with a timestamp, so IDs sort by creation time — good for database keys." },
  { id: "v1", label: "v1 (timestamp)", hint: "Timestamp-based with a random node ID (no MAC address is used)." },
];
const FORMATS: { id: UuidFormat; label: string }[] = [
  { id: "standard", label: "Standard" },
  { id: "nohyphens", label: "No hyphens" },
  { id: "braces", label: "{Braces}" },
  { id: "urn", label: "urn:uuid:" },
  { id: "base64", label: "Base64url (22)" },
];
const selectClass = "h-9 rounded-lg border border-border bg-background px-2 text-sm";

export default function UuidGenerator() {
  useTrackTool("uuid-generator");
  const [count, setCount] = React.useState(5);
  const [version, setVersion] = React.useState<UuidVersion>("v4");
  const [format, setFormat] = React.useState<UuidFormat>("standard");
  const [uppercase, setUppercase] = React.useState(false);
  const [uuids, setUuids] = React.useState<string[]>(() => Array.from({ length: 5 }, () => generateUuid("v4")));
  const [check, setCheck] = React.useState("");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const regenerate = () => {
    const n = Math.min(Math.max(Math.floor(count) || 1, 1), 1000);
    const list = Array.from({ length: n }, () => generateUuid(version));
    setUuids(version === "v7" ? list.sort() : list);
  };

  const formatted = uuids.map((id) => formatUuid(id, format, uppercase && format !== "base64"));
  const allText = formatted.join("\n");
  const info = check.trim() ? inspectUuid(check) : null;

  const saveResult = async () => {
    if (formatted.length === 0) return;
    await saveToolResult("uuid-generator", { title: `${formatted.length} UUID${formatted.length === 1 ? "" : "s"} (${version})`, summary: FORMATS.find((f) => f.id === format)?.label ?? "", data: allText });
    historyRef.current?.refresh();
  };

  const restoreResult = (item: ToolHistoryItem) => {
    if (!item.data) return;
    setUuids(item.data.split("\n").filter(Boolean).map((l) => inspectUuid(l).normalized ?? l));
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Version</span>
            <select value={version} onChange={(e) => setVersion(e.target.value as UuidVersion)} className={cn(selectClass, "block")}>
              {VERSIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as UuidFormat)} className={cn(selectClass, "block")}>
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Count (max 1000)</span>
            <input type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} className="block h-9 w-24 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={uppercase} disabled={format === "base64"} onChange={(e) => setUppercase(e.target.checked)} className="h-4 w-4 accent-primary" />
            Uppercase
          </label>
          <Button className="ml-auto" onClick={regenerate}>
            <RefreshCw className="h-4 w-4" /> Generate
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{VERSIONS.find((v) => v.id === version)?.hint}</p>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Fingerprint className="h-4 w-4 text-muted-foreground" /> {formatted.length} UUIDs
          </p>
          <div className="flex gap-2">
            <CopyButton value={allText} size="sm" variant="outline">
              Copy all
            </CopyButton>
            <Button size="sm" variant="outline" onClick={() => downloadBlob(new Blob([allText], { type: "text/plain" }), "uuids.txt")} disabled={formatted.length === 0}>
              <Download className="h-3.5 w-3.5" /> .txt
            </Button>
            <Button size="sm" variant="outline" onClick={saveResult} disabled={formatted.length === 0}>
              <Save className="h-3.5 w-3.5" /> Save result
            </Button>
          </div>
        </div>
        <div className="max-h-96 space-y-1 overflow-auto rounded-lg border border-border bg-muted/20 p-3">
          {formatted.map((id, i) => (
            <div key={`${id}-${i}`} className="flex items-center justify-between gap-2 font-mono text-xs">
              <span className="truncate">{id}</span>
              <CopyButton value={id} size="sm" variant="ghost" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <p className="text-sm font-medium">Validate a UUID</p>
        <input value={check} onChange={(e) => setCheck(e.target.value)} placeholder="Paste a UUID (with or without hyphens, braces or urn:uuid:)" aria-label="UUID to validate" className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        {info && (
          <div role="status" className={cn("rounded-lg border px-3 py-2 text-sm", info.valid ? "border-border bg-muted/20" : "border-destructive/30 bg-destructive/10 text-destructive")}>
            {!info.valid ? (
              "Not a valid UUID — expected 32 hex digits (8-4-4-4-12)."
            ) : (
              <ul className="space-y-0.5">
                <li>
                  Valid UUID{info.nil ? " (the nil UUID)" : info.version ? `, version ${info.version}` : ""} · variant {info.variant}
                </li>
                {info.timestamp && !Number.isNaN(info.timestamp.getTime()) && <li>Created: {info.timestamp.toISOString()}</li>}
                <li className="font-mono text-xs">{info.normalized}</li>
              </ul>
            )}
          </div>
        )}
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="uuid-generator" onRestore={restoreResult} />
    </div>
  );
}

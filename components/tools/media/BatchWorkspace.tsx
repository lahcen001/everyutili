"use client";

import * as React from "react";
import { CheckCircle2, ImagePlus, Loader2, TriangleAlert, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { FileDropTarget } from "@/components/tool-shell/FileDropTarget";
import { EditorLayout } from "@/components/tools/shared/EditorLayout";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface BatchItem {
  id: string;
  name: string;
  size: number;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  thumbUrl?: string;
  resultSize?: number;
}

interface BatchWorkspaceProps {
  items: BatchItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onFiles: (files: File[]) => void;
  accept: string;
  dropLabel: string;
  dropHint: string;
  /** Preview of the selected file (before/after, etc.). */
  stage: React.ReactNode;
  sidebar: React.ReactNode;
  footer: React.ReactNode;
}

/** Drop zone first, then a workspace: file strip + big preview on the left, settings on the right. */
export function BatchWorkspace({ items, selectedId, onSelect, onRemove, onFiles, accept, dropLabel, dropHint, stage, sidebar, footer }: BatchWorkspaceProps) {
  const onFilesRef = React.useRef(onFiles);
  React.useEffect(() => {
    onFilesRef.current = onFiles;
  }, [onFiles]);

  // paste images from the clipboard (Ctrl/Cmd+V)
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length) onFilesRef.current(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  if (items.length === 0) {
    return (
      <DropZone
        onFiles={onFiles}
        accept={accept}
        label={dropLabel}
        hint={`${dropHint} · you can also paste an image with Ctrl+V`}
        className="py-20"
      />
    );
  }

  return (
    <FileDropTarget onFiles={onFiles} label="Drop to add more images">
      <EditorLayout
        stageToolbar={
          <div className="flex w-full items-center gap-2 overflow-x-auto py-0.5" role="listbox" aria-label="Files">
            {items.map((item) => (
              <div key={item.id} className="group relative shrink-0">
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedId === item.id}
                  onClick={() => onSelect(item.id)}
                  title={`${item.name} · ${formatBytes(item.size)}${item.resultSize !== undefined ? ` → ${formatBytes(item.resultSize)}` : ""}`}
                  className={cn(
                    "relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border-2 bg-muted transition-colors",
                    selectedId === item.id ? "border-primary" : "border-transparent hover:border-border"
                  )}
                >
                  {item.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                  ) : null}
                  <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background/90 shadow">
                    {item.status === "done" ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : item.status === "error" ? <TriangleAlert className="h-3 w-3 text-destructive" /> : <Loader2 className={cn("h-3 w-3 text-primary", item.status === "processing" && "animate-spin")} />}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remove ${item.name}`}
                  className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow group-hover:flex group-focus-within:flex"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="flex h-14 w-14 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-border text-[10px] font-medium text-muted-foreground hover:border-primary hover:text-primary">
              <ImagePlus className="h-4 w-4" /> Add
              <input type="file" accept={accept} multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; if (f.length) onFiles(f); }} />
            </label>
          </div>
        }
        stage={stage}
        sidebar={sidebar}
        footer={footer}
      />
    </FileDropTarget>
  );
}

"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropTargetProps {
  onFiles: (files: File[]) => void;
  children: React.ReactNode;
  label?: string;
  className?: string;
}

/** Makes any region a drop target with a full-cover overlay while dragging files over it. */
export function FileDropTarget({ onFiles, children, label = "Drop file to load", className }: FileDropTargetProps) {
  const [dragging, setDragging] = React.useState(false);
  const depth = React.useRef(0);
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
    >
      {children}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary bg-background/80 text-primary backdrop-blur-sm">
          <UploadCloud className="h-10 w-10" />
          <p className="text-sm font-semibold">{label}</p>
        </div>
      )}
    </div>
  );
}

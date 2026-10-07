"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
  hint?: string;
  className?: string;
}

export function DropZone({
  onFiles,
  accept,
  multiple = true,
  label = "Drag & drop files here, or click to browse",
  hint,
  className,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = React.useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      onFiles(Array.from(fileList));
    },
    [onFiles]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border-2 border-dashed border-border bg-gradient-to-br from-primary/[0.06] via-transparent to-fuchsia-500/[0.06] px-6 py-14 text-center outline-none transition-all duration-300 hover:border-primary/60 hover:from-primary/10 hover:shadow-lg hover:shadow-primary/10 focus-visible:ring-4 focus-visible:ring-primary/25",
        isDragging && "scale-[1.01] border-primary from-primary/15 shadow-xl shadow-primary/20",
        className
      )}
    >
      <span className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl transition-opacity group-hover:opacity-100" aria-hidden />
      <span className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" aria-hidden />
      {isDragging && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-primary"
          style={{ animation: "glow-pulse 1.4s ease-in-out infinite" }}
        />
      )}
      <motion.span
        animate={isDragging ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/30"
      >
        <span className="absolute inset-0 -z-10 animate-ping rounded-2xl bg-primary/20 [animation-duration:2.6s]" aria-hidden />
        <UploadCloud className="h-8 w-8" />
      </motion.span>
      <div className="relative space-y-1">
        <p className="text-base font-semibold">{label}</p>
        {hint && <p className="mx-auto max-w-md text-sm text-muted-foreground">{hint}</p>}
      </div>
      <span className="relative inline-flex h-9 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-transform group-hover:scale-105">Browse files</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Copy, Check, RotateCcw, Trash2, History } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  getToolHistory,
  deleteToolHistoryItem,
  clearToolHistory,
  type ToolHistoryItem,
} from "@/lib/storage/toolHistoryDb";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { SendToMenu } from "@/components/tools/shared/SendToMenu";

export interface ToolHistoryListHandle {
  /** Call after saving a new result so the list refreshes without a full remount. */
  refresh: () => void;
}

/**
 * `title` is a human-readable label (e.g. "photo.jpg → photo.png (1.2
 * MB)"), not necessarily a valid filename — strips characters the
 * filesystem/download attribute would reject or mangle.
 */
function sanitizeFileName(title: string): string {
  const cleaned = title.replace(/[/\\:*?"<>|]/g, "").trim();
  return cleaned || "download";
}

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

/**
 * Color-picker history entries store `data` as `{ hex, rgb, hsl }` JSON
 * (see ColorPicker.tsx's saveToolResult call). Other tools store plain
 * text/JSON that won't match this shape, so this returns null for them and
 * the swatch is simply omitted — this stays generic across all tools
 * instead of special-casing on `toolSlug`.
 */
function extractSwatchColor(data: string | undefined): string | null {
  if (!data) return null;
  try {
    const parsed: unknown = JSON.parse(data);
    if (
      parsed &&
      typeof parsed === "object" &&
      "hex" in parsed &&
      typeof (parsed as { hex: unknown }).hex === "string" &&
      HEX_COLOR_PATTERN.test((parsed as { hex: string }).hex)
    ) {
      return (parsed as { hex: string }).hex;
    }
  } catch {
    // Not JSON — not a color entry.
  }
  return null;
}

interface ToolHistoryListProps {
  toolSlug: string;
  /** Called when the user clicks "Restore Inputs" on an entry with `data`. */
  onRestore?: (item: ToolHistoryItem) => void;
}

/**
 * Reusable "last 5 results" list for any tool, backed by IndexedDB via
 * lib/storage/toolHistoryDb. Reads happen in an effect (IndexedDB is
 * async and client-only), so this renders nothing until the first load
 * completes — same hydration-safety approach as RecentToolsShelf.
 */
export const ToolHistoryList = React.forwardRef<ToolHistoryListHandle, ToolHistoryListProps>(
  function ToolHistoryList({ toolSlug, onRestore }, ref) {
    const t = useTranslations("toolHistory");
    const tTime = useTranslations("time");
    const [items, setItems] = React.useState<ToolHistoryItem[] | null>(null);
    const [copiedId, setCopiedId] = React.useState<string | null>(null);
    const [confirmingClear, setConfirmingClear] = React.useState(false);

    const load = React.useCallback(() => {
      getToolHistory(toolSlug).then(setItems);
    }, [toolSlug]);

    React.useEffect(() => {
      load();
    }, [load]);

    React.useImperativeHandle(ref, () => ({ refresh: load }), [load]);

    const handleDelete = async (id: string) => {
      await deleteToolHistoryItem(toolSlug, id);
      load();
    };

    const handleClearAll = async () => {
      if (!confirmingClear) {
        setConfirmingClear(true);
        return;
      }
      await clearToolHistory(toolSlug);
      setConfirmingClear(false);
      load();
    };

    const handleCopy = async (item: ToolHistoryItem) => {
      if (!item.data) return;
      await navigator.clipboard.writeText(item.data);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 1500);
    };

    const handleRedownload = (item: ToolHistoryItem) => {
      if (!item.blob) return;
      downloadBlob(item.blob, sanitizeFileName(item.title));
    };

    // Nothing loaded yet, or genuinely empty: render nothing rather than an
    // empty-state box, so tools with no history yet don't show a dangling
    // section.
    if (items === null || items.length === 0) return null;

    return (
      <div className="mt-8 rounded-xl border border-border bg-card/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-primary" />
            {t("heading")}
          </h3>
          <button
            onClick={handleClearAll}
            onBlur={() => setConfirmingClear(false)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              confirmingClear
                ? "bg-destructive/10 text-destructive"
                : "text-muted-foreground hover:text-destructive"
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmingClear ? t("confirmClear") : t("clear")}
          </button>
        </div>

        <motion.ul className="space-y-2">
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((item) => {
              const swatchColor = extractSwatchColor(item.data);
              return (
                <motion.li
                  key={item.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3 overflow-hidden rounded-lg border border-border bg-background px-3 py-2"
                >
                  {swatchColor && (
                    <span
                      aria-hidden="true"
                      className="h-8 w-8 shrink-0 rounded-md border border-border"
                      style={{ backgroundColor: swatchColor }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.summary} · {formatRelativeTime(item.timestamp, (key, values) => tTime(key, values))}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {item.blob && (
                      <button
                        onClick={() => handleRedownload(item)}
                        aria-label={t("redownload")}
                        title={t("redownload")}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                    {item.blob && (
                      <SendToMenu
                        fromSlug={toolSlug}
                        blob={item.blob}
                        fileName={sanitizeFileName(item.title)}
                      />
                    )}
                    {item.data && (
                      <button
                        onClick={() => handleCopy(item)}
                        aria-label={t("copy")}
                        title={t("copy")}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {copiedId === item.id ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    {item.data && onRestore && (
                      <button
                        onClick={() => onRestore(item)}
                        aria-label={t("restore")}
                        title={t("restore")}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      aria-label={t("clear")}
                      title={t("clear")}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      </div>
    );
  }
);

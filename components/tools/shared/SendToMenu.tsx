"use client";

import * as React from "react";
import { ArrowUpRight, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { getToolBySlug } from "@/config/tools";
import { useRouter } from "@/i18n/routing";
import { stashHandoff } from "@/lib/storage/toolPipelineDb";
import { mediaTypeForBlob, pipelineSlugsFor } from "@/lib/pipelineTools";

interface SendToMenuProps {
  /** Slug of the tool this menu is rendered on (excluded from its own destination list). */
  fromSlug: string;
  blob: Blob;
  fileName: string;
}

/**
 * "Send to next tool" — lets a tool's result feed directly into another
 * compatible tool without the user manually downloading and re-uploading.
 * Only ever offers tools that (a) accept the result's media type (image vs.
 * video, inferred from the blob's MIME type — see lib/pipelineTools.ts) and
 * (b) aren't the current tool itself.
 */
export function SendToMenu({ fromSlug, blob, fileName }: SendToMenuProps) {
  const t = useTranslations("toolHistory");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const mediaType = mediaTypeForBlob(blob);
  const destinations = React.useMemo(() => {
    if (!mediaType) return [];
    return pipelineSlugsFor(mediaType)
      .filter((slug) => slug !== fromSlug)
      .map((slug) => getToolBySlug(slug))
      .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool));
  }, [mediaType, fromSlug]);

  React.useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (destinations.length === 0) return null;

  const handleSend = async (targetSlug: string, targetCategory: string) => {
    const id = await stashHandoff(blob, fileName, fromSlug);
    setOpen(false);
    router.push(`/tools/${targetCategory}/${targetSlug}?from=${id}`);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("sendTo")}
        title={t("sendTo")}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Send className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <p className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
            {t("sendTo")}
          </p>
          <ul className="max-h-64 overflow-y-auto py-1">
            {destinations.map((tool) => {
              const Icon = tool.icon;
              return (
                <li key={tool.slug}>
                  <button
                    onClick={() => handleSend(tool.slug, tool.category)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate">{tool.shortName}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

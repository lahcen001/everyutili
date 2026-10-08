"use client";

import { ArrowRight, FileImage, Film, Type } from "lucide-react";
import { useMessages, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getToolBySlug } from "@/config/tools";
import { Link } from "@/i18n/routing";

const TOOLS_FOR: Record<"image" | "video", string[]> = {
  image: ["image-compressor", "image-resizer", "image-cropper", "image-annotator", "image-filters", "watermark-maker", "screenshot-beautifier", "jpg-to-png", "webp-converter", "exif-stripper", "color-picker", "favicon-generator"],
  video: ["video-trimmer", "video-to-gif", "video-speed", "video-audio-remover"],
};

/** "Share to EveryUtili" landing page: pick what to do with the photo, video or text that was just shared. */
export function SharePicker() {
  const t = useTranslations("app");
  const params = useSearchParams();
  const messages = useMessages() as { tools?: Record<string, { shortName?: string; subheading?: string }> };
  const kind = params.get("kind");
  const from = params.get("from");
  const text = params.get("text") ?? "";

  const names = (slug: string) => messages.tools?.[slug]?.shortName ?? getToolBySlug(slug)?.shortName ?? slug;
  const Icon = kind === "video" ? Film : kind === "text" ? Type : FileImage;
  const title = kind === "video" ? t("shareVideo") : kind === "text" ? t("shareText") : t("shareImage");

  const entries: { slug: string; href: string }[] =
    kind === "text"
      ? [{ slug: "qr-code-generator", href: `/tools/media/qr-code-generator?text=${encodeURIComponent(text)}` }]
      : kind === "image" || kind === "video"
        ? TOOLS_FOR[kind].filter((s) => getToolBySlug(s)).map((slug) => ({ slug, href: `/tools/${getToolBySlug(slug)!.category}/${slug}${from ? `?from=${encodeURIComponent(from)}` : ""}` }))
        : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-7 w-7" /></span>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {kind === "text" && text && <p className="max-w-full break-words rounded-xl bg-muted px-4 py-2 text-sm text-muted-foreground">{text.length > 160 ? `${text.slice(0, 159)}…` : text}</p>}
        {(kind === "image" || kind === "video") && <p className="text-xs text-muted-foreground">{t("shareKept")}</p>}
      </div>
      {entries.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">{t("shareNothing")}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {entries.map(({ slug, href }) => {
            const ToolIcon = getToolBySlug(slug)?.icon;
            return (
              <li key={slug}>
                <Link href={href}>
                  <Card className="flex items-center gap-3 p-4 transition-colors hover:border-primary">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{ToolIcon && <ToolIcon className="h-5 w-5" />}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{names(slug)}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:-scale-x-100" />
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

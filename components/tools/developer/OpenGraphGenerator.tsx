"use client";

import * as React from "react";
import { Globe, ImageIcon, Save } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { DEFAULT_OG, LIMITS, buildMetaTags, buildMetadataObject, domainFromUrl, isValidHttpUrl, truncate, type OgFields } from "@/lib/ogTags";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

function Counter({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <span className={cn("text-xs tabular-nums", over ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")} aria-live="polite">
      {value.length}/{max}
      {over && " — may be cut off"}
    </span>
  );
}

function Field({ label, children, counter }: { label: string; children: React.ReactNode; counter?: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-2 text-sm font-medium">
        {label}
        {counter}
      </span>
      {children}
    </label>
  );
}

/** Loads the user's image URL for the previews and tells the parent whether it worked. */
function PreviewImage({ url, className, onState }: { url: string; className?: string; onState: (state: "ok" | "error", size?: { w: number; h: number }) => void }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={url} src={url} alt="" referrerPolicy="no-referrer" onLoad={(e) => onState("ok", { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} onError={() => onState("error")} className={className} />;
}

export default function OpenGraphGenerator() {
  useTrackTool("opengraph-generator");
  const [fields, setFields] = React.useState<OgFields>(DEFAULT_OG);
  const [imageState, setImageState] = React.useState<{ url: string; state: "ok" | "error"; w?: number; h?: number } | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const set = <K extends keyof OgFields>(key: K, value: OgFields[K]) => setFields((prev) => ({ ...prev, [key]: value }));
  const domain = domainFromUrl(fields.url);
  const imageUrl = isValidHttpUrl(fields.imageUrl.trim()) ? fields.imageUrl.trim() : "";
  const imageOk = imageState?.url === imageUrl && imageState.state === "ok";
  const imageBad = fields.imageUrl.trim() !== "" && (!imageUrl || (imageState?.url === imageUrl && imageState.state === "error"));
  const ratio = imageOk && imageState?.w && imageState.h ? imageState.w / imageState.h : null;

  const metaTags = React.useMemo(() => buildMetaTags(fields), [fields]);
  const metadataObject = React.useMemo(() => buildMetadataObject(fields), [fields]);
  const onImage = (state: "ok" | "error", size?: { w: number; h: number }) => setImageState({ url: imageUrl, state, w: size?.w, h: size?.h });

  const save = async () => {
    await saveToolResult("opengraph-generator", { title: fields.title || "Untitled", summary: fields.url || "No URL set", data: JSON.stringify(fields) });
    historyRef.current?.refresh();
  };
  const restore = (item: ToolHistoryItem) => {
    if (!item.data) return;
    try {
      setFields({ ...DEFAULT_OG, ...(JSON.parse(item.data) as Partial<OgFields>) });
    } catch {
      /* ignore malformed saved data */
    }
  };

  const title = fields.title || "Page title";
  const description = fields.description || "A short description of the page appears here.";
  const imageBox = (cls: string) =>
    imageUrl ? (
      <PreviewImage url={imageUrl} className={cn("h-full w-full object-cover", cls)} onState={onImage} />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
        <ImageIcon className="h-8 w-8" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Card className="space-y-4 p-5">
          <Field label="Title" counter={<Counter value={fields.title} max={LIMITS.title} />}>
            <input value={fields.title} onChange={(e) => set("title", e.target.value)} placeholder="Page title" className={inputClass} />
          </Field>
          <Field label="Description" counter={<Counter value={fields.description} max={LIMITS.description} />}>
            <textarea value={fields.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="A short summary of the page" className={cn(inputClass, "resize-y")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Canonical URL">
              <input value={fields.url} onChange={(e) => set("url", e.target.value)} placeholder="https://example.com/page" className={inputClass} />
            </Field>
            <Field label="Site name">
              <input value={fields.siteName} onChange={(e) => set("siteName", e.target.value)} placeholder="Your Site" className={inputClass} />
            </Field>
          </div>
          <Field label="Image URL (1200×630 recommended)">
            <input value={fields.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://example.com/og-image.png" className={inputClass} />
          </Field>
          {imageBad && (
            <p role="alert" className="text-xs text-destructive">
              {!imageUrl ? "The image address must start with http:// or https://." : "This image couldn't be loaded. Check the address — and that it is publicly reachable, as crawlers can't see private images."}
            </p>
          )}
          {imageOk && imageState && (
            <p className={cn("text-xs", ratio && (ratio < 1.7 || ratio > 2.1) ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
              Image is {imageState.w}×{imageState.h}px (ratio {ratio?.toFixed(2)}:1). {ratio && (ratio < 1.7 || ratio > 2.1) ? "The ideal 'large image' ratio is about 1.91:1, so it may be cropped." : "Good ratio for a large preview."}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Image alt text">
              <input value={fields.imageAlt} onChange={(e) => set("imageAlt", e.target.value)} placeholder="Describe the image" className={inputClass} />
            </Field>
            <Field label="Image width">
              <input value={fields.imageWidth} onChange={(e) => set("imageWidth", e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputClass} />
            </Field>
            <Field label="Image height">
              <input value={fields.imageHeight} onChange={(e) => set("imageHeight", e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputClass} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Content type">
              <select value={fields.type} onChange={(e) => set("type", e.target.value as OgFields["type"])} className={inputClass}>
                {(["website", "article", "product", "profile"] as const).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Locale">
              <input value={fields.locale} onChange={(e) => set("locale", e.target.value)} placeholder="en_US" className={inputClass} />
            </Field>
            <Field label="Twitter / X card">
              <select value={fields.twitterCard} onChange={(e) => set("twitterCard", e.target.value as OgFields["twitterCard"])} className={inputClass}>
                <option value="summary_large_image">Large image</option>
                <option value="summary">Summary (small image)</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Twitter / X site">
              <input value={fields.twitterSite} onChange={(e) => set("twitterSite", e.target.value)} placeholder="@yoursite" className={inputClass} />
            </Field>
            <Field label="Twitter / X creator">
              <input value={fields.twitterCreator} onChange={(e) => set("twitterCreator", e.target.value)} placeholder="@author" className={inputClass} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">Previews load your image straight from its address, so that server sees your IP like any web page would. Nothing else leaves your browser.</p>
        </Card>

        <div className="space-y-4">
          <Tabs defaultValue="google">
            <TabsList className="flex-wrap">
              <TabsTrigger value="google">Google</TabsTrigger>
              <TabsTrigger value="twitter">X / Twitter</TabsTrigger>
              <TabsTrigger value="facebook">Facebook / LinkedIn</TabsTrigger>
              <TabsTrigger value="slack">Slack / Discord</TabsTrigger>
            </TabsList>

            <TabsContent value="google">
              <Card className="space-y-1 p-5">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" /> {domain || "example.com"}
                </p>
                <p className="text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{truncate(title, LIMITS.title)}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{truncate(description, LIMITS.description)}</p>
              </Card>
            </TabsContent>

            <TabsContent value="twitter">
              {fields.twitterCard === "summary_large_image" ? (
                <Card className="max-w-lg overflow-hidden rounded-2xl p-0">
                  <div className="aspect-[1.91/1] overflow-hidden">{imageBox("")}</div>
                  <div className="space-y-0.5 p-3">
                    <p className="text-xs text-muted-foreground">{domain || "example.com"}</p>
                    <p className="text-sm font-medium">{truncate(title, LIMITS.twitterTitle)}</p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{truncate(description, LIMITS.twitterDescription)}</p>
                  </div>
                </Card>
              ) : (
                <Card className="flex max-w-lg overflow-hidden rounded-2xl p-0">
                  <div className="aspect-square w-32 shrink-0 overflow-hidden">{imageBox("")}</div>
                  <div className="min-w-0 space-y-0.5 p-3">
                    <p className="text-xs text-muted-foreground">{domain || "example.com"}</p>
                    <p className="truncate text-sm font-medium">{truncate(title, LIMITS.twitterTitle)}</p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{truncate(description, LIMITS.twitterDescription)}</p>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="facebook">
              <Card className="max-w-lg overflow-hidden p-0">
                <div className="aspect-[1.91/1] overflow-hidden">{imageBox("")}</div>
                <div className="space-y-0.5 border-t border-border bg-muted/40 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{domain || "example.com"}</p>
                  <p className="text-sm font-semibold">{truncate(title, 88)}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{truncate(description, 200)}</p>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="slack">
              <Card className="max-w-lg space-y-1.5 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className="inline-block h-3 w-3 rounded-sm bg-primary" /> {fields.siteName || domain || "Site"}
                </p>
                <p className="text-sm font-semibold text-[#1264a3] dark:text-[#4aa3e8]">{truncate(title, 100)}</p>
                <p className="text-sm text-muted-foreground">{truncate(description, 300)}</p>
                {imageUrl && <div className="mt-2 aspect-[1.91/1] max-w-sm overflow-hidden rounded-lg border border-border">{imageBox("")}</div>}
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">HTML meta tags</p>
              <CopyButton value={metaTags} size="sm" variant="outline">
                Copy
              </CopyButton>
            </div>
            <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed">{metaTags}</pre>
          </Card>

          <Card className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Next.js metadata</p>
              <CopyButton value={metadataObject} size="sm" variant="outline">
                Copy
              </CopyButton>
            </div>
            <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed">{metadataObject}</pre>
          </Card>

          <Button size="sm" variant="outline" onClick={save}>
            <Save className="h-3.5 w-3.5" /> Save result
          </Button>
        </div>
      </div>

      <ToolHistoryList ref={historyRef} toolSlug="opengraph-generator" onRestore={restore} />
    </div>
  );
}

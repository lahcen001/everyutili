"use client";

import * as React from "react";
import { Globe, ImageIcon, Save, Search } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult, type ToolHistoryItem } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

interface OgFields {
  title: string;
  description: string;
  url: string;
  siteName: string;
  imageUrl: string;
  twitterHandle: string;
}

const DEFAULT_FIELDS: OgFields = {
  title: "EveryUtili — Free Privacy-First Online Tools",
  description:
    "58 free browser-based tools for images, files, text, and developers. Everything runs on your device — nothing is ever uploaded.",
  url: "https://everyutili.com",
  siteName: "EveryUtili",
  imageUrl: "",
  twitterHandle: "@everyutili",
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";
  }
}

function buildMetaTags(fields: OgFields): string {
  const lines = [
    `<meta property="og:title" content="${fields.title}" />`,
    `<meta property="og:description" content="${fields.description}" />`,
    `<meta property="og:url" content="${fields.url}" />`,
    `<meta property="og:site_name" content="${fields.siteName}" />`,
    `<meta property="og:image" content="${fields.imageUrl}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${fields.title}" />`,
    `<meta name="twitter:description" content="${fields.description}" />`,
    `<meta name="twitter:image" content="${fields.imageUrl}" />`,
    `<meta name="twitter:site" content="${fields.twitterHandle}" />`,
  ];
  return lines.join("\n");
}

function buildMetadataObject(fields: OgFields): string {
  return `export const metadata: Metadata = {
  title: "${fields.title}",
  description: "${fields.description}",
  openGraph: {
    title: "${fields.title}",
    description: "${fields.description}",
    url: "${fields.url}",
    siteName: "${fields.siteName}",
    images: [{ url: "${fields.imageUrl}" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "${fields.title}",
    description: "${fields.description}",
    images: ["${fields.imageUrl}"],
    site: "${fields.twitterHandle}",
  },
};`;
}

const FIELD_CONFIG: { key: keyof OgFields; label: string; placeholder: string }[] = [
  { key: "title", label: "Title", placeholder: "Page title" },
  { key: "description", label: "Description", placeholder: "A short summary of the page" },
  { key: "url", label: "Canonical URL", placeholder: "https://example.com/page" },
  { key: "siteName", label: "Site Name", placeholder: "Your Site" },
  { key: "imageUrl", label: "Image URL", placeholder: "https://example.com/og-image.png" },
  { key: "twitterHandle", label: "Twitter handle", placeholder: "@yoursite" },
];

export default function OpenGraphGenerator() {
  useTrackTool("opengraph-generator");
  const [fields, setFields] = React.useState<OgFields>(DEFAULT_FIELDS);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const updateField = (key: keyof OgFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const domain = React.useMemo(() => domainFromUrl(fields.url), [fields.url]);
  const metaTags = React.useMemo(() => buildMetaTags(fields), [fields]);
  const metadataObject = React.useMemo(() => buildMetadataObject(fields), [fields]);

  const handleSave = async () => {
    await saveToolResult("opengraph-generator", {
      title: fields.title || "Untitled",
      summary: fields.url || "No URL set",
      data: JSON.stringify(fields),
    });
    historyRef.current?.refresh();
  };

  const handleRestore = (item: ToolHistoryItem) => {
    if (!item.data) return;
    try {
      const restored = JSON.parse(item.data) as Partial<OgFields>;
      setFields({ ...DEFAULT_FIELDS, ...restored });
    } catch {
      // Ignore malformed stored data.
    }
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        {FIELD_CONFIG.map((field) =>
          field.key === "description" ? (
            <label key={field.key} className="block space-y-1.5">
              <span className="text-sm font-medium">{field.label}</span>
              <textarea
                value={fields[field.key]}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          ) : (
            <label key={field.key} className="block space-y-1.5">
              <span className="text-sm font-medium">{field.label}</span>
              <input
                type="text"
                value={fields[field.key]}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          )
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2 p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Search className="h-3.5 w-3.5" /> Google Search preview
          </p>
          <div className="space-y-1 rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                <Globe className="h-3 w-3" />
              </span>
              <span>
                <span className="text-foreground">{fields.siteName || "Site name"}</span>{" "}
                <span className="text-green-700 dark:text-green-500">{domain || "example.com"}</span>
              </span>
            </div>
            <p className="truncate text-lg text-[#1a0dab] dark:text-[#8ab4f8]">
              {truncate(fields.title, 60) || "Page title"}
            </p>
            <p className="text-sm text-muted-foreground">
              {truncate(fields.description, 160) || "Page description will appear here."}
            </p>
          </div>
        </Card>

        <Card className="space-y-2 p-4">
          <p className="text-xs font-medium text-muted-foreground">Twitter / X card preview</p>
          <div className="overflow-hidden rounded-xl border border-border">
            {fields.imageUrl ? (
              <img src={fields.imageUrl} alt="Open Graph preview" className="h-40 w-full object-cover" />
            ) : (
              <div className="flex h-40 w-full items-center justify-center bg-muted/40">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="space-y-1 border-t border-border p-3">
              <p className="truncate text-sm font-semibold">{truncate(fields.title, 70) || "Page title"}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {truncate(fields.description, 125) || "Page description will appear here."}
              </p>
              <p className="text-xs text-muted-foreground">{domain || "example.com"}</p>
            </div>
          </div>
        </Card>

        <Card className="space-y-2 p-4 lg:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">Facebook link preview</p>
          <div className="mx-auto max-w-md overflow-hidden rounded-lg border border-border">
            {fields.imageUrl ? (
              <img src={fields.imageUrl} alt="Open Graph preview" className="h-52 w-full object-cover" />
            ) : (
              <div className="flex h-52 w-full items-center justify-center bg-muted/40">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="space-y-1 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{domain || "example.com"}</p>
              <p className="truncate text-sm font-semibold">{truncate(fields.title, 70) || "Page title"}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {truncate(fields.description, 125) || "Page description will appear here."}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">HTML meta tags</p>
          <CopyButton value={metaTags} size="sm" variant="outline">
            Copy HTML meta tags
          </CopyButton>
        </div>
        <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs">
          {metaTags}
        </pre>
      </Card>

      <Card className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Next.js metadata object</p>
          <CopyButton value={metadataObject} size="sm" variant="outline">
            Copy Next.js metadata object
          </CopyButton>
        </div>
        <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs">
          {metadataObject}
        </pre>
      </Card>

      <Button size="sm" variant="outline" onClick={handleSave}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="opengraph-generator" onRestore={handleRestore} />
    </div>
  );
}

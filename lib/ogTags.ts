export interface OgFields {
  title: string;
  description: string;
  url: string;
  siteName: string;
  type: "website" | "article" | "product" | "profile";
  locale: string;
  imageUrl: string;
  imageAlt: string;
  imageWidth: string;
  imageHeight: string;
  twitterCard: "summary" | "summary_large_image";
  twitterSite: string;
  twitterCreator: string;
}

export const DEFAULT_OG: OgFields = {
  title: "EveryUtili — Free Privacy-First Online Tools",
  description: "Free browser-based tools for images, documents, text and developers. Everything runs on your device — nothing is ever uploaded.",
  url: "https://everyutili.com",
  siteName: "EveryUtili",
  type: "website",
  locale: "en_US",
  imageUrl: "",
  imageAlt: "",
  imageWidth: "1200",
  imageHeight: "630",
  twitterCard: "summary_large_image",
  twitterSite: "@everyutili",
  twitterCreator: "",
};

/** Recommended maximums: where search and social previews start cutting text off. */
export const LIMITS = { title: 60, description: 160, twitterTitle: 70, twitterDescription: 200 };

export const escapeHtmlAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const escapeJsString = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

const handle = (h: string) => (h.trim() && !h.trim().startsWith("@") ? `@${h.trim()}` : h.trim());

/** Only tags that have a value are written — no empty content="" lines. */
export function buildMetaTags(f: OgFields): string {
  const lines: string[] = [];
  const add = (kind: "property" | "name", key: string, value: string) => {
    if (value.trim()) lines.push(`<meta ${kind}="${key}" content="${escapeHtmlAttr(value.trim())}" />`);
  };
  if (f.title.trim()) lines.push(`<title>${escapeHtmlAttr(f.title.trim()).replace(/&quot;/g, '"')}</title>`);
  add("name", "description", f.description);
  if (f.url.trim()) lines.push(`<link rel="canonical" href="${escapeHtmlAttr(f.url.trim())}" />`);
  add("property", "og:type", f.type);
  add("property", "og:title", f.title);
  add("property", "og:description", f.description);
  add("property", "og:url", f.url);
  add("property", "og:site_name", f.siteName);
  add("property", "og:locale", f.locale);
  add("property", "og:image", f.imageUrl);
  if (f.imageUrl.trim()) {
    add("property", "og:image:alt", f.imageAlt);
    add("property", "og:image:width", f.imageWidth);
    add("property", "og:image:height", f.imageHeight);
  }
  add("name", "twitter:card", f.twitterCard);
  add("name", "twitter:title", f.title);
  add("name", "twitter:description", f.description);
  add("name", "twitter:image", f.imageUrl);
  if (f.imageUrl.trim()) add("name", "twitter:image:alt", f.imageAlt);
  add("name", "twitter:site", handle(f.twitterSite));
  add("name", "twitter:creator", handle(f.twitterCreator));
  return lines.join("\n");
}

export function buildMetadataObject(f: OgFields): string {
  const q = (s: string) => `"${escapeJsString(s.trim())}"`;
  const open: string[] = [];
  const push = (arr: string[], key: string, value: string) => value.trim() && arr.push(`    ${key}: ${q(value)},`);
  push(open, "title", f.title);
  push(open, "description", f.description);
  push(open, "url", f.url);
  push(open, "siteName", f.siteName);
  push(open, "locale", f.locale);
  open.push(`    type: ${q(f.type)},`);
  if (f.imageUrl.trim()) {
    const dims = [f.imageWidth.trim() && `width: ${Number(f.imageWidth) || 0}`, f.imageHeight.trim() && `height: ${Number(f.imageHeight) || 0}`, f.imageAlt.trim() && `alt: ${q(f.imageAlt)}`].filter(Boolean);
    open.push(`    images: [{ url: ${q(f.imageUrl)}${dims.length ? `, ${dims.join(", ")}` : ""} }],`);
  }
  const tw: string[] = [`    card: ${q(f.twitterCard)},`];
  push(tw, "title", f.title);
  push(tw, "description", f.description);
  if (f.imageUrl.trim()) tw.push(`    images: [${q(f.imageUrl)}],`);
  push(tw, "site", handle(f.twitterSite));
  push(tw, "creator", handle(f.twitterCreator));
  const top: string[] = [];
  push(top, "title", f.title);
  push(top, "description", f.description);
  return `import type { Metadata } from "next";\n\nexport const metadata: Metadata = {\n${top.map((l) => l.slice(2)).map((l) => `  ${l}`).join("\n")}\n  openGraph: {\n${open.join("\n")}\n  },\n  twitter: {\n${tw.join("\n")}\n  },\n};\n`;
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";
  }
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export type UrlScope = "component" | "uri" | "form";

/** component = encodeURIComponent (encode everything), uri = encodeURI (keep URL structure), form = component with spaces as +. */
export function encodeUrl(text: string, scope: UrlScope): string {
  if (scope === "uri") return encodeURI(text);
  const encoded = encodeURIComponent(text);
  return scope === "form" ? encoded.replace(/%20/g, "+") : encoded;
}

export function decodeUrl(text: string, scope: UrlScope): string {
  const input = scope === "form" ? text.replace(/\+/g, " ") : text;
  return scope === "uri" ? decodeURI(input) : decodeURIComponent(input);
}

export interface ParsedUrl {
  parts: { label: string; value: string }[];
  params: { key: string; value: string }[];
}

export function parseUrl(text: string): ParsedUrl | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  const parts = [
    { label: "Protocol", value: url.protocol },
    { label: "Host", value: url.host },
    { label: "Path", value: url.pathname },
    { label: "Query", value: url.search },
    { label: "Fragment", value: url.hash },
  ].filter((p) => p.value && p.value !== "?" && p.value !== "#");
  const params = Array.from(url.searchParams.entries()).map(([key, value]) => ({ key, value }));
  return { parts, params };
}

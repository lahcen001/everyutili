export type QrKind = "text" | "url" | "wifi" | "email" | "phone" | "sms" | "vcard";

const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
const vEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

export interface WifiFields {
  ssid: string;
  password: string;
  security: "WPA" | "WEP" | "nopass";
  hidden: boolean;
}
export interface VCardFields {
  first: string;
  last: string;
  org: string;
  title: string;
  phone: string;
  email: string;
  url: string;
}
export interface EmailFields {
  to: string;
  subject: string;
  body: string;
}

export function wifiPayload(w: WifiFields): string {
  const pass = w.security === "nopass" ? "" : `P:${wifiEscape(w.password)};`;
  return `WIFI:T:${w.security};S:${wifiEscape(w.ssid)};${pass}${w.hidden ? "H:true;" : ""};`;
}

export function emailPayload(e: EmailFields): string {
  const params = [e.subject && `subject=${encodeURIComponent(e.subject)}`, e.body && `body=${encodeURIComponent(e.body)}`].filter(Boolean).join("&");
  return `mailto:${e.to.trim()}${params ? `?${params}` : ""}`;
}

export const phonePayload = (n: string) => `tel:${n.replace(/[^\d+]/g, "")}`;
export const smsPayload = (n: string, body: string) => `SMSTO:${n.replace(/[^\d+]/g, "")}:${body}`;

export function vcardPayload(v: VCardFields): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${vEscape(v.last)};${vEscape(v.first)};;;`, `FN:${vEscape([v.first, v.last].filter(Boolean).join(" "))}`];
  if (v.org) lines.push(`ORG:${vEscape(v.org)}`);
  if (v.title) lines.push(`TITLE:${vEscape(v.title)}`);
  if (v.phone) lines.push(`TEL;TYPE=CELL:${v.phone.trim()}`);
  if (v.email) lines.push(`EMAIL:${v.email.trim()}`);
  if (v.url) lines.push(`URL:${v.url.trim()}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

/** Add https:// if the user typed a bare domain. */
export function normalizeUrl(input: string): string {
  const t = input.trim();
  if (!t) return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
}

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Scanners need dark modules on a light background; inverted codes fail on many readers. */
export function isInverted(fg: string, bg: string): boolean {
  return luminance(fg) > luminance(bg);
}

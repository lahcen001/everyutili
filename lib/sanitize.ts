import DOMPurify from "dompurify";

/** Sanitizes untrusted HTML (e.g. converted from a user's file) before it is injected into the DOM. Returns "" during SSR. */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html);
}

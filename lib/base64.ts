export interface EncodeOptions {
  /** Use "-" and "_" instead of "+" and "/" (safe in URLs and file names). */
  urlSafe?: boolean;
  /** Omit the trailing "=" padding. */
  padding?: boolean;
  /** Break the output into lines of 76 characters (MIME style). */
  wrap?: boolean;
}

export function bytesToBase64(bytes: Uint8Array, options: EncodeOptions = {}): string {
  let binary = "";
  const chunk = 0x8000; // avoid exceeding the argument limit on large inputs
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  let out = btoa(binary);
  if (options.urlSafe) out = out.replace(/\+/g, "-").replace(/\//g, "_");
  if (options.padding === false) out = out.replace(/=+$/, "");
  if (options.wrap) out = out.replace(/(.{76})(?=.)/g, "$1\n");
  return out;
}

export function encodeText(text: string, options: EncodeOptions = {}): string {
  return bytesToBase64(new TextEncoder().encode(text), options);
}

export interface DataUri {
  mime: string | null;
  base64: string;
}

/** Parses "data:image/png;base64,AAAA"; returns null for anything else. */
export function parseDataUri(input: string): DataUri | null {
  const match = /^\s*data:([^;,]*)((?:;[^;,]*)*?);base64,([\s\S]*)$/i.exec(input);
  return match ? { mime: match[1] || null, base64: match[3] } : null;
}

export function buildDataUri(mime: string, base64: string): string {
  return `data:${mime};base64,${base64.replace(/\s+/g, "")}`;
}

/** Base64 or Base64URL, with or without padding, whitespace and a data: prefix tolerated. */
export function base64ToBytes(input: string): Uint8Array {
  const body = (parseDataUri(input)?.base64 ?? input).replace(/\s+/g, "");
  const normalized = body.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (!/^[A-Za-z0-9+/]*$/.test(normalized) || normalized.length % 4 === 1) throw new Error("Invalid Base64 input.");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** True when the text plausibly is Base64 (so a user pasting it into "encode" can be nudged to decode). */
export function looksLikeBase64(input: string): boolean {
  const body = (parseDataUri(input)?.base64 ?? input).replace(/\s+/g, "");
  if (body.length < 12) return false;
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(body)) return false;
  // Plain words like "HelloWorldHello" also match the alphabet, so require some variety or padding.
  return /=$/.test(body) || /[0-9+/_-]/.test(body) || (/[A-Z]/.test(body) && /[a-z]/.test(body) && body.length % 4 === 0);
}

/** Decodes bytes as UTF-8; `valid` is false when the bytes are not text (binary data). */
export function bytesToText(bytes: Uint8Array): { text: string; valid: boolean } {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), valid: true };
  } catch {
    return { text: "", valid: false };
  }
}

const SIGNATURES: { mime: string; extension: string; test: (b: Uint8Array) => boolean }[] = [
  { mime: "image/png", extension: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/jpeg", extension: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/gif", extension: "gif", test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  { mime: "image/webp", extension: "webp", test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { mime: "application/pdf", extension: "pdf", test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  { mime: "application/zip", extension: "zip", test: (b) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05) },
  { mime: "audio/mpeg", extension: "mp3", test: (b) => (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { mime: "video/mp4", extension: "mp4", test: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 },
];

/** Identifies common file types from their first bytes; null when unknown. */
export function sniffFileType(bytes: Uint8Array): { mime: string; extension: string } | null {
  const hit = SIGNATURES.find((s) => s.test(bytes));
  return hit ? { mime: hit.mime, extension: hit.extension } : null;
}

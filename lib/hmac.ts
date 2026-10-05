export type HmacEncoding = "hex" | "base64" | "base64url";

export function encodeDigest(bytes: Uint8Array, encoding: HmacEncoding, uppercase = false): string {
  if (encoding === "hex") {
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return uppercase ? hex.toUpperCase() : hex;
  }
  const b64 = btoa(String.fromCharCode(...bytes));
  return encoding === "base64url" ? b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : b64;
}

/** Parse a hex string ("ab cd", "0xab…") into bytes; null if not valid hex. */
export function parseHex(text: string): Uint8Array | null {
  const clean = text.replace(/^0x/i, "").replace(/[\s:]/g, "");
  if (clean === "" || clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) return null;
  return Uint8Array.from(clean.match(/../g)!, (h) => parseInt(h, 16));
}

/** Decode a pasted digest that may be hex, base64 or base64url. */
export function decodeDigest(text: string): Uint8Array | null {
  const t = text.trim();
  if (!t) return null;
  const hex = parseHex(t);
  if (hex && /^(0x)?[0-9a-f\s:]+$/i.test(t)) return hex;
  try {
    const std = t.replace(/-/g, "+").replace(/_/g, "/");
    const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Compare without exiting early on the first differing byte. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

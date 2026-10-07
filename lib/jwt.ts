export type JwtPart = Record<string, unknown> | unknown[] | string | number | boolean | null;

export interface DecodedJwt {
  header: JwtPart;
  payload: JwtPart;
  signature: string;
  /** the first two segments, exactly as signed */
  signingInput: string;
}

export type DecodeResult = { ok: true; token: DecodedJwt } | { ok: false; error: string };

export function base64UrlToBytes(input: string): Uint8Array {
  const std = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeSegment(segment: string, label: string): JwtPart {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(base64UrlToBytes(segment));
  } catch {
    throw new Error(`The ${label} isn't valid Base64URL text.`);
  }
  try {
    return JSON.parse(text) as JwtPart;
  } catch {
    throw new Error(`The ${label} decodes, but it isn't valid JSON.`);
  }
}

export function decodeJwt(input: string): DecodeResult {
  const token = input.trim().replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, error: "Paste a JWT to decode it." };
  const parts = token.split(".");
  if (parts.length === 5) return { ok: false, error: "This looks like an encrypted token (JWE, 5 parts). Only signed JWTs (3 parts) can be decoded here." };
  if (parts.length !== 3) return { ok: false, error: `A JWT has 3 dot-separated parts but this has ${parts.length}.` };
  try {
    return { ok: true, token: { header: decodeSegment(parts[0], "header"), payload: decodeSegment(parts[1], "payload"), signature: parts[2], signingInput: `${parts[0]}.${parts[1]}` } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not decode the token." };
  }
}

export interface ClaimInfo {
  name: string;
  label: string;
  /** unix seconds */
  seconds: number;
  iso: string;
  /** "in 2 hours", "3 days ago" */
  relative: string;
  status: "ok" | "expired" | "pending" | "info";
}

const CLAIM_LABELS: Record<string, string> = { exp: "Expires", nbf: "Not valid before", iat: "Issued at" };

export function relativeTime(deltaSeconds: number): string {
  const abs = Math.abs(deltaSeconds);
  const units: [number, string][] = [[31536000, "year"], [2592000, "month"], [86400, "day"], [3600, "hour"], [60, "minute"], [1, "second"]];
  const [size, name] = units.find(([s]) => abs >= s) ?? [1, "second"];
  const n = Math.floor(abs / size);
  const text = `${n} ${name}${n === 1 ? "" : "s"}`;
  return deltaSeconds >= 0 ? `in ${text}` : `${text} ago`;
}

/** Describe exp / nbf / iat against `now` (unix seconds). Anything that isn't a plain numeric date is ignored. */
export function describeClaims(payload: JwtPart, now: number): ClaimInfo[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const out: ClaimInfo[] = [];
  for (const name of ["iat", "nbf", "exp"] as const) {
    const v = (payload as Record<string, unknown>)[name];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const date = new Date(v * 1000);
    if (Number.isNaN(date.getTime())) continue;
    let status: ClaimInfo["status"] = "info";
    if (name === "exp") status = v <= now ? "expired" : "ok";
    if (name === "nbf") status = v > now ? "pending" : "ok";
    out.push({ name, label: CLAIM_LABELS[name], seconds: v, iso: date.toISOString(), relative: relativeTime(v - now), status });
  }
  return out;
}

export type TokenState = "valid-time" | "expired" | "not-yet-valid" | "no-expiry";

/** Time-based state only — this says nothing about whether the signature is genuine. */
export function timeState(payload: JwtPart, now: number): TokenState {
  const claims = describeClaims(payload, now);
  if (claims.some((c) => c.name === "exp" && c.status === "expired")) return "expired";
  if (claims.some((c) => c.name === "nbf" && c.status === "pending")) return "not-yet-valid";
  return claims.some((c) => c.name === "exp") ? "valid-time" : "no-expiry";
}

/* ----------------------------------------------------------- verification */

export type KeyInput = { kind: "secret"; value: string } | { kind: "key"; value: string };

export type VerifyResult = { ok: true; valid: boolean; alg: string } | { ok: false; error: string };

const HMAC: Record<string, string> = { HS256: "SHA-256", HS384: "SHA-384", HS512: "SHA-512" };
const RSA: Record<string, string> = { RS256: "SHA-256", RS384: "SHA-384", RS512: "SHA-512", PS256: "SHA-256", PS384: "SHA-384", PS512: "SHA-512" };
const EC: Record<string, { curve: string; hash: string }> = { ES256: { curve: "P-256", hash: "SHA-256" }, ES384: { curve: "P-384", hash: "SHA-384" }, ES512: { curve: "P-521", hash: "SHA-512" } };

export function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

export async function verifyJwt(token: DecodedJwt, key: KeyInput): Promise<VerifyResult> {
  const header = token.header;
  const alg = header && typeof header === "object" && !Array.isArray(header) ? String((header as Record<string, unknown>).alg ?? "") : "";
  if (!alg) return { ok: false, error: 'The header has no "alg" field.' };
  if (alg.toLowerCase() === "none") return { ok: false, error: 'This token uses alg "none": it is unsigned, so there is nothing to verify (and it should be rejected by any server).' };
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return { ok: false, error: "Web Crypto isn't available in this browser context." };
  const data = new TextEncoder().encode(token.signingInput);
  let sig: Uint8Array;
  try {
    sig = base64UrlToBytes(token.signature);
  } catch {
    return { ok: false, error: "The signature isn't valid Base64URL." };
  }
  try {
    if (HMAC[alg]) {
      const secret = key.value;
      if (!secret) return { ok: false, error: "Enter the secret to verify an HMAC (HS) signature." };
      const k = await subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: HMAC[alg] }, false, ["verify"]);
      return { ok: true, valid: await subtle.verify("HMAC", k, sig as BufferSource, data), alg };
    }
    if (!key.value.trim()) return { ok: false, error: `Paste the public key (PEM or JWK) to verify a ${alg} signature.` };
    const isJwk = key.value.trim().startsWith("{");
    if (RSA[alg]) {
      const pss = alg.startsWith("PS");
      const algo = pss ? { name: "RSA-PSS", hash: RSA[alg] } : { name: "RSASSA-PKCS1-v1_5", hash: RSA[alg] };
      const k = isJwk ? await subtle.importKey("jwk", JSON.parse(key.value), algo, false, ["verify"]) : await subtle.importKey("spki", pemToDer(key.value) as BufferSource, algo, false, ["verify"]);
      const params = pss ? { name: "RSA-PSS", saltLength: Number(RSA[alg].slice(4)) / 8 } : "RSASSA-PKCS1-v1_5";
      return { ok: true, valid: await subtle.verify(params, k, sig as BufferSource, data), alg };
    }
    if (EC[alg]) {
      const algo = { name: "ECDSA", namedCurve: EC[alg].curve };
      const k = isJwk ? await subtle.importKey("jwk", JSON.parse(key.value), algo, false, ["verify"]) : await subtle.importKey("spki", pemToDer(key.value) as BufferSource, algo, false, ["verify"]);
      return { ok: true, valid: await subtle.verify({ name: "ECDSA", hash: EC[alg].hash }, k, sig as BufferSource, data), alg };
    }
    return { ok: false, error: `The algorithm ${alg} isn't supported for verification here (HS, RS, PS and ES are).` };
  } catch (e) {
    return { ok: false, error: `Could not use that key: ${e instanceof Error ? e.message : "invalid key"}. A public key PEM starts with -----BEGIN PUBLIC KEY-----.` };
  }
}

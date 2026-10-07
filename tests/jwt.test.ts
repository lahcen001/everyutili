import { describe, expect, it } from "vitest";
import { base64UrlToBytes, bytesToBase64Url, decodeJwt, describeClaims, relativeTime, timeState, verifyJwt } from "@/lib/jwt";

const enc = (o: unknown) => bytesToBase64Url(new TextEncoder().encode(JSON.stringify(o)));

async function sign(header: object, payload: object, alg: "HS256" | "ES256"): Promise<{ token: string; spki?: string; secret?: string }> {
  const input = `${enc(header)}.${enc(payload)}`;
  const data = new TextEncoder().encode(input);
  if (alg === "HS256") {
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode("s3cret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
    return { token: `${input}.${bytesToBase64Url(sig)}`, secret: "s3cret" };
  }
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, data));
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const pem = `-----BEGIN PUBLIC KEY-----\n${btoa(String.fromCharCode(...spki))}\n-----END PUBLIC KEY-----`;
  return { token: `${input}.${bytesToBase64Url(sig)}`, spki: pem };
}

describe("decodeJwt", () => {
  it("decodes header and payload, accepts a Bearer prefix", async () => {
    const { token } = await sign({ alg: "HS256", typ: "JWT" }, { sub: "42", name: "Ada" }, "HS256");
    const r = decodeJwt(`Bearer ${token}`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.token.header).toEqual({ alg: "HS256", typ: "JWT" });
      expect(r.token.payload).toEqual({ sub: "42", name: "Ada" });
    }
  });
  it("handles non-object payloads without crashing", () => {
    const t = `${enc({ alg: "none" })}.${enc(null)}.`;
    const r = decodeJwt(t);
    expect(r.ok && r.token.payload).toBeNull();
    expect(r.ok && describeClaims(r.token.payload, 0)).toEqual([]);
  });
  it("explains malformed input", () => {
    expect(decodeJwt("").ok).toBe(false);
    expect(decodeJwt("a.b").ok).toBe(false);
    expect(decodeJwt("a.b.c.d.e")).toMatchObject({ ok: false, error: expect.stringContaining("JWE") });
    expect(decodeJwt("@@@.e30.x")).toMatchObject({ ok: false });
    expect(decodeJwt(`${bytesToBase64Url(new TextEncoder().encode("not json"))}.e30.x`)).toMatchObject({ ok: false, error: expect.stringContaining("JSON") });
  });
  it("round-trips base64url with unicode", () => {
    const bytes = new TextEncoder().encode("héllo ✓");
    expect(new TextDecoder().decode(base64UrlToBytes(bytesToBase64Url(bytes)))).toBe("héllo ✓");
  });
});

describe("claims", () => {
  const now = 1_700_000_000;
  it("describes exp / nbf / iat relative to now", () => {
    const c = describeClaims({ iat: now - 3600, nbf: now + 60, exp: now - 10 }, now);
    expect(c.map((x) => x.name)).toEqual(["iat", "nbf", "exp"]);
    expect(c.find((x) => x.name === "exp")).toMatchObject({ status: "expired", relative: "10 seconds ago" });
    expect(c.find((x) => x.name === "nbf")).toMatchObject({ status: "pending", relative: "in 1 minute" });
  });
  it("ignores non-numeric dates", () => {
    expect(describeClaims({ exp: "tomorrow" }, now)).toEqual([]);
  });
  it("time state never claims the token is genuine", () => {
    expect(timeState({ exp: now + 100 }, now)).toBe("valid-time");
    expect(timeState({ exp: now - 1 }, now)).toBe("expired");
    expect(timeState({ nbf: now + 5, exp: now + 100 }, now)).toBe("not-yet-valid");
    expect(timeState({}, now)).toBe("no-expiry");
  });
  it("relativeTime", () => {
    expect(relativeTime(7200)).toBe("in 2 hours");
    expect(relativeTime(-86400 * 3)).toBe("3 days ago");
  });
});

describe("verifyJwt", () => {
  it("verifies HS256 and rejects a wrong secret or tampered payload", async () => {
    const { token } = await sign({ alg: "HS256" }, { a: 1 }, "HS256");
    const d = decodeJwt(token);
    if (!d.ok) throw new Error("decode");
    expect(await verifyJwt(d.token, { kind: "secret", value: "s3cret" })).toEqual({ ok: true, valid: true, alg: "HS256" });
    expect(await verifyJwt(d.token, { kind: "secret", value: "nope" })).toMatchObject({ ok: true, valid: false });
    const [h, , s] = token.split(".");
    const tampered = decodeJwt(`${h}.${enc({ a: 2 })}.${s}`);
    if (!tampered.ok) throw new Error("decode");
    expect(await verifyJwt(tampered.token, { kind: "secret", value: "s3cret" })).toMatchObject({ valid: false });
  });
  it("verifies ES256 with a PEM public key", async () => {
    const { token, spki } = await sign({ alg: "ES256" }, { a: 1 }, "ES256");
    const d = decodeJwt(token);
    if (!d.ok) throw new Error("decode");
    expect(await verifyJwt(d.token, { kind: "key", value: spki! })).toEqual({ ok: true, valid: true, alg: "ES256" });
    const other = await sign({ alg: "ES256" }, { a: 1 }, "ES256");
    expect(await verifyJwt(d.token, { kind: "key", value: other.spki! })).toMatchObject({ valid: false });
  });
  it("reports missing keys, none and unsupported algorithms", async () => {
    const hs = decodeJwt((await sign({ alg: "HS256" }, {}, "HS256")).token);
    if (!hs.ok) throw new Error("decode");
    expect(await verifyJwt(hs.token, { kind: "secret", value: "" })).toMatchObject({ ok: false });
    const none = decodeJwt(`${enc({ alg: "none" })}.${enc({})}.`);
    if (!none.ok) throw new Error("decode");
    expect(await verifyJwt(none.token, { kind: "secret", value: "x" })).toMatchObject({ ok: false, error: expect.stringContaining("none") });
    const weird = decodeJwt(`${enc({ alg: "XX1" })}.${enc({})}.abc`);
    if (!weird.ok) throw new Error("decode");
    expect(await verifyJwt(weird.token, { kind: "key", value: "k" })).toMatchObject({ ok: false });
    const rs = decodeJwt(`${enc({ alg: "RS256" })}.${enc({})}.abc`);
    if (!rs.ok) throw new Error("decode");
    expect(await verifyJwt(rs.token, { kind: "key", value: "not a key" })).toMatchObject({ ok: false, error: expect.stringContaining("key") });
  });
});

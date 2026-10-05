import { describe, expect, it } from "vitest";
import { constantTimeEqual, decodeDigest, encodeDigest, parseHex } from "@/lib/hmac";

describe("hmac helpers", () => {
  it("encodes digests", () => {
    const b = Uint8Array.from([0xfb, 0xff, 0x01]);
    expect(encodeDigest(b, "hex")).toBe("fbff01");
    expect(encodeDigest(b, "hex", true)).toBe("FBFF01");
    expect(encodeDigest(b, "base64")).toBe("+/8B");
    expect(encodeDigest(b, "base64url")).toBe("-_8B");
  });
  it("decodes hex and base64 forms", () => {
    expect(Array.from(decodeDigest("FBFF01")!)).toEqual([0xfb, 0xff, 1]);
    expect(Array.from(decodeDigest("+/8B")!)).toEqual([0xfb, 0xff, 1]);
    expect(Array.from(decodeDigest("-_8B")!)).toEqual([0xfb, 0xff, 1]);
    expect(decodeDigest("")).toBeNull();
  });
  it("parseHex rejects bad input", () => {
    expect(parseHex("abc")).toBeNull();
    expect(parseHex("zz")).toBeNull();
    expect(Array.from(parseHex("0xAB cd")!)).toEqual([0xab, 0xcd]);
  });
  it("constant-time compare", () => {
    expect(constantTimeEqual(Uint8Array.from([1, 2]), Uint8Array.from([1, 2]))).toBe(true);
    expect(constantTimeEqual(Uint8Array.from([1, 2]), Uint8Array.from([1, 3]))).toBe(false);
    expect(constantTimeEqual(Uint8Array.from([1]), Uint8Array.from([1, 0]))).toBe(false);
  });
});

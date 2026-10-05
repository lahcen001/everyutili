import { describe, expect, it } from "vitest";
import { base64ToBytes, buildDataUri, bytesToBase64, bytesToText, encodeText, looksLikeBase64, parseDataUri, sniffFileType } from "@/lib/base64";

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("encode / decode", () => {
  it("round-trips UTF-8 text, including emoji and CJK", () => {
    const sample = "héllo wörld 😀 日本語 — ok";
    expect(text(base64ToBytes(encodeText(sample)))).toBe(sample);
  });

  it("matches known vectors", () => {
    expect(encodeText("Hello")).toBe("SGVsbG8=");
    expect(encodeText("")).toBe("");
    expect(text(base64ToBytes("SGVsbG8="))).toBe("Hello");
  });

  it("supports URL-safe output and unpadded output", () => {
    const bytes = new Uint8Array([251, 255, 254]);
    expect(bytesToBase64(bytes)).toBe("+//+");
    expect(bytesToBase64(bytes, { urlSafe: true })).toBe("-__-");
    expect(bytesToBase64(new Uint8Array([1]), { padding: false })).toBe("AQ");
    expect([...base64ToBytes("-__-")]).toEqual([251, 255, 254]);
  });

  it("wraps at 76 characters like MIME", () => {
    const out = bytesToBase64(new Uint8Array(200).fill(7), { wrap: true });
    const lines = out.split("\n");
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.slice(0, -1).every((l) => l.length === 76)).toBe(true);
    expect(base64ToBytes(out)).toHaveLength(200);
  });

  it("handles large inputs without overflowing the call stack", () => {
    const big = new Uint8Array(300_000).map((_, i) => i % 251);
    expect(base64ToBytes(bytesToBase64(big))).toEqual(big);
  });
});

describe("tolerant decoding", () => {
  it("accepts whitespace, missing padding and data URIs", () => {
    expect(text(base64ToBytes("SGVs\n bG8"))).toBe("Hello");
    expect(text(base64ToBytes("data:text/plain;base64,SGVsbG8="))).toBe("Hello");
    expect(text(base64ToBytes("data:text/plain;charset=utf-8;base64,SGVsbG8="))).toBe("Hello");
  });
  it("rejects invalid characters and impossible lengths", () => {
    expect(() => base64ToBytes("not base64!")).toThrow(/Invalid Base64/);
    expect(() => base64ToBytes("A")).toThrow(/Invalid Base64/);
  });
});

describe("data URIs and detection", () => {
  it("parses and builds data URIs", () => {
    expect(parseDataUri("data:image/png;base64,AAAA")).toEqual({ mime: "image/png", base64: "AAAA" });
    expect(parseDataUri("hello")).toBeNull();
    expect(buildDataUri("image/png", "AA\nAA")).toBe("data:image/png;base64,AAAA");
  });
  it("recognises likely Base64 without flagging ordinary words", () => {
    expect(looksLikeBase64("SGVsbG8gV29ybGQh")).toBe(true);
    expect(looksLikeBase64("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==")).toBe(true);
    expect(looksLikeBase64("hello")).toBe(false);
    expect(looksLikeBase64("This is a normal sentence.")).toBe(false);
  });
  it("tells text from binary and sniffs common file types", () => {
    expect(bytesToText(new TextEncoder().encode("ok ✓"))).toEqual({ text: "ok ✓", valid: true });
    expect(bytesToText(new Uint8Array([0xff, 0xfe, 0xfd])).valid).toBe(false);
    expect(sniffFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))?.extension).toBe("png");
    expect(sniffFileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffFileType(new Uint8Array([0x25, 0x50, 0x44, 0x46]))?.extension).toBe("pdf");
    expect(sniffFileType(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

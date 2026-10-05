import { describe, expect, it } from "vitest";
import { decodeUrl, encodeUrl, parseUrl } from "@/lib/urlCodec";

describe("urlCodec", () => {
  it("component vs uri", () => {
    expect(encodeUrl("a b/c?d=é", "component")).toBe("a%20b%2Fc%3Fd%3D%C3%A9");
    expect(encodeUrl("https://x.com/a b?q=é", "uri")).toBe("https://x.com/a%20b?q=%C3%A9");
  });
  it("form encoding uses +", () => {
    expect(encodeUrl("a b&c", "form")).toBe("a+b%26c");
    expect(decodeUrl("a+b%26c", "form")).toBe("a b&c");
    expect(decodeUrl("a+b", "component")).toBe("a+b");
  });
  it("throws on malformed", () => {
    expect(() => decodeUrl("%E0%A4%A", "component")).toThrow();
  });
  it("parses urls", () => {
    const p = parseUrl("https://ex.com:8080/p?a=1&b=x%20y#top")!;
    expect(p.params).toEqual([{ key: "a", value: "1" }, { key: "b", value: "x y" }]);
    expect(p.parts.find((x) => x.label === "Host")?.value).toBe("ex.com:8080");
    expect(parseUrl("nope")).toBeNull();
  });
});

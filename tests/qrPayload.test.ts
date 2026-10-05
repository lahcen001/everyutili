import { describe, expect, it } from "vitest";
import { contrastRatio, emailPayload, isInverted, normalizeUrl, phonePayload, smsPayload, vcardPayload, wifiPayload } from "@/lib/qrPayload";

describe("qrPayload", () => {
  it("builds wifi payloads and escapes specials", () => {
    expect(wifiPayload({ ssid: "Home", password: "pass", security: "WPA", hidden: false })).toBe("WIFI:T:WPA;S:Home;P:pass;;");
    const B = String.fromCharCode(92);
    const got = wifiPayload({ ssid: "a;b", password: 'x"y:z,' + B, security: "WPA", hidden: true });
    expect(got).toBe("WIFI:T:WPA;S:a" + B + ";b;P:x" + B + "\"y" + B + ":z" + B + "," + B + B + ";H:true;;");
    expect(wifiPayload({ ssid: "Open", password: "ignored", security: "nopass", hidden: false })).toBe("WIFI:T:nopass;S:Open;;");
  });
  it("builds mailto, tel, sms", () => {
    expect(emailPayload({ to: "a@b.com", subject: "Hi there", body: "x&y" })).toBe("mailto:a@b.com?subject=Hi%20there&body=x%26y");
    expect(emailPayload({ to: "a@b.com", subject: "", body: "" })).toBe("mailto:a@b.com");
    expect(phonePayload("+1 (555) 010-9999")).toBe("tel:+15550109999");
    expect(smsPayload("555 0100", "hello")).toBe("SMSTO:5550100:hello");
  });
  it("builds a vCard", () => {
    const v = vcardPayload({ first: "Ada", last: "Lovelace", org: "A, B", title: "", phone: "+1555", email: "a@x.io", url: "" });
    expect(v).toContain("N:Lovelace;Ada;;;");
    expect(v).toContain("ORG:A\\, B");
    expect(v.startsWith("BEGIN:VCARD")).toBe(true);
    expect(v.endsWith("END:VCARD")).toBe(true);
  });
  it("normalizes urls", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl("http://x.y")).toBe("http://x.y");
    expect(normalizeUrl("  ")).toBe("");
  });
  it("contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#777777", "#888888")).toBeLessThan(2);
    expect(isInverted("#ffffff", "#000000")).toBe(true);
    expect(isInverted("#000000", "#ffffff")).toBe(false);
  });
});

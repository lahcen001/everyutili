// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize";

describe("sanitizeHtml", () => {
  it("removes scripts, event handlers and javascript links but keeps normal markup", () => {
    const out = sanitizeHtml('<p onclick="x()">Hi <b>there</b></p><script>alert(1)</script><a href="javascript:alert(1)">bad</a><img src=x onerror=alert(1)>');
    expect(out).toContain("<b>there</b>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("javascript:");
  });
});

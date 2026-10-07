import { describe, expect, it } from "vitest";
import { DEFAULT_OG, buildMetaTags, buildMetadataObject, domainFromUrl, escapeHtmlAttr, escapeJsString, isValidHttpUrl, truncate } from "@/lib/ogTags";

describe("ogTags", () => {
  it("escapes quotes and angle brackets in HTML attributes", () => {
    const html = buildMetaTags({ ...DEFAULT_OG, title: 'He said "hi" <b>&', description: "a & b" });
    expect(html).toContain('content="He said &quot;hi&quot; &lt;b&gt;&amp;"');
    expect(html).toContain('content="a &amp; b"');
    expect(html).not.toContain('<b>&"');
  });
  it("omits tags with no value and image sub-tags without an image", () => {
    const html = buildMetaTags({ ...DEFAULT_OG, imageUrl: "", twitterCreator: "" });
    expect(html).not.toContain("og:image");
    expect(html).not.toContain("twitter:image");
    expect(html).not.toContain("twitter:creator");
    expect(html).not.toContain('content=""');
  });
  it("adds image details and normalises the twitter handle", () => {
    const html = buildMetaTags({ ...DEFAULT_OG, imageUrl: "https://x.com/i.png", imageAlt: "Logo", twitterCreator: "ada" });
    expect(html).toContain('og:image:width" content="1200"');
    expect(html).toContain('og:image:alt" content="Logo"');
    expect(html).toContain('twitter:creator" content="@ada"');
  });
  it("escapes quotes, backslashes and newlines in the Next.js metadata", () => {
    const code = buildMetadataObject({ ...DEFAULT_OG, title: 'A "quoted" \\ title', description: "line1\nline2" });
    expect(code).toContain('title: "A ' + String.fromCharCode(92) + '"quoted' + String.fromCharCode(92) + '" ' + String.fromCharCode(92) + String.fromCharCode(92) + ' title"');
    expect(code).toContain('description: "line1' + String.fromCharCode(92) + 'nline2"');
    expect(code).toContain("openGraph: {");
    expect(code).toContain('card: "summary_large_image"');
  });
  it("helpers", () => {
    expect(escapeHtmlAttr('<"&>')).toBe("&lt;&quot;&amp;&gt;");
    expect(escapeJsString('a"b' + String.fromCharCode(92) + 'c')).toBe('a' + String.fromCharCode(92) + '"b' + String.fromCharCode(92) + String.fromCharCode(92) + 'c');
    expect(domainFromUrl("https://www.example.com/a?b")).toBe("example.com");
    expect(truncate("abcdef", 3)).toBe("abc…");
    expect(isValidHttpUrl("https://x.com")).toBe(true);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "pt", "ru", "zh-CN"] },
  defaultLocale: "en",
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => k, getMessages: async () => ({}) }));

import { TOOLS, getToolBySlug } from "@/config/tools";
import { generateToolJsonLd, generateToolMetadata } from "@/lib/seo";
import { buildBreadcrumbSchema, buildFaqSchema, buildHowToSchema, buildWebApplicationSchema } from "@/lib/schema";
import { buildLlmsTxt } from "@/lib/llms";
import { mediaTypeForBlob, pipelineSlugsFor } from "@/lib/pipelineTools";
import { encodeGif } from "@/lib/gifEncoder";

const tool = getToolBySlug("jpg-to-png")!;
const content = {
  seoTitle: "JPG to PNG",
  metaDescription: "Convert JPG to PNG in your browser.",
  h1: "JPG to PNG Converter",
  subheading: "Convert images privately.",
  quickAnswer: "x",
  keywords: ["jpg to png"],
  howTo: [{ name: "Drop", text: "Drop a file." }, { name: "Convert", text: "Press convert." }],
  faq: [{ question: "Is it free?", answer: "Yes." }],
};

describe("structured data", () => {
  it("describes the tool as a free web application", () => {
    const s = buildWebApplicationSchema(tool, content, "fr");
    expect(s["@type"]).toBe("WebApplication");
    expect(s.url).toContain("/fr/tools/media/jpg-to-png");
    expect(s.offers.price).toBe("0.00");
    expect(s.inLanguage).toBe("fr");
  });
  it("numbers the how-to steps and lists every FAQ", () => {
    const h = buildHowToSchema(tool, content, "en");
    expect(h.step.map((x) => x.position)).toEqual([1, 2]);
    const f = buildFaqSchema(content, "en");
    expect(f.mainEntity).toHaveLength(1);
    expect(f.mainEntity[0]["@type"]).toBe("Question");
  });
  it("builds a breadcrumb trail and the full stack in order", () => {
    const b = buildBreadcrumbSchema(tool, "en", "Media", "Home");
    expect(b["@type"]).toBe("BreadcrumbList");
    expect(b.itemListElement.length).toBeGreaterThanOrEqual(3);
    expect(generateToolJsonLd(tool, content, "en", "Media", "Home").map((x) => x["@type"])).toEqual(["WebApplication", "HowTo", "FAQPage", "BreadcrumbList"]);
  });
});

describe("metadata", () => {
  it("has a canonical URL and all hreflang alternates", () => {
    const m = generateToolMetadata(tool, content, "ja");
    expect(m.alternates?.canonical).toContain("/ja/tools/media/jpg-to-png");
    expect(Object.keys(m.alternates?.languages ?? {})).toHaveLength(13);
    expect(m.title).toBe("JPG to PNG");
  });
});

describe("llms.txt", () => {
  it("links every tool", () => {
    const text = buildLlmsTxt();
    expect(text.startsWith("# EveryUtili")).toBe(true);
    for (const t of TOOLS.slice(0, 20)) expect(text).toContain(t.slug);
  });
});

describe("pipeline helpers", () => {
  it("classifies blobs and lists destinations", () => {
    expect(mediaTypeForBlob(new Blob([""], { type: "image/png" }))).toBe("image");
    expect(mediaTypeForBlob(new Blob([""], { type: "video/mp4" }))).toBe("video");
    expect(mediaTypeForBlob(new Blob([""], { type: "text/plain" }))).toBeNull();
    expect(pipelineSlugsFor("image")).toContain("image-compressor");
    expect(pipelineSlugsFor("video")).toContain("video-trimmer");
  });
});

describe("GIF encoder", () => {
  it("writes a valid animated GIF89a", async () => {
    const frame = (r: number) => ({ width: 4, height: 4, delayCs: 10, data: new Uint8ClampedArray(Array.from({ length: 16 }, () => [r, 0, 255 - r, 255]).flat()) });
    const blob = encodeGif([frame(0), frame(255)]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe("GIF89a");
    expect(bytes[bytes.length - 1]).toBe(0x3b);
    expect(String.fromCharCode(...bytes)).toContain("NETSCAPE2.0");
  });
});

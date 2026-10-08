// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "pt", "ru", "zh-CN"] },
  defaultLocale: "en",
}));

import { CATEGORIES, TOOLS } from "@/config/tools";
import { TOOL_COMPONENT_LOADERS } from "@/config/tool-components";
import { buildLanguageAlternates } from "@/lib/alternates";
import { routing } from "@/i18n/routing";
import { IMAGE_PIPELINE_SLUGS, VIDEO_PIPELINE_SLUGS } from "@/lib/pipelineTools";

const dir = path.join(process.cwd(), "messages");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const load = (f: string) => JSON.parse(readFileSync(path.join(dir, f), "utf-8"));
const en = load("en.json");

const keysOf = (o: unknown, prefix = ""): string[] =>
  o && typeof o === "object" && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => keysOf(v, `${prefix}${k}.`)) : [prefix.slice(0, -1)];

describe("tool registry", () => {
  it("has unique slugs, a component and English copy for every tool", () => {
    const slugs = TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const t of TOOLS) {
      expect(TOOL_COMPONENT_LOADERS[t.slug], `loader for ${t.slug}`).toBeTypeOf("function");
      expect(en.tools[t.slug], `English copy for ${t.slug}`).toBeTruthy();
      expect(CATEGORIES).toContain(t.category);
      for (const r of t.relatedSlugs) expect(slugs, `${t.slug} related → ${r}`).toContain(r);
    }
    for (const slug of Object.keys(TOOL_COMPONENT_LOADERS)) expect(slugs, `loader without tool: ${slug}`).toContain(slug);
  });
  it("only sends files to tools that exist", () => {
    const slugs = TOOLS.map((t) => t.slug);
    for (const s of [...IMAGE_PIPELINE_SLUGS, ...VIDEO_PIPELINE_SLUGS]) expect(slugs).toContain(s);
  });
});

describe("translations", () => {
  it("keeps the router and the message files on the same locale list", () => {
    const src = readFileSync(path.join(process.cwd(), "i18n/routing.ts"), "utf-8");
    for (const f of files) expect(src, `routing.ts mentions ${f}`).toContain(`"${f.replace(".json", "")}"`);
  });
  it("has a file for every locale in the router", () => {
    expect(files.map((f) => f.replace(".json", "")).sort()).toEqual([...routing.locales].sort());
  });

  for (const file of files) {
    const locale = file.replace(".json", "");
    const messages = load(file);

    it(`${locale}: has every tool with complete page copy`, () => {
      for (const t of TOOLS) {
        const c = messages.tools?.[t.slug];
        expect(c, `${locale}/${t.slug}`).toBeTruthy();
        for (const k of ["seoTitle", "metaDescription", "h1", "subheading"]) expect(typeof c[k] === "string" && c[k].trim().length > 0, `${locale}/${t.slug}.${k}`).toBe(true);
        expect(Array.isArray(c.keywords) && c.keywords.length > 0, `${locale}/${t.slug}.keywords`).toBe(true);
        expect(c.howTo?.length, `${locale}/${t.slug}.howTo`).toBe(en.tools[t.slug].howTo.length);
        expect(c.faq?.length, `${locale}/${t.slug}.faq`).toBe(en.tools[t.slug].faq.length);
      }
    });

    it(`${locale}: has every category label`, () => {
      for (const c of CATEGORIES) for (const k of ["label", "description", "navLabel"]) expect(messages.categories?.[c]?.[k], `${locale}/${c}.${k}`).toBeTruthy();
    });

    it(`${locale}: has exactly the same message keys as English outside tool pages`, () => {
      const strip = (m: Record<string, unknown>) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== "tools"));
      expect(keysOf(strip(messages)).sort()).toEqual(keysOf(strip(en)).sort());
    });

    it(`${locale}: every UI message is valid ICU syntax`, () => {
      const bad: string[] = [];
      const walk = (o: unknown, p: string) => {
        if (typeof o === "string") {
          try {
            new IntlMessageFormat(o, locale === "zh-CN" ? "zh" : locale);
          } catch {
            bad.push(p);
          }
        } else if (Array.isArray(o)) o.forEach((v, i) => walk(v, `${p}[${i}]`));
        else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) if (k !== "tools") walk(v, p ? `${p}.${k}` : k);
      };
      walk(messages, "");
      expect(bad).toEqual([]);
    });
  }
});

describe("hreflang alternates", () => {
  it("covers every locale plus x-default with absolute URLs", () => {
    const a = buildLanguageAlternates((l) => `/${l}/x`);
    for (const l of routing.locales) expect(a[l]).toMatch(new RegExp(`^https?://.+/${l}/x$`));
    expect(a["x-default"]).toContain("/x");
    expect(Object.keys(a)).toHaveLength(routing.locales.length + 1);
  });
});

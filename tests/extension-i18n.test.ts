// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const EXT = path.join(process.cwd(), "extension");
const read = (rel: string) => readFileSync(path.join(EXT, rel), "utf-8");

interface I18n {
  init: () => Promise<void>;
  tr: (key: string, subs?: unknown) => string;
  categoryLabel: (slug: string) => string;
  setLanguage: (value: string, cb?: () => void) => void;
  code: string;
  preference: string;
  LANGUAGES: { code: string }[];
}
type Tool = { slug: string; name: string; enName?: string; keywords: string[]; tagline: string };

/** Loads extension/i18n.js against a fake chrome API, a file-backed fetch and a fresh copy of the tool list. */
function load(opts: { ui: string; navigator?: string[]; stored?: Record<string, unknown> }) {
  const store: Record<string, unknown> = { ...(opts.stored ? { everyutili_settings: opts.stored } : {}) };
  const w = window as unknown as Record<string, unknown>;
  w.chrome = {
    i18n: { getUILanguage: () => opts.ui },
    runtime: { lastError: undefined },
    storage: {
      local: {
        get: (key: string, cb: (r: Record<string, unknown>) => void) => cb({ [key]: store[key] }),
        set: (obj: Record<string, unknown>, cb?: () => void) => {
          Object.assign(store, obj);
          cb?.();
        },
      },
    },
  };
  Object.defineProperty(navigator, "languages", { value: opts.navigator ?? [], configurable: true });
  Object.defineProperty(navigator, "language", { value: (opts.navigator ?? [])[0] ?? "", configurable: true });
  w.fetch = (url: string) => {
    try {
      const text = read(url);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(text)) });
    } catch {
      return Promise.resolve({ ok: false, json: () => Promise.reject(new Error("missing")) });
    }
  };
  const data = new Function(`${read("tools-data.js").replace(/if \(typeof module[\s\S]*$/, "")}; return { EVERYUTILI_TOOLS, EVERYUTILI_CATEGORIES };`)() as { EVERYUTILI_TOOLS: Tool[]; EVERYUTILI_CATEGORIES: unknown[] };
  w.EVERYUTILI_TOOLS = data.EVERYUTILI_TOOLS;
  w.EVERYUTILI_CATEGORIES = data.EVERYUTILI_CATEGORIES;
  new Function(read("i18n.js"))();
  return { i18n: w.EveryUtiliI18n as I18n, tools: data.EVERYUTILI_TOOLS, store };
}

beforeEach(() => {
  document.documentElement.className = "i18n-pending";
  document.documentElement.removeAttribute("dir");
});

describe("extension language", () => {
  it("follows the browser language by default", async () => {
    const { i18n, tools } = load({ ui: "ja-JP" });
    await i18n.init();
    expect(i18n.code).toBe("ja");
    expect(i18n.preference).toBe("auto");
    expect(i18n.tr("quickAccessTitle")).not.toBe("Quick access");
    expect(tools.find((t) => t.slug === "json-formatter")!.name).toBe("JSON整形・検証ツール");
    expect(document.documentElement.lang).toBe("ja");
    expect(document.documentElement.classList.contains("i18n-pending")).toBe(false);
  });

  it("falls back to English when the browser language isn't supported", async () => {
    const { i18n, tools } = load({ ui: "ko-KR", navigator: ["ko-KR", "ko"] });
    await i18n.init();
    expect(i18n.code).toBe("en");
    expect(i18n.tr("quickAccessTitle")).toBe("Quick access");
    expect(tools.find((t) => t.slug === "json-formatter")!.name).toBe("JSON Formatter");
  });

  it("uses a later browser language when the UI language isn't supported", async () => {
    const { i18n } = load({ ui: "ko-KR", navigator: ["ko-KR", "fr-CA", "en"] });
    await i18n.init();
    expect(i18n.code).toBe("fr");
  });

  it("maps regional variants, keeps Simplified Chinese only, and sets RTL for Arabic", async () => {
    let r = load({ ui: "pt-BR" });
    await r.i18n.init();
    expect(r.i18n.code).toBe("pt");
    r = load({ ui: "zh-CN" });
    await r.i18n.init();
    expect(r.i18n.code).toBe("zh-CN");
    r = load({ ui: "zh-TW" });
    await r.i18n.init();
    expect(r.i18n.code).toBe("en");
    r = load({ ui: "ar-EG" });
    await r.i18n.init();
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("lets the user pick a language that overrides the system one", async () => {
    const { i18n, store } = load({ ui: "en-US", stored: { defaultEngine: "google", language: "de" } });
    await i18n.init();
    expect(i18n.code).toBe("de");
    expect(i18n.preference).toBe("de");
    await new Promise<void>((resolve) => i18n.setLanguage("es", resolve));
    expect((store.everyutili_settings as { language: string; defaultEngine: string }).language).toBe("es");
    expect((store.everyutili_settings as { defaultEngine: string }).defaultEngine).toBe("google");
    await new Promise<void>((resolve) => i18n.setLanguage("auto", resolve));
    expect((store.everyutili_settings as { language: string }).language).toBe("auto");
  });

  it("ignores a stored language it doesn't know", async () => {
    const { i18n } = load({ ui: "it-IT", stored: { language: "klingon" } });
    await i18n.init();
    expect(i18n.code).toBe("it");
    expect(i18n.preference).toBe("auto");
  });

  it("fills placeholders and falls back to English text for missing keys", async () => {
    const { i18n } = load({ ui: "fr-FR" });
    await i18n.init();
    expect(i18n.tr("browseAllTools", ["106"])).toContain("106");
    expect(i18n.tr("browseAllTools", ["106"])).not.toContain("$");
    expect(i18n.tr("thisKeyDoesNotExist")).toBe("thisKeyDoesNotExist");
  });

  it("keeps English names searchable and localizes category labels", async () => {
    const { i18n, tools } = load({ ui: "de-DE" });
    await i18n.init();
    const t = tools.find((x) => x.slug === "jpg-to-png")!;
    expect(t.enName).toBe("JPG to PNG");
    expect(t.name).not.toBe("");
    expect(i18n.categoryLabel("random-decision")).toBeTruthy();
    expect(i18n.categoryLabel("financial")).not.toBe("Finance");
  });
});

describe("extension data", () => {
  const locales = readdirSync(path.join(EXT, "_locales"));
  const keys = (l: string) => Object.keys(JSON.parse(read(`_locales/${l}/messages.json`))).sort();

  it("has the same message keys in every language", () => {
    for (const l of locales) expect(keys(l), l).toEqual(keys("en"));
  });

  it("keeps every store description within 132 characters and every placeholder usable", () => {
    for (const l of locales) {
      const m = JSON.parse(read(`_locales/${l}/messages.json`));
      expect(m.extDescription.message.length, l).toBeLessThanOrEqual(132);
      for (const [k, v] of Object.entries(m) as [string, { message: string; placeholders?: Record<string, unknown> }][]) {
        const used = [...v.message.matchAll(/\$([A-Za-z0-9_]+)\$/g)].map((x) => x[1].toLowerCase());
        for (const name of used) expect(Object.keys(v.placeholders ?? {}).map((p) => p.toLowerCase()), `${l}.${k}`).toContain(name);
      }
    }
  });

  it("has a tool-name file for every non-English language covering every tool", () => {
    const slugs = [...read("tools-data.js").matchAll(/slug: "([^"]+)", category/g)].map((m) => m[1]);
    expect(slugs.length).toBeGreaterThan(100);
    for (const l of locales.filter((x) => x !== "en")) {
      const code = l === "zh_CN" ? "zh-CN" : l;
      const data = JSON.parse(read(`i18n/tools.${code}.json`));
      for (const s of slugs) expect(data.tools[s]?.n, `${code}/${s}`).toBeTruthy();
      expect(Object.keys(data.categories).sort()).toEqual(["developer", "document", "financial", "media", "random-decision"]);
    }
  });

  it("lists every site category in the extension", () => {
    const cats = [...read("tools-data.js").matchAll(/\{ slug: "([^"]+)", label:/g)].map((m) => m[1]);
    expect(cats).toEqual(["media", "document", "developer", "financial", "random-decision"]);
  });
});

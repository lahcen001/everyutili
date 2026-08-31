import { TOOLS, CATEGORIES, type ToolCategory } from "@/config/tools";
import { defaultLocale } from "@/i18n/routing";
import { getLocalizedTool } from "@/lib/tool-content";
import enMessages from "@/messages/en.json";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://everyutili.com";

type EnMessages = typeof enMessages;

function categoryLabel(category: ToolCategory): string {
  return (enMessages as EnMessages).categories[category].label;
}

function categoryDescription(category: ToolCategory): string {
  return (enMessages as EnMessages).categories[category].description;
}

/**
 * Builds the `/llms.txt` summary document per the emerging llms.txt
 * convention (https://llmstxt.org): a concise, link-dense Markdown index an
 * LLM can fetch to understand the site's structure before deciding whether
 * to crawl further. Content is served in English only — llms.txt is a
 * single canonical index, not a per-locale document, matching the
 * convention's own examples.
 */
export function buildLlmsTxt(): string {
  const lines: string[] = [];

  lines.push("# EveryUtili");
  lines.push("");
  lines.push(
    "> Free, privacy-first online utilities. Every tool runs entirely client-side in the " +
      "browser (Canvas API, Web Workers, WebAssembly, pdf-lib) — files are never uploaded to " +
      "a server. No sign-up, no watermarks, no artificial limits."
  );
  lines.push("");

  for (const category of CATEGORIES) {
    lines.push(`## ${categoryLabel(category)}`);
    lines.push("");
    const tools = TOOLS.filter((t) => t.category === category);
    for (const tool of tools) {
      const url = `${SITE_URL}/${defaultLocale}/tools/${tool.category}/${tool.slug}`;
      lines.push(`- [${tool.name}](${url})`);
    }
    lines.push("");
  }

  lines.push("## Full documentation");
  lines.push("");
  lines.push(`- [llms-full.txt](${SITE_URL}/llms-full.txt): every tool with a full description, inputs/outputs, and FAQ content`);
  lines.push(`- [sitemap.xml](${SITE_URL}/sitemap.xml): complete URL index across all 12 supported languages`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Builds `/llms-full.txt`: the expanded version with each tool's full
 * description, How-To steps, and FAQ content inlined as Markdown, so an LLM
 * can answer questions about the tools without a follow-up fetch per page.
 */
export async function buildLlmsFullTxt(): Promise<string> {
  const lines: string[] = [];

  lines.push("# EveryUtili — Full Tool Reference");
  lines.push("");
  lines.push(
    "> Complete technical reference for every EveryUtili utility, generated for AI/LLM " +
      "ingestion. Canonical, human-facing pages are linked per tool. All processing described " +
      "below happens 100% client-side in the user's browser."
  );
  lines.push("");

  for (const category of CATEGORIES) {
    lines.push(`## ${categoryLabel(category)}`);
    lines.push("");
    lines.push(categoryDescription(category));
    lines.push("");

    const tools = TOOLS.filter((t) => t.category === category);
    for (const tool of tools) {
      const content = await getLocalizedTool(defaultLocale, tool.slug);
      const url = `${SITE_URL}/${defaultLocale}/tools/${tool.category}/${tool.slug}`;

      lines.push(`### ${content.h1}`);
      lines.push("");
      lines.push(`URL: ${url}`);
      lines.push("");
      lines.push(content.quickAnswer);
      lines.push("");
      lines.push(`Keywords: ${content.keywords.join(", ")}`);
      lines.push("");
      lines.push("How to use:");
      content.howTo.forEach((step, i) => {
        lines.push(`${i + 1}. **${step.name}** — ${step.text}`);
      });
      lines.push("");
      lines.push("FAQ:");
      content.faq.forEach((item) => {
        lines.push(`- **Q: ${item.question}**`);
        lines.push(`  A: ${item.answer}`);
      });
      lines.push("");
    }
  }

  return lines.join("\n");
}

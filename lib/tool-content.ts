import { getTranslations, getMessages } from "next-intl/server";

import type { HowToStep, FaqItem, ComparisonTableData } from "@/config/tools";

/**
 * The translatable string content for a single tool, as stored under
 * `messages/<locale>.json` -> `tools.<slug>`. Structural fields (icon,
 * category, slug, relatedSlugs, priority, ...) stay in config/tools.ts;
 * this is only the localized copy.
 */
export interface LocalizedToolContent {
  seoTitle: string;
  metaDescription: string;
  h1: string;
  subheading: string;
  quickAnswer: string;
  keywords: string[];
  howTo: HowToStep[];
  faq: FaqItem[];
  comparisonTable?: ComparisonTableData;
}

/**
 * Builds the GEO "Quick Answer" block text: a factual definition of what the
 * tool does (h1 + subheading, which already describe input/output and the
 * "processed 100% locally" privacy model) followed by the first How-To
 * step's action, so it reads as a complete 2-sentence answer an LLM can
 * lift verbatim rather than re-deriving from prose. Deliberately composed
 * from existing, human-authored translated fields rather than a separate
 * stored string, so it can never drift out of sync with the tool's actual
 * description and doesn't require 36 x 12 new translation entries.
 */
function buildQuickAnswer(h1: string, subheading: string, firstStep?: HowToStep): string {
  const stepText = firstStep?.text;
  const howToSentence =
    typeof stepText === "string" && stepText.length > 0
      ? ` To start, ${stepText.charAt(0).toLowerCase()}${stepText.slice(1)}`
      : "";
  return `${h1} lets you: ${subheading}${howToSentence}`;
}

/**
 * Fetches the localized translatable content for one tool from
 * `messages/<locale>.json` under `tools.<slug>`. Scalar strings go through
 * the translator's ICU handling (`t()`); arrays/objects are read verbatim
 * via `t.raw()`. `comparisonTable` only exists for one tool (jpg-to-png),
 * so its presence is checked against the raw messages object directly
 * rather than via `t.raw()` + try/catch — next-intl logs (and, in some
 * configurations, rethrows) a MISSING_MESSAGE error for a genuinely absent
 * key even inside a try/catch, so a plain existence check avoids that
 * entirely instead of relying on catching it.
 */
export async function getLocalizedTool(
  locale: string,
  slug: string
): Promise<LocalizedToolContent> {
  const [t, messages] = await Promise.all([
    getTranslations({ locale, namespace: `tools.${slug}` }),
    getMessages({ locale }),
  ]);

  const toolMessages = (messages as Record<string, unknown>)?.tools as
    | Record<string, Record<string, unknown>>
    | undefined;
  const hasComparisonTable = Boolean(toolMessages?.[slug]?.comparisonTable);

  const h1 = t("h1");
  const subheading = t("subheading");
  const howTo = t.raw("howTo") as HowToStep[];

  return {
    seoTitle: t("seoTitle"),
    metaDescription: t("metaDescription"),
    h1,
    subheading,
    quickAnswer: buildQuickAnswer(h1, subheading, howTo?.[0]),
    keywords: t.raw("keywords") as string[],
    howTo,
    faq: t.raw("faq") as FaqItem[],
    comparisonTable: hasComparisonTable
      ? (t.raw("comparisonTable") as ComparisonTableData)
      : undefined,
  };
}

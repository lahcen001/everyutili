import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * A factual, 2-sentence direct-answer block placed above the fold on every
 * tool page. Written to be lifted verbatim by AI Overviews, featured
 * snippets, and LLM answer engines (Perplexity, ChatGPT Search, Gemini,
 * Claude) doing retrieval over the page — plain text, no marketing language,
 * states what the tool does, its inputs/outputs, and its privacy model.
 */
export async function QuickAnswer({
  locale,
  answer,
}: {
  locale: string;
  answer: string;
}) {
  const t = await getTranslations({ locale, namespace: "sections" });

  return (
    <div className="glass mx-auto mt-8 max-w-2xl rounded-xl p-4 text-start">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        {t("quickAnswer")}
      </p>
      <p className="text-sm leading-relaxed text-foreground">{answer}</p>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TOOLS, getToolBySlug, getRelatedTools } from "@/config/tools";
import { TOOL_COMPONENT_LOADERS } from "@/config/tool-components";
import { routing } from "@/i18n/routing";
import { getLocalizedTool } from "@/lib/tool-content";
import { generateToolMetadata, generateToolJsonLd } from "@/lib/seo";
import { ToolLayout } from "@/components/tool-shell/ToolLayout";
import { QuickAnswer } from "@/components/seo/QuickAnswer";
import { HowToSection } from "@/components/seo/HowToSection";
import { FaqSection } from "@/components/seo/FaqSection";
import { ComparisonTable } from "@/components/seo/ComparisonTable";
import { RelatedTools } from "@/components/seo/RelatedTools";
import { JsonLd } from "@/components/seo/JsonLd";

// Module-scope dynamic() map, preserved per React Compiler rules (no
// components may be created during render).
const TOOL_COMPONENTS = Object.fromEntries(
  TOOLS.map((tool) => [
    tool.slug,
    dynamic(TOOL_COMPONENT_LOADERS[tool.slug], {
      ssr: tool.ssr ?? true,
      loading: () => <ToolLoadingFallback />,
    }),
  ])
);

function ToolLoadingFallback() {
  // Static fallback text: next-intl messages aren't available inside a
  // dynamic() loading callback (it isn't a component rendered under the
  // provider tree at call time), so this stays a fixed string across
  // locales — consistent with it being a brief loading placeholder.
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      Loading tool…
    </div>
  );
}

interface ToolPageProps {
  params: Promise<{ locale: string; category: string; slug: string }>;
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    TOOLS.map((tool) => ({ locale, category: tool.category, slug: tool.slug }))
  );
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { locale, category, slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool || tool.category !== category || !hasLocale(routing.locales, locale)) {
    return {};
  }

  const content = await getLocalizedTool(locale, slug);
  return generateToolMetadata(tool, content, locale);
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { locale, category, slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool || tool.category !== category || !hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const relatedToolConfigs = getRelatedTools(tool);

  const [content, tCategories, tBreadcrumbs, relatedContents] = await Promise.all([
    getLocalizedTool(locale, slug),
    getTranslations({ locale, namespace: "categories" }),
    getTranslations({ locale, namespace: "breadcrumbs" }),
    Promise.all(relatedToolConfigs.map((t) => getLocalizedTool(locale, t.slug))),
  ]);

  const ToolComponent = TOOL_COMPONENTS[tool.slug];
  const categoryLabel = tCategories(`${tool.category}.label`);
  const relatedTools = relatedToolConfigs.map((related, i) => ({
    slug: related.slug,
    category: related.category,
    icon: related.icon,
    shortName: related.shortName,
    subheading: relatedContents[i].subheading,
  }));

  const jsonLd = generateToolJsonLd(tool, content, locale, categoryLabel, tBreadcrumbs("home"));

  return (
    <>
      {jsonLd.map((schema, i) => (
        <JsonLd key={schema["@type"] ?? i} data={schema} />
      ))}

      <ToolLayout
        h1={content.h1}
        subheading={content.subheading}
        breadcrumbs={[
          { label: categoryLabel, href: `/tools/${tool.category}` },
          { label: tool.name },
        ]}
        aboveTool={<QuickAnswer locale={locale} answer={content.quickAnswer} />}
      >
        <ToolComponent />
      </ToolLayout>

      <HowToSection steps={content.howTo} />
      {content.comparisonTable && <ComparisonTable data={content.comparisonTable} />}
      <FaqSection items={content.faq} />
      <RelatedTools tools={relatedTools} />
    </>
  );
}

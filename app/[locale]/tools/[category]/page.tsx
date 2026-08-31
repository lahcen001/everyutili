import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CATEGORIES, type ToolCategory, getToolsByCategory } from "@/config/tools";
import { routing } from "@/i18n/routing";
import { getLocalizedTool } from "@/lib/tool-content";
import { buildLanguageAlternates } from "@/lib/alternates";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { ToolGrid, type ToolGridEntry } from "@/components/tools/ToolGrid";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://everyutili.com";

interface CategoryPageProps {
  params: Promise<{ locale: string; category: string }>;
}

function isToolCategory(value: string): value is ToolCategory {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    CATEGORIES.map((category) => ({ locale, category }))
  );
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale, category } = await params;
  if (!isToolCategory(category) || !hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "categories" });
  const url = `${SITE_URL}/${locale}/tools/${category}`;
  const pathForLocale = (l: string) => `/${l}/tools/${category}`;

  return {
    title: `${t(`${category}.label`)} – Free Online Tools`,
    description: t(`${category}.description`),
    alternates: {
      canonical: url,
      languages: buildLanguageAlternates(pathForLocale),
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { locale, category } = await params;
  if (!isToolCategory(category) || !hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  const [tCategories, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "categories" }),
    getTranslations({ locale, namespace: "common" }),
  ]);

  const label = tCategories(`${category}.label`);
  const description = tCategories(`${category}.description`);

  const toolConfigs = getToolsByCategory(category);
  const localizedContents = await Promise.all(
    toolConfigs.map((tool) => getLocalizedTool(locale, tool.slug))
  );

  const tools: ToolGridEntry[] = toolConfigs.map((tool, i) => ({
    slug: tool.slug,
    category: tool.category,
    name: tool.name,
    shortName: tool.shortName,
    subheading: localizedContents[i].subheading,
    keywords: localizedContents[i].keywords,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs items={[{ label }]} />
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{label}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>

      <div className="mt-8">
        <ToolGrid
          tools={tools}
          searchPlaceholder={tCommon("categorySearchPlaceholder", { category: label.toLowerCase() })}
        />
      </div>
    </div>
  );
}

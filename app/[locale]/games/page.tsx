import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { ToolGrid, type ToolGridEntry } from "@/components/tools/ToolGrid";
import { routing } from "@/i18n/routing";
import { buildLanguageAlternates } from "@/lib/alternates";
import { getGameTools } from "@/lib/games";
import { getLocalizedTool } from "@/lib/tool-content";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://everyutili.com";

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "games" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: `${SITE_URL}/${locale}/games`, languages: buildLanguageAlternates((l) => `/${l}/games`) },
  };
}

export default async function GamesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [t, tGroups] = await Promise.all([
    getTranslations({ locale, namespace: "games" }),
    getTranslations({ locale, namespace: "toolGroups" }),
  ]);
  const configs = getGameTools();
  const contents = await Promise.all(configs.map((tool) => getLocalizedTool(locale, tool.slug)));
  const tools: ToolGridEntry[] = configs.map((tool, i) => ({
    slug: tool.slug,
    category: tool.category,
    name: tool.name,
    shortName: tool.shortName,
    subheading: contents[i].subheading,
    keywords: contents[i].keywords,
    group: tool.group,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs items={[{ label: t("title") }]} />
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("subtitle", { count: configs.length })}</p>
      <div className="mt-8">
        <ToolGrid tools={tools} searchPlaceholder={t("search")} groupLabels={{ fun: tGroups("fun"), train: tGroups("train") }} />
      </div>
    </div>
  );
}

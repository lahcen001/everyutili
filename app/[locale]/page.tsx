import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CATEGORIES, TOOLS } from "@/config/tools";
import { routing } from "@/i18n/routing";
import { getLocalizedTool } from "@/lib/tool-content";
import { buildLanguageAlternates } from "@/lib/alternates";
import { Link } from "@/i18n/routing";
import { HeroSection } from "@/components/home/HeroSection";
import { RecentToolsShelf } from "@/components/home/RecentToolsShelf";
import { CategoryToolSection } from "@/components/home/CategoryToolSection";
import type { BentoTool } from "@/components/home/BentoToolGrid";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://everyutili.com";

interface HomeProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: HomeProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const url = `${SITE_URL}/${locale}`;
  const pathForLocale = (l: string) => `/${l}`;

  return {
    alternates: {
      canonical: url,
      languages: buildLanguageAlternates(pathForLocale),
    },
  };
}

export default async function Home({ params }: HomeProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return null;

  setRequestLocale(locale);

  const [tSite, tNav, tCategories] = await Promise.all([
    getTranslations({ locale, namespace: "site" }),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "categories" }),
  ]);

  // Every tool in the category (sorted most-used-first by editorial
  // priority) is localized here, not just the top 4 — CategoryToolSection
  // needs the full list client-side so it can show the user's own recently-
  // used tools instead (which may not be in the top 4), falling back to
  // this priority order only when the user has no history in that category.
  const toolsByCategory = CATEGORIES.map((category) => {
    const tools = TOOLS.filter((tool) => tool.category === category)
      .slice()
      .sort((a, b) => b.priority - a.priority);
    return { category, tools };
  });

  const localizedByCategory = await Promise.all(
    toolsByCategory.map(async ({ category, tools }) => ({
      category,
      tools: await Promise.all(
        tools.map(async (tool) => {
          const content = await getLocalizedTool(locale, tool.slug);
          const bentoTool: BentoTool = {
            slug: tool.slug,
            category: tool.category,
            shortName: tool.shortName,
            subheading: content.subheading,
          };
          return bentoTool;
        })
      ),
    }))
  );

  return (
    <div>
      <HeroSection
        tagline={tSite("tagline")}
        description={tSite("heroDescription")}
        featureInstant={tSite("featureInstant")}
        featurePrivate={tSite("featurePrivate")}
        featureNoSignup={tSite("featureNoSignup")}
        searchPlaceholder={tSite("heroSearchPlaceholder", { count: TOOLS.length })}
      />

      <RecentToolsShelf />

      <div className="mx-auto max-w-5xl px-4 pb-20">
        {localizedByCategory.map(({ category, tools }) => {
          const label = tCategories(`${category}.label`);
          return (
            <section key={category} className="pb-14">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">{label}</h2>
                <Link
                  href={`/tools/${category}`}
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {tNav("viewAll")} <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </Link>
              </div>
              <CategoryToolSection category={category} tools={tools} />
            </section>
          );
        })}
      </div>
    </div>
  );
}

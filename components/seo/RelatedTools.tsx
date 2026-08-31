import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { Card } from "@/components/ui/card";

export interface RelatedToolEntry {
  slug: string;
  category: string;
  icon: LucideIcon;
  shortName: string;
  subheading: string;
}

export function RelatedTools({ tools }: { tools: RelatedToolEntry[] }) {
  const t = useTranslations("sections");

  if (tools.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="mx-auto max-w-3xl px-4 py-12">
      <h2 id="related-heading" className="mb-6 text-2xl font-bold tracking-tight">
        {t("relatedTools")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.slug} href={`/tools/${tool.category}/${tool.slug}`}>
              <Card className="group flex items-center gap-3 p-4 transition-colors hover:border-primary">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{tool.shortName}</h3>
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                    {tool.subheading}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform rtl:-scale-x-100 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 group-hover:text-primary" />
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

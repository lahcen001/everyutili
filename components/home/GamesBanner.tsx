import { ArrowRight, Gamepad2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getToolBySlug } from "@/config/tools";
import { Link } from "@/i18n/routing";
import { getGameTools, HOME_GAME_SLUGS } from "@/lib/games";

/** A big, hard-to-miss entry to the games section, with a few games one tap away. */
export async function GamesBanner({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "games" });
  const picks = HOME_GAME_SLUGS.map((slug) => getToolBySlug(slug)).filter((x) => !!x);
  return (
    <section aria-labelledby="home-games" className="mx-auto max-w-5xl px-4 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-fuchsia-500/10 to-amber-500/10 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Gamepad2 className="h-7 w-7" />
            </span>
            <div>
              <h2 id="home-games" className="text-2xl font-extrabold tracking-tight">{t("bannerTitle")}</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("bannerBody", { count: getGameTools().length })}</p>
            </div>
          </div>
          <Link href="/games" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:scale-105">
            {t("playNow")} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {picks.map((tool) => {
            const Icon = tool!.icon;
            return (
              <Link key={tool!.slug} href={`/tools/${tool!.category}/${tool!.slug}`} className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary">
                <Icon className="h-4 w-4 text-primary" /> {tool!.shortName}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

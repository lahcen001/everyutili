import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

export function PrivacyBadge({ extended = false }: { extended?: boolean }) {
  const t = useTranslations();

  return (
    <div className="relative inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-glow-pulse rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <ShieldCheck className="h-3.5 w-3.5" />
      {extended ? t("privacyBadgeExtended") : t("privacyBadge")}
    </div>
  );
}

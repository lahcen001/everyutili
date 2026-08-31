import { ChevronRight, Home } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";

export interface BreadcrumbEntry {
  label: string;
  href?: string;
}

export async function Breadcrumbs({ items }: { items: BreadcrumbEntry[] }) {
  const t = await getTranslations("breadcrumbs");

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link href="/" className="flex items-center hover:text-foreground" aria-label={t("home")}>
        <Home className="h-3.5 w-3.5" />
      </Link>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

import type { PageSettings } from "@/lib/office/pageSettings";

export interface PageContext {
  /** 1-based number printed on this page (after any unnumbered cover pages) */
  page: number;
  /** pages that are numbered */
  pages: number;
  title: string;
  author: string;
  date: string;
}

/** Replaces {page}, {pages}, {title}, {author} and {date} (case-insensitive). Unknown {words} are left alone. */
export function fillVariables(template: string, ctx: PageContext): string {
  return template.replace(/\{(page|pages|title|author|date)\}/gi, (_, name: string) => {
    switch (name.toLowerCase()) {
      case "page":
        return String(ctx.page);
      case "pages":
        return String(ctx.pages);
      case "title":
        return ctx.title;
      case "author":
        return ctx.author;
      default:
        return ctx.date;
    }
  });
}

export interface PageLabels {
  header: string;
  footer: string;
}

/**
 * The header and footer text for one page. "Show page numbers" adds the number to the footer unless
 * the footer already uses {page} (so "Page {page} of {pages}" is never doubled up).
 */
export function pageLabels(page: Pick<PageSettings, "headerText" | "footerText" | "pageNumbers">, ctx: PageContext): PageLabels {
  const header = fillVariables(page.headerText.trim(), ctx).trim();
  const footerRaw = page.footerText.trim();
  const usesPage = /\{page\}/i.test(footerRaw);
  const footerParts = [fillVariables(footerRaw, ctx).trim(), page.pageNumbers && !usesPage ? String(ctx.page) : ""].filter(Boolean);
  return { header, footer: footerParts.join("   ·   ") };
}

/** Today's date in the user's locale, e.g. "7 October 2026". */
export function formatDocDate(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(date);
}

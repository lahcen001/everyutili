"use client";

import * as React from "react";
import { Command } from "cmdk";
import { Search, ArrowRight, LayoutGrid } from "lucide-react";
import { useTranslations, useMessages } from "next-intl";

import { TOOLS, CATEGORIES, getToolBySlug, type ToolCategory } from "@/config/tools";
import { useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";

interface ToolMessages {
  shortName?: string;
  subheading?: string;
  keywords?: string[];
}

interface CategoryMessages {
  label?: string;
}

/**
 * Global Cmd+K / Ctrl+K search palette. Reads the already-loaded next-intl
 * message tree client-side via useMessages() (no extra fetch) for localized
 * names/keywords, and config/tools.ts for structural data (icon, category,
 * slug) — icons are LucideIcon function references and only exist safely on
 * the client, matching the pattern already used by ToolGrid/RelatedTools.
 */
export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const t = useTranslations("commandMenu");
  const tCategories = useTranslations("categories");
  const router = useRouter();
  const messages = useMessages() as {
    tools?: Record<string, ToolMessages>;
    categories?: Record<string, CategoryMessages>;
  };

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const runCommand = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden truncate sm:inline">{t("placeholder")}</span>
        <kbd className="ms-auto hidden shrink-0 items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <Command
            shouldFilter
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "glass w-full max-w-xl overflow-hidden rounded-xl shadow-2xl",
              "animate-in fade-in zoom-in-95 duration-150"
            )}
            loop
          >
            <div className="flex items-center gap-2 border-b border-border/60 px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Command.Input
                autoFocus
                placeholder={t("placeholder")}
                className="h-12 w-full border-0 bg-transparent text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none"
              />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                {t("empty")}
              </Command.Empty>

              <Command.Group
                heading={t("groupCategories")}
                className="px-2 py-1.5 text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:mb-1"
              >
                {CATEGORIES.map((category: ToolCategory) => (
                  <Command.Item
                    key={category}
                    value={`category ${category} ${messages.categories?.[category]?.label ?? category}`}
                    onSelect={() => runCommand(`/tools/${category}`)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
                  >
                    <LayoutGrid className="h-4 w-4 shrink-0" />
                    <span className="flex-1">
                      {tCategories(`${category}.label` as never)}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 rtl:-scale-x-100 data-[selected=true]:opacity-100" />
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Group
                heading={t("groupTools")}
                className="px-2 py-1.5 text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:mb-1"
              >
                {TOOLS.map((tool) => {
                  const Icon = getToolBySlug(tool.slug)?.icon;
                  const toolMessages = messages.tools?.[tool.slug];
                  const keywords = toolMessages?.keywords?.join(" ") ?? "";
                  return (
                    <Command.Item
                      key={tool.slug}
                      value={`${tool.name} ${tool.shortName} ${keywords}`}
                      onSelect={() => runCommand(`/tools/${tool.category}/${tool.slug}`)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
                    >
                      {Icon && <Icon className="h-4 w-4 shrink-0" />}
                      <span className="flex-1">
                        {toolMessages?.shortName ?? tool.shortName}
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            </Command.List>
          </Command>
        </div>
      )}
    </>
  );
}

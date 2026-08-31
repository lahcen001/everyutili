"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, X, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { getToolBySlug } from "@/config/tools";
import { useRecentToolsStore } from "@/lib/stores/useRecentToolsStore";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { useHasMounted } from "@/hooks/useHasMounted";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 10, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: "easeOut" as const } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.15 } },
};

/**
 * Homepage "Recently Used" shelf. Reads from localStorage via
 * useRecentToolsStore (persist middleware), which is unavailable during
 * SSR/the first client render — to avoid a hydration mismatch, this
 * renders nothing until `useHasMounted()` flips true, matching the
 * server's empty output on the very first paint and only revealing real
 * content one tick later on the client.
 */
export function RecentToolsShelf() {
  const t = useTranslations("recentTools");
  const tTime = useTranslations("time");
  const recentTools = useRecentToolsStore((s) => s.recentTools);
  const removeTool = useRecentToolsStore((s) => s.removeTool);
  const clearAll = useRecentToolsStore((s) => s.clearAll);
  const hasMounted = useHasMounted();

  if (!hasMounted || recentTools.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 pb-10 pt-2">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <History className="h-4 w-4 text-primary" />
          {t("heading")}
        </h2>
        <button
          onClick={clearAll}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("clearAll")}
        </button>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5"
      >
        <AnimatePresence mode="popLayout">
          {recentTools.map((tool) => {
            const Icon = getToolBySlug(tool.slug)?.icon;
            return (
              <motion.div
                key={tool.slug}
                layout
                variants={item}
                initial="hidden"
                animate="show"
                exit="exit"
                className="group relative w-40 shrink-0 sm:w-auto"
              >
                <Link
                  href={tool.path}
                  className="flex h-full flex-col rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/50"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {Icon && <Icon className="h-4 w-4" />}
                  </span>
                  <p className="mt-2 truncate text-sm font-medium">{tool.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatRelativeTime(tool.lastVisited, (key, values) => tTime(key, values))}
                  </p>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    removeTool(tool.slug);
                  }}
                  aria-label={t("clearAll")}
                  className="absolute -end-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}

"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAppMode } from "@/components/pwa/useAppMode";
import { Button } from "@/components/ui/button";
import { applyUpdate } from "@/lib/appModeStore";

/** Appears when a new version of the app has been downloaded in the background. */
export function UpdateBar() {
  const t = useTranslations("app");
  const { updateReady } = useAppMode();
  if (!updateReady) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-primary/30 bg-card p-3 shadow-xl" style={{ marginTop: "env(safe-area-inset-top)" }}>
      <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm font-medium">{t("updateReady")}</p>
      <Button size="sm" onClick={applyUpdate}>{t("updateBtn")}</Button>
    </div>
  );
}

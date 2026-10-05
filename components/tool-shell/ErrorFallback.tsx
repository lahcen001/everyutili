"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("common");

  return (
    <div
      role="alert"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-10 text-center"
    >
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <h2 className="text-lg font-semibold">{t("errorTitle")}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{t("errorBody")}</p>
      <Button variant="outline" onClick={onRetry}>
        {t("errorRetry")}
      </Button>
    </div>
  );
}

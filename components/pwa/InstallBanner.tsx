"use client";

import * as React from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAppMode } from "@/components/pwa/useAppMode";
import { Button } from "@/components/ui/button";
import { canShowInstallBanner } from "@/lib/appMode";
import { promptInstall } from "@/lib/appModeStore";

const KEY = "everyutili_install_dismissed";
const DELAY_MS = 25000;

const readDismissed = (): number | null => {
  try {
    const v = window.localStorage.getItem(KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
};

/**
 * Asks the visitor (once in a while, and only after they have been using the site for a bit) to install it.
 * Chrome and Android show the real install dialog; iPhone and iPad have none, so we explain the steps.
 */
export function InstallBanner() {
  const t = useTranslations("app");
  const { standalone, canInstall, ios } = useAppMode();
  const [armed, setArmed] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    if (!canShowInstallBanner(readDismissed(), Date.now())) return;
    const id = window.setTimeout(() => setArmed(true), DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  if (standalone || hidden || !armed || (!canInstall && !ios)) return null;

  return (
    <div role="dialog" aria-label={t("installTitle")} className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl sm:bottom-5" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      <button onClick={dismiss} aria-label={t("notNow")} className="absolute end-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
      <div className="flex items-start gap-3 pe-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Download className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="font-semibold">{ios && !canInstall ? t("iosTitle") : t("installTitle")}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("installBody")}</p>
          {ios && !canInstall && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
              <Share className="h-4 w-4 text-primary" /> {t("iosStepShare")} <SquarePlus className="h-4 w-4 text-primary" /> {t("iosStepAdd")}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={dismiss}>{t("notNow")}</Button>
        {canInstall && (
          <Button size="sm" onClick={() => void promptInstall().then((ok) => ok && setHidden(true))}><Download className="h-4 w-4" /> {t("installBtn")}</Button>
        )}
      </div>
    </div>
  );
}

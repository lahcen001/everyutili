"use client";

import * as React from "react";
import { Download, Gauge, HardDrive, Smartphone, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAppMode } from "@/components/pwa/useAppMode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { promptInstall, setLitePref } from "@/lib/appModeStore";
import type { LitePref } from "@/lib/appMode";
import { formatSize } from "@/lib/myData";
import { cn } from "@/lib/utils";

/** Install the app, switch Lite mode and see / clear the offline copies stored on this phone. */
export function AppSettings() {
  const t = useTranslations("app");
  const { standalone, canInstall, ios, lite, litePref } = useAppMode();
  const [used, setUsed] = React.useState<number | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const measure = React.useCallback(async () => {
    try {
      const est = await navigator.storage?.estimate?.();
      setUsed(est?.usage ?? null);
    } catch {
      setUsed(null);
    }
  }, []);
  React.useEffect(() => {
    const id = window.setTimeout(() => void measure(), 0);
    return () => window.clearTimeout(id);
  }, [measure]);

  const clearOffline = async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("everyutili-")).map((k) => caches.delete(k)));
      setNote(t("cacheCleared"));
    } catch {
      setNote(null);
    }
    void measure();
  };

  const modes: { id: LitePref; label: string }[] = [
    { id: "auto", label: t("liteAuto") },
    { id: "on", label: t("liteOn") },
    { id: "off", label: t("liteOff") },
  ];

  return (
    <Card className="space-y-5 p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Smartphone className="h-4 w-4 text-primary" /> {t("settingsTitle")}</h2>

      <div className="space-y-2">
        {standalone ? (
          <p className="text-sm text-primary">{t("settingsInstalled")}</p>
        ) : canInstall ? (
          <Button onClick={() => void promptInstall()}><Download className="h-4 w-4" /> {t("settingsInstall")}</Button>
        ) : ios ? (
          <p className="text-sm text-muted-foreground">{t("settingsInstallIos")}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("settingsInstallHint")}</p>
        )}
        <p className="text-xs text-muted-foreground">{t("settingsOffline")}</p>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <p className="flex items-center gap-2 text-sm font-medium"><Gauge className="h-4 w-4 text-primary" /> {t("liteTitle")}{lite && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{t("liteActive")}</span>}</p>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label={t("liteTitle")}>
          {modes.map((m) => (
            <button key={m.id} role="radio" aria-checked={litePref === m.id} onClick={() => setLitePref(m.id)} className={cn("rounded-lg px-2 py-1.5 text-sm font-medium transition-colors", litePref === m.id ? "bg-background shadow-sm" : "text-muted-foreground")}>{m.label}</button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("liteHint")}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><HardDrive className="h-4 w-4" /> {used === null ? "—" : t("storageUsed", { used: formatSize(used) })}</p>
        <Button size="sm" variant="outline" onClick={() => void clearOffline()}><Trash2 className="h-3.5 w-3.5" /> {t("clearCache")}</Button>
      </div>
      {note && <p role="status" className="text-sm text-primary">{note}</p>}
    </Card>
  );
}

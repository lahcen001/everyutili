"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A panel with a real browser-fullscreen toggle (in-page fallback where unsupported). */
export function FullscreenStage({ children, className, label }: { children: (isFullscreen: boolean) => React.ReactNode; className?: string; label?: string }) {
  const t = useTranslations("ui");
  const ref = React.useRef<HTMLDivElement>(null);
  const [fs, setFs] = React.useState(false);
  const [pseudo, setPseudo] = React.useState(false);
  const isFs = fs || pseudo;

  React.useEffect(() => {
    const onChange = () => setFs(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  React.useEffect(() => {
    if (!pseudo) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPseudo(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pseudo]);

  const toggle = async () => {
    if (isFs) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setPseudo(false);
      return;
    }
    try {
      if (ref.current?.requestFullscreen) {
        await ref.current.requestFullscreen();
        return;
      }
    } catch {
      /* fall back */
    }
    setPseudo(true);
  };

  return (
    <div ref={ref} className={cn("relative bg-background", isFs && "flex h-screen w-screen flex-col items-center justify-center overflow-auto", pseudo && "fixed inset-0 z-[100]", className)}>
      <Button size="sm" variant="outline" onClick={toggle} className="absolute end-3 top-3 z-10" aria-label={isFs ? t("exitFullscreen") : (label ?? t("fullscreen"))}>
        {isFs ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        {isFs ? t("exitFullscreen") : (label ?? t("fullscreen"))}
      </Button>
      {children(isFs)}
    </div>
  );
}

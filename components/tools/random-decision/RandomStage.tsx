"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Minimize2, RotateCw, Save, Trophy, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Confetti } from "@/components/tools/random-decision/Confetti";

export interface Reveal {
  /** Changes on every new result; a new id re-opens the reveal. */
  id: number;
  items: string[];
  label: string;
  sub?: string;
  /** Accent colour of the winner card. */
  color?: string;
  icon?: React.ReactNode;
  /** Fire the big confetti (default true). */
  confetti?: boolean;
}

const CARD_COLORS = ["#7c74ff", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6", "#a855f7"];

interface RandomStageProps {
  reveal: Reveal | null;
  children: (isFullscreen: boolean) => React.ReactNode;
  onAgain?: () => void;
  againLabel?: string;
  onSave?: () => void;
  className?: string;
}

/**
 * Shared stage for the random tools: gradient surface, real fullscreen
 * (with an in-page fallback), a big animated result reveal and confetti.
 */
export function RandomStage({ reveal, children, onAgain, againLabel = "Again", onSave, className }: RandomStageProps) {
  const t = useTranslations("ui");
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [pseudoFs, setPseudoFs] = React.useState(false);
  const [dismissed, setDismissed] = React.useState<number | null>(null);
  const isFs = fullscreen || pseudoFs;
  const open = !!reveal && reveal.id !== dismissed;

  React.useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  React.useEffect(() => {
    if (!pseudoFs) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPseudoFs(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [pseudoFs]);

  const toggleFullscreen = async () => {
    if (isFs) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setPseudoFs(false);
      return;
    }
    const el = stageRef.current;
    if (el?.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        /* fall back to the in-page fullscreen */
      }
    }
    setPseudoFs(true);
  };

  const close = () => reveal && setDismissed(reveal.id);
  const single = reveal ? reveal.items.length === 1 : true;
  const color = reveal?.color ?? CARD_COLORS[0];

  return (
    <div
      ref={stageRef}
      className={cn(
        "relative flex flex-col overflow-hidden border border-border bg-gradient-to-br from-primary/10 via-background to-fuchsia-500/10",
        isFs ? "h-screen w-screen rounded-none border-0 bg-background" : "min-h-[440px] rounded-2xl",
        pseudoFs && "fixed inset-0 z-[100]",
        className
      )}
    >
      <div className="flex justify-end px-4 pt-3">
        <Button size="sm" variant="outline" onClick={toggleFullscreen} aria-label={isFs ? t("exitFullscreen") : t("fullscreen")}>
          {isFs ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {isFs ? t("exitFullscreen") : t("fullscreen")}
        </Button>
      </div>
      <div className={cn("flex flex-1 flex-col items-center justify-center overflow-auto", isFs && "min-h-0")}>{children(isFs)}</div>

      <AnimatePresence>
        {open && reveal && (
          <motion.div
            key={reveal.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 overflow-auto bg-background/90 p-6 text-center backdrop-blur-md"
            role="dialog"
            aria-label={reveal.label}
          >
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[170%] -translate-x-1/2 -translate-y-1/2"
              style={{
                background: `repeating-conic-gradient(from 0deg, ${color}33 0deg 8deg, transparent 8deg 22deg)`,
                maskImage: "radial-gradient(circle, black 0%, transparent 62%)",
                WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 62%)",
              }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 22, ease: "linear" }}
            />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[60%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
              style={{ backgroundColor: color }}
              animate={{ opacity: [0.25, 0.5, 0.25], scale: [0.9, 1.1, 0.9] }}
              transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
            />

            <motion.div
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
              className="relative flex h-16 w-16 items-center justify-center rounded-full text-amber-900 shadow-2xl sm:h-24 sm:w-24 [&_svg]:h-8 [&_svg]:w-8 sm:[&_svg]:h-12 sm:[&_svg]:w-12"
              style={{ background: "linear-gradient(135deg, #fde68a, #f59e0b)" }}
            >
              {reveal.icon ?? <Trophy />}
            </motion.div>

            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="relative text-sm font-bold uppercase tracking-[0.4em] text-muted-foreground sm:text-base">
              {reveal.label}
            </motion.p>

            {single ? (
              <motion.div
                initial={{ scale: 0.2, opacity: 0, y: 30 }}
                animate={{ scale: [0.2, 1.12, 1], opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5, times: [0, 0.65, 1], ease: "easeOut" }}
                className="relative max-w-full rounded-3xl border-4 border-white px-8 py-5 shadow-2xl sm:px-12 sm:py-7"
                style={{ background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 65%, #000))`, boxShadow: `0 20px 60px ${color}88` }}
              >
                <h2
                  className="break-words font-black leading-tight tracking-tight text-white"
                  style={{
                    fontSize: `clamp(2.4rem, ${isFs ? "10vw" : "8vw"}, ${isFs ? "8rem" : "5.5rem"})`,
                    textShadow: "0 3px 0 rgba(0,0,0,0.35), 0 6px 24px rgba(0,0,0,0.35)",
                  }}
                >
                  {reveal.items[0]}
                </h2>
              </motion.div>
            ) : (
              <div className="relative flex max-w-4xl flex-wrap items-center justify-center gap-3">
                {reveal.items.map((item, i) => {
                  const c = reveal.color ?? CARD_COLORS[i % CARD_COLORS.length];
                  return (
                    <motion.span
                      key={i}
                      initial={{ scale: 0, opacity: 0, y: 24 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 280, damping: 16, delay: 0.5 + i * 0.12 }}
                      className="rounded-2xl border-2 border-white px-5 py-3 font-extrabold text-white shadow-xl"
                      style={{
                        background: `linear-gradient(135deg, ${c}, color-mix(in oklab, ${c} 65%, #000))`,
                        fontSize: isFs ? "clamp(1.6rem, 4vw, 3.5rem)" : "clamp(1.2rem, 3vw, 2rem)",
                        textShadow: "0 2px 0 rgba(0,0,0,0.3)",
                      }}
                    >
                      {item}
                    </motion.span>
                  );
                })}
              </div>
            )}

            {reveal.sub && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="relative max-w-xl text-sm text-muted-foreground sm:text-base">
                {reveal.sub}
              </motion.p>
            )}

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="relative flex flex-wrap items-center justify-center gap-2">
              {onAgain && (
                <Button
                  size="lg"
                  onClick={() => {
                    close();
                    onAgain();
                  }}
                >
                  <RotateCw className="h-4 w-4" /> {againLabel}
                </Button>
              )}
              {onSave && (
                <Button size="lg" variant="outline" onClick={onSave}>
                  <Save className="h-4 w-4" /> Save
                </Button>
              )}
              <Button size="lg" variant="ghost" onClick={close}>
                <X className="h-4 w-4" /> Close
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Confetti fire={reveal && reveal.confetti !== false ? reveal.id : 0} big className="z-30" />
    </div>
  );
}

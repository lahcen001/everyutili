import type * as React from "react";

import { cn } from "@/lib/utils";

/** The calculator "body": a dark, softly lit device that holds the screen and the keys. */
export function CalcFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 p-3.5 shadow-2xl shadow-indigo-950/30 sm:p-5", className)}>
      <span className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" aria-hidden />
      <span className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-fuchsia-500/15 blur-3xl" aria-hidden />
      <div className="relative">{children}</div>
    </div>
  );
}

/** The calculator screen: a dark glass panel with a faint inner shadow. */
export function CalcScreen({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-white/5 bg-gradient-to-b from-[#0b1220] to-[#0f1a2e] p-4 text-right text-white shadow-[inset_0_2px_12px_rgba(0,0,0,0.6)]", className)}>
      {children}
    </div>
  );
}

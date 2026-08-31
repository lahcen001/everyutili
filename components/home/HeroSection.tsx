"use client";

import * as React from "react";
import { Search, ShieldCheck, Zap, Lock } from "lucide-react";

import { PrivacyBadge } from "@/components/tool-shell/PrivacyBadge";

interface HeroSectionProps {
  tagline: string;
  description: string;
  featureInstant: string;
  featurePrivate: string;
  featureNoSignup: string;
  searchPlaceholder: string;
}

/**
 * Deliberately has NO entrance animation: this section contains the LCP
 * element (the H1). A framer-motion fade/slide-in here would render it at
 * opacity:0 in the server HTML, invisible until React hydrates and the
 * animation completes — pushing LCP out by 1s+ for content that's already
 * in the DOM. Below-the-fold sections (RecentToolsShelf, BentoToolGrid) can
 * still animate freely since they're never the LCP candidate.
 */
export function HeroSection({
  tagline,
  description,
  featureInstant,
  featurePrivate,
  featureNoSignup,
  searchPlaceholder,
}: HeroSectionProps) {
  function openCommandMenu() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
  }

  return (
    <section className="bg-hero-glow bg-noise relative overflow-hidden">
      <div className="bg-grid-dots absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-20 text-center">
        <div className="flex justify-center">
          <PrivacyBadge extended />
        </div>

        <h1 className="mt-6 animate-gradient-x bg-gradient-to-r from-foreground via-primary to-foreground bg-[length:200%_auto] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl md:text-6xl">
          {tagline}
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground/80">
          {description}
        </p>

        <button
          onClick={openCommandMenu}
          className="card-glass mx-auto mt-8 flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-start text-sm text-muted-foreground shadow-lg transition-all duration-300 hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{searchPlaceholder}</span>
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary shadow-[0_0_8px_-2px_var(--primary)] sm:flex">
            ⌘K
          </kbd>
        </button>

        <div className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-4 text-start sm:grid-cols-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
            <Zap className="h-4 w-4 text-primary" /> {featureInstant}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
            <Lock className="h-4 w-4 text-primary" /> {featurePrivate}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
            <ShieldCheck className="h-4 w-4 text-primary" /> {featureNoSignup}
          </div>
        </div>
      </div>
    </section>
  );
}

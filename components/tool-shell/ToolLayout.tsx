import type { ReactNode } from "react";
import { PrivacyBadge } from "@/components/tool-shell/PrivacyBadge";
import { MotionSection } from "@/components/tool-shell/MotionSection";
import { Breadcrumbs, type BreadcrumbEntry } from "@/components/seo/Breadcrumbs";

interface ToolLayoutProps {
  h1: string;
  subheading: string;
  breadcrumbs: BreadcrumbEntry[];
  children: ReactNode;
  /** Rendered between the header and the tool wrapper (e.g. QuickAnswer). */
  aboveTool?: ReactNode;
  /** Wide, viewport-tall layout for editor-style tools. */
  wide?: boolean;
  /** Extra-polished control styling (used by the media tools). */
  pro?: boolean;
}

export async function ToolLayout({
  h1,
  subheading,
  breadcrumbs,
  children,
  aboveTool,
  wide = false,
  pro = false,
}: ToolLayoutProps) {
  const header = (compact: boolean) => (
    <div className={compact ? "mt-3 flex flex-col items-center gap-2 text-center" : "mt-4 flex flex-col items-center gap-3 text-center"}>
      <PrivacyBadge />
      <h1
        className={
          compact
            ? "text-balance bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl"
            : "text-balance bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-5xl"
        }
      >
        {h1}
      </h1>
      <span className="h-1 w-12 rounded-full bg-gradient-to-r from-primary/20 via-primary to-primary/20" aria-hidden />
      <p className={compact ? "max-w-2xl text-balance text-sm text-muted-foreground sm:text-base" : "max-w-xl text-balance text-muted-foreground sm:text-lg"}>
        {subheading}
      </p>
    </div>
  );

  if (wide) {
    return (
      <div className="bg-noise relative">
        <div className="bg-hero-glow pointer-events-none absolute inset-x-0 top-0 h-56 opacity-70" aria-hidden />
        <div className="bg-grid-dots pointer-events-none absolute inset-x-0 top-0 h-48" aria-hidden />
        <div className="relative mx-auto max-w-[1600px] px-3 pt-4 sm:px-6">
          <Breadcrumbs items={breadcrumbs} />
          {header(true)}
          <div className={pro ? "pro-tool mt-5" : "mt-5"}>{children}</div>
          {aboveTool}
        </div>
      </div>
    );
  }
  return (
    <div className="bg-noise relative">
      <div className="bg-hero-glow pointer-events-none absolute inset-x-0 top-0 h-72 opacity-70" aria-hidden />
      <div className="bg-grid-dots pointer-events-none absolute inset-x-0 top-0 h-64" aria-hidden />
      <div className="relative mx-auto max-w-4xl px-4 pt-6">
        <Breadcrumbs items={breadcrumbs} />
        {header(false)}

        {aboveTool}

        <MotionSection>
          <div className={`glass mt-6 rounded-2xl p-4 shadow-lg shadow-primary/5${pro ? " pro-tool" : ""}`}>{children}</div>
        </MotionSection>
      </div>
    </div>
  );
}

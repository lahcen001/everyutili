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
}

export async function ToolLayout({
  h1,
  subheading,
  breadcrumbs,
  children,
  aboveTool,
  wide = false,
}: ToolLayoutProps) {
  if (wide) {
    return (
      <div className="bg-noise relative">
        <div className="relative mx-auto max-w-[1600px] px-3 pt-4 sm:px-6">
          <Breadcrumbs items={breadcrumbs} />
          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{h1}</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subheading}</p>
            </div>
            <PrivacyBadge />
          </div>
          <div className="mt-4">{children}</div>
          {aboveTool}
        </div>
      </div>
    );
  }
  return (
    <div className="bg-noise relative">
      <div className="bg-grid-dots pointer-events-none absolute inset-x-0 top-0 h-64" aria-hidden />
      <div className="relative mx-auto max-w-4xl px-4 pt-6">
        <Breadcrumbs items={breadcrumbs} />

        <div className="mt-4 flex flex-col items-center gap-3 text-center">
          <PrivacyBadge />
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{h1}</h1>
          <p className="max-w-xl text-balance text-muted-foreground">{subheading}</p>
        </div>

        {aboveTool}

        <MotionSection>
          <div className="glass mt-6 rounded-2xl p-4">{children}</div>
        </MotionSection>
      </div>
    </div>
  );
}

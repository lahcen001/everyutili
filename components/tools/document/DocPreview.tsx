"use client";

import * as React from "react";

import { themeCss, type DocTheme } from "@/lib/office/docThemes";
import { mmToPx, pageDimensionsMm, type PageSettings } from "@/lib/office/pageSettings";
import type { PdfLayout } from "@/lib/office/pdfExport";
import { pageLabels } from "@/lib/office/headerFooter";

const SCOPE = "doc-preview";
const GAP_PX = 24;

/**
 * Shows document HTML on paper at the real page size, scaled to fit. Without `layout` it is one continuous
 * sheet (what Word will paginate); with `layout` it shows the exact pages the PDF export will produce.
 */
export function DocPreview({
  html,
  theme,
  page,
  layout,
  fontSizePt,
  headerFooter,
  meta = { title: "", author: "", date: "" },
  coverPages = 0,
  watermarkUrl = null,
}: {
  html: string;
  theme: DocTheme;
  page: PageSettings;
  layout?: PdfLayout | null;
  fontSizePt?: number;
  headerFooter?: boolean;
  /** values for {title}, {author} and {date} in the header and footer */
  meta?: { title: string; author: string; date: string };
  /** unnumbered pages at the start (a cover): no header, footer or number */
  coverPages?: number;
  /** a page-sized transparent image drawn over every page */
  watermarkUrl?: string | null;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.5);
  const [innerHeight, setInnerHeight] = React.useState(0);

  const { width, height } = pageDimensionsMm(page);
  const pageW = mmToPx(width);
  const pageH = mmToPx(height);
  const margin = mmToPx(page.marginMm);

  React.useEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    const update = () => {
      setScale(Math.min(1, wrap.clientWidth / pageW));
      setInnerHeight(inner.offsetHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [pageW, html, layout]);

  const css = themeCss(theme, SCOPE, fontSizePt);
  const paper: React.CSSProperties = { width: pageW, background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.25)" };

  const pageCount = layout ? layout.slices.length : 1;
  const totalHeight = layout ? layout.slices.length * (pageH + GAP_PX) - GAP_PX : innerHeight;

  return (
    <div ref={wrapRef} className="overflow-hidden rounded-lg bg-muted/40" style={{ height: totalHeight * scale + (layout ? 0 : 0) }}>
      <style>{css}</style>
      <div ref={innerRef} style={{ width: pageW, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {layout ? (
          <div style={{ display: "flex", flexDirection: "column", gap: GAP_PX }}>
            {layout.slices.map((slice, i) => (
              <div key={i} style={{ ...paper, height: pageH, position: "relative", overflow: "hidden" }} aria-label={`Page ${i + 1} of ${pageCount}`}>
                <div style={{ position: "absolute", left: margin, top: margin, width: layout.widthPx, height: slice.end - slice.start, overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -slice.start, left: 0, width: layout.widthPx }}>
                    <div className={SCOPE} dangerouslySetInnerHTML={{ __html: html }} />
                  </div>
                </div>
                {watermarkUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={watermarkUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
                )}
                {headerFooter && i >= coverPages && (() => {
                  const labels = pageLabels(page, { page: i - coverPages + 1, pages: pageCount - coverPages, ...meta });
                  const align = (a: string): React.CSSProperties => ({ position: "absolute", left: margin, right: margin, textAlign: a as React.CSSProperties["textAlign"], fontSize: 11, color: "#6b7280" });
                  return (
                    <>
                      {labels.header && <div style={{ ...align(page.headerAlign), top: Math.max(6, margin / 2 - 8) }}>{labels.header}</div>}
                      {labels.footer && <div style={{ ...align(page.footerAlign), bottom: Math.max(6, margin / 2 - 8) }}>{labels.footer}</div>}
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...paper, minHeight: pageH, padding: margin, boxSizing: "border-box" }}>
            <div className={SCOPE} dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        )}
      </div>
    </div>
  );
}

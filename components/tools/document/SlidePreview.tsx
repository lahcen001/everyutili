"use client";

import * as React from "react";

import {
  SLIDE_WIDTH_IN,
  bodyLines,
  getGeometry,
  slideHeightIn,
  type AspectRatio,
  type SlideDraft,
  type SlideTheme,
} from "@/lib/office/pptx";

const PX_PER_IN = 96;
const PT_TO_PX = 96 / 72;

/** Renders a slide at its real size (10in wide at 96dpi) from the same geometry the .pptx export uses, then scales it to fit. */
export function SlidePreview({
  slide,
  theme,
  ratio,
  className,
}: {
  slide: SlideDraft;
  theme: SlideTheme;
  ratio: AspectRatio;
  className?: string;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.5);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / (SLIDE_WIDTH_IN * PX_PER_IN));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const H = slideHeightIn(ratio);
  const geo = getGeometry(slide.layout, ratio);
  const lines = bodyLines(slide.body);
  const box = (b: { x: number; y: number; w: number; h: number }): React.CSSProperties => ({
    position: "absolute",
    left: b.x * PX_PER_IN,
    top: b.y * PX_PER_IN,
    width: b.w * PX_PER_IN,
    height: b.h * PX_PER_IN,
    overflow: "hidden",
  });

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ width: "100%", aspectRatio: `${SLIDE_WIDTH_IN} / ${H}`, position: "relative", overflow: "hidden" }}
    >
      <div
        style={{
          width: SLIDE_WIDTH_IN * PX_PER_IN,
          height: H * PX_PER_IN,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
          background: `#${geo.fullBleed ? theme.titleBg : theme.bg}`,
          fontFamily: `${theme.font}, Arial, sans-serif`,
        }}
      >
        <div style={{ ...box(geo.accentBar), background: `#${theme.accent}` }} />

        {slide.title.trim() && (
          <div
            style={{
              ...box(geo.titleBox),
              display: "flex",
              alignItems: geo.titleValign === "middle" ? "center" : "flex-start",
              justifyContent: geo.titleAlign === "center" ? "center" : "flex-start",
              textAlign: geo.titleAlign,
              fontSize: geo.titleSize * PT_TO_PX,
              fontWeight: 700,
              lineHeight: 1.15,
              color: `#${geo.fullBleed ? theme.titleText : theme.accent}`,
            }}
          >
            <span>{slide.title}</span>
          </div>
        )}

        {lines.length > 0 && (
          <div
            style={{
              ...box(geo.bodyBox),
              textAlign: geo.bodyAlign,
              fontSize: geo.bodySize * PT_TO_PX,
              lineHeight: 1.2,
              color: `#${geo.fullBleed ? theme.titleSub : theme.text}`,
            }}
          >
            {lines.map((line, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8 * PT_TO_PX,
                  justifyContent: geo.bodyAlign === "center" ? "center" : "flex-start",
                  marginBottom: (geo.bullets ? 8 : 6) * PT_TO_PX,
                }}
              >
                {geo.bullets && <span aria-hidden>•</span>}
                <span>{line}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { ImageResponse } from "next/og";

import { getToolBySlug } from "@/config/tools";

export const alt = "EveryUtili tool";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Generated on request (and cached by the CDN) so the build doesn't have to render one image per tool and language.
export const dynamic = "force-dynamic";

const CATEGORY_NAME: Record<string, string> = {
  media: "Media",
  document: "Documents & PDF",
  developer: "Developer",
  financial: "Calculators",
  "random-decision": "Random & Decision",
  "focus-study": "Focus & Games",
  "math-calculators": "Math & Science",
};

/** Share card for one tool. The built-in font only has Latin letters, so the English tool name is used in every language. */
export default async function Image({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  const tool = getToolBySlug(slug);
  const name = tool?.name ?? "EveryUtili";
  const cat = CATEGORY_NAME[category] ?? "Tools";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #0f172a 0%, #312e81 60%, #6d28d9 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 36, fontWeight: 800, display: "flex" }}>EveryUtili</div>
          <div style={{ fontSize: 26, padding: "8px 22px", borderRadius: 999, background: "rgba(255,255,255,0.16)", display: "flex" }}>{cat}</div>
        </div>
        <div style={{ fontSize: name.length > 34 ? 72 : 92, fontWeight: 800, lineHeight: 1.05, display: "flex" }}>{name}</div>
        <div style={{ display: "flex", gap: 18, fontSize: 28, opacity: 0.92 }}>
          <div style={{ display: "flex" }}>Free</div>
          <div style={{ display: "flex" }}>·</div>
          <div style={{ display: "flex" }}>No sign-up</div>
          <div style={{ display: "flex" }}>·</div>
          <div style={{ display: "flex" }}>Your files never leave your device</div>
        </div>
      </div>
    ),
    size
  );
}

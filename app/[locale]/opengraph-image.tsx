import { ImageResponse } from "next/og";

export const alt = "EveryUtili – free online tools that respect your privacy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

/** Default share card for the home page and any page without its own image. */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #c026d3 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 34, fontWeight: 700, opacity: 0.85, display: "flex" }}>EveryUtili</div>
        <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.05, marginTop: 24, display: "flex" }}>Free online tools that respect your privacy</div>
        <div style={{ fontSize: 34, marginTop: 36, opacity: 0.9, display: "flex" }}>PDF · Images · Developer · Calculators · Focus & Games</div>
        <div style={{ fontSize: 28, marginTop: 14, opacity: 0.8, display: "flex" }}>Runs in your browser — your files never leave your device</div>
      </div>
    ),
    size
  );
}

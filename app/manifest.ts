import type { MetadataRoute } from "next";

/** Makes the site installable ("Add to home screen" / "Install app") and lets it open offline. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EveryUtili – free online tools",
    short_name: "EveryUtili",
    description: "Free online tools that run in your browser: PDF, images, developer tools, calculators, focus and games.",
    start_url: "/en",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#635bff",
    categories: ["utilities", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

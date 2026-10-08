import type { MetadataRoute } from "next";

/**
 * Web app manifest: makes the site installable like a real app on phones and desktops.
 * Kept to the basics on purpose: share_target, shortcuts and launch_handler can be added back once installs are confirmed to work on old and new Android.
 * Paths have no language prefix on purpose — the site sends each visitor to their own language.
 */
export default function manifest(): MetadataRoute.Manifest {
  const manifest = {
    id: "/",
    name: "EveryUtili – free online tools",
    short_name: "EveryUtili",
    description: "Free online tools that run on your device: PDF, images, developer tools, calculators, focus and games. Works offline.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#635bff",
    categories: ["utilities", "productivity", "education"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return manifest as unknown as MetadataRoute.Manifest;
}

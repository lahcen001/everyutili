import type { MetadataRoute } from "next";

const icon = { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" };

/**
 * Web app manifest: makes the site installable like a real app on phones and desktops.
 * Paths have no language prefix on purpose — the site sends each visitor to their own language.
 */
export default function manifest(): MetadataRoute.Manifest {
  const manifest = {
    id: "/?source=pwa",
    name: "EveryUtili – free online tools",
    short_name: "EveryUtili",
    description: "Free online tools that run on your device: PDF, images, developer tools, calculators, focus and games. Works offline.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#635bff",
    categories: ["utilities", "productivity", "education"],
    prefer_related_applications: false,
    launch_handler: { client_mode: "navigate-existing" },
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // long-press the app icon for quick actions
    shortcuts: [
      { name: "Focus timer", short_name: "Focus", url: "/tools/focus-study/pomodoro-timer?source=shortcut", icons: [icon] },
      { name: "Image compressor", short_name: "Compress", url: "/tools/media/image-compressor?source=shortcut", icons: [icon] },
      { name: "Scientific calculator", short_name: "Calculator", url: "/tools/math-calculators/scientific-calculator?source=shortcut", icons: [icon] },
      { name: "QR code generator", short_name: "QR code", url: "/tools/media/qr-code-generator?source=shortcut", icons: [icon] },
    ],
    // appears in the phone's "Share to…" sheet: send a photo, a video or a link straight into the app
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "media", accept: ["image/*", "video/*"] }] },
    },
  };
  return manifest as unknown as MetadataRoute.Manifest;
}

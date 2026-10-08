import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { MERGED_TOOL_REDIRECTS } from "./config/redirects";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// CSP is production-only: `next dev` needs eval/websockets for HMR. Hosts allowed are the ones the app
// actually uses: GA4, Monaco's default jsDelivr loader, and arbitrary https hosts for IPTV streams/images.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "connect-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  async redirects() {
    return Object.entries(MERGED_TOOL_REDIRECTS).map(([from, to]) => ({
      source: `/:locale/tools/document/${from}`,
      destination: `/:locale/tools/document/${to}`,
      permanent: true,
    }));
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must never be cached by the browser, or app updates would not arrive.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "public, max-age=3600" }] },
      { source: "/icons/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
    ];
  },
  /**
   * Rewrites `import { X } from "lucide-react"` (and other named-export
   * libraries) into per-icon deep imports at build time, so a page that
   * uses 3 icons doesn't pull the whole ~1000-icon barrel file into its
   * bundle — lucide-react is imported in nearly every tool component, so
   * this alone meaningfully cuts shared/homepage bundle size.
   */
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default withNextIntl(nextConfig);

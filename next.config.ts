import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
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

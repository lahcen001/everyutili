import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

/**
 * NOTE: Next.js 16 deprecated the `middleware.ts` file convention in favor
 * of `proxy.ts` (same runtime behavior, renamed file + export — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * `next-intl`'s `createMiddleware` returns a plain
 * `(request: NextRequest) => NextResponse` function, so it works
 * identically whether wired up from `middleware.ts` or `proxy.ts` — we use
 * the current, non-deprecated `proxy.ts` convention here.
 */
export const proxy = createMiddleware(routing);

export const config = {
  // Match all pathnames except for:
  // - /api routes
  // - Next.js internals (_next)
  // - static files with a file extension (favicon.ico, images, etc.)
  // - the top-level metadata routes served at true root
  matcher: [
    "/((?!api|_next|_vercel|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};

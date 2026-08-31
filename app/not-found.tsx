import Link from "next/link";

/**
 * Root (locale-less) not-found boundary. Reached only for paths outside
 * `app/[locale]` entirely (e.g. a request that never resolves to a
 * `[locale]` segment at all). Since this route has no access to
 * next-intl's request context, it stays a minimal, English-only fallback.
 * The locale-aware 404 (bad path under a valid locale, or an invalid
 * locale segment) is handled by app/[locale]/not-found.tsx instead.
 */
export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-3xl font-bold">404</h1>
        <p className="text-muted-foreground">Page not found.</p>
        <Link href="/en" className="text-primary underline">
          Go home
        </Link>
      </body>
    </html>
  );
}

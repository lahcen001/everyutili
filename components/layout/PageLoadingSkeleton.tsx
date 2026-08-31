/**
 * Shared route-level loading UI, rendered by each segment's loading.tsx
 * while Next.js streams in the real page. Static shapes only (no copy, no
 * locale data) since loading.tsx renders before params/translations are
 * available.
 */
export function PageLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-8 px-4 py-10">
      <div className="space-y-3">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-8 w-2/3 rounded bg-muted" />
        <div className="h-4 w-full max-w-md rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-card" />
        ))}
      </div>
    </div>
  );
}

/** Denser variant for a single tool page (one wide workspace panel instead of a grid of cards). */
export function ToolPageLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-6 px-4 py-10">
      <div className="space-y-3">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-8 w-2/3 rounded bg-muted" />
        <div className="h-4 w-full max-w-md rounded bg-muted" />
      </div>
      <div className="h-64 rounded-xl border border-border bg-card" />
    </div>
  );
}

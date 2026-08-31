# EveryUtili

A privacy-first, programmatic web utility suite. Every conversion, format, and calculation runs
locally in the browser — no file ever touches a server.

## Stack

- **Framework:** Next.js 16 (App Router), TypeScript, React 19
- **Styling:** Tailwind CSS v4, Radix UI primitives (Shadcn-style), Lucide icons
- **State:** Zustand (persisted theme, recent tools, presets)
- **Media:** Web Workers + OffscreenCanvas for local image conversion, JSZip for batch downloads
- **Documents:** pdf-lib for local PDF merging
- **Developer tools:** Monaco Editor for JSON formatting/validation

## Architecture

- `config/tools.ts` — central, strictly-typed tool registry. Every tool route, its SEO metadata,
  HowTo steps, FAQ entries, and comparison tables are defined here.
- `app/tools/[category]/[slug]/page.tsx` — dynamic route that generates metadata, JSON-LD
  (`WebApplication`, `HowTo`, `FAQPage`, `BreadcrumbList`), and renders the tool shell from the
  registry entry.
- `components/tool-shell/ToolLayout.tsx` — universal above-the-fold shell (breadcrumbs, privacy
  badge, H1, tool UI).
- `components/tools/**` — individual client-side tool implementations.
- `app/sitemap.ts` / `app/robots.ts` — automated indexing generated from the same registry.

## Getting started

```bash
npm install
npm run dev
```

Set `NEXT_PUBLIC_SITE_URL` (see `.env.example`) to your production domain before deploying so
canonical URLs, sitemaps, and JSON-LD resolve correctly.

## Adding a new tool

1. Add an entry to `TOOLS` in `config/tools.ts` (metadata, SEO copy, HowTo/FAQ content, and a
   dynamic `component` import).
2. Implement the tool component under `components/tools/<category>/`.
3. The route, sitemap entry, and all structured data are generated automatically.

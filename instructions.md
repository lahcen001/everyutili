You are a Principal Full-Stack Engineer and Technical SEO Architect specializing in high-performance web applications.

Your objective is to architect and generate the complete, production-ready codebase for "OmniTools" — a lightning-fast, privacy-first, programmatic web utility suite engineered to rank #1 on Google for high-intent tool queries (file converters, PDF utilities, calculators, dev tools).

---

### I. CORE ARCHITECTURAL & PERFORMANCE REQUIREMENTS

1. **Tech Stack:**
   - Framework: Next.js (App Router), TypeScript, React 19.
   - Styling: Tailwind CSS, Shadcn UI, Lucide Icons, Framer Motion.
   - State: Zustand (persisting recent tools, theme, and user presets).
2. **Client-Side Engine (Zero Server Costs & 100/100 Core Web Vitals):**
   - Media: In-browser Web Workers + Canvas API + WebAssembly (WASM via `@squoosh/lib` / `ffmpeg.wasm`) for instant local conversions without uploading files to a remote server.
   - PDF: Local manipulation via `pdf-lib` and `pdfjs-dist`.
   - Data & Code: `@monaco-editor/react` or `@codemirror/lang-json` with native Web Workers for linting/formatting.
3. **Core Web Vitals Thresholds:**
   - Interaction to Next Paint (INP) < 50ms, Largest Contentful Paint (LCP) < 1.0s, Cumulative Layout Shift (CLS) = 0.

---

### II. TECHNICAL SEO & AI-ENGINE INDEXING ENGINE (PROGRAMMATIC ARCHITECTURE)

Every tool route (`/tools/[category]/[slug]`) must be dynamically generated from a central registry and render the following automated SEO elements:

1. **Automated Dynamic Metadata (`generateMetadata`):**
   - Exact-match search query title formats (e.g., `Convert JPG to PNG Online – 100% Free & Secure`).
   - Dynamic meta description, OpenGraph tags, Twitter cards, and self-referencing canonical URLs.
2. **Automated JSON-LD Structured Data:**
   - `WebApplication` / `SoftwareApplication` schema (price: $0.00, operatingSystem: "All").
   - `HowTo` schema with step-by-step instructions matching the UI steps.
   - `FAQPage` schema generated from the tool’s curated FAQ dictionary.
   - `BreadcrumbList` schema linking Home -> Category -> Tool.
3. **Automated Indexing:**
   - Dynamic `sitemap.ts` that iterates through all registry tools and generates URLs with priorities and change frequencies.
   - Optimized `robots.ts`.
4. **On-Page Hierarchy (Optimized for Search Intent & Dwell Time):**
   - **Above the Fold:** Minimal header, H1 title, privacy badge ("Processed 100% locally in your browser"), and the interactive Tool UI immediately visible without scrolling.
   - **Below the Fold:** 
     1. Step-by-step "How to use" guide (matches `HowTo` schema).
     2. Technical breakdown & format comparison table.
     3. Frequently Asked Questions accordion (matches `FAQPage` schema).
     4. Contextual related tools grid (internal link equity distribution).

---

### III. CODEBASE DELIVERABLES REQUIRED

Please generate the modular, enterprise-grade architecture with complete code for the following components:

#### 1. Central Tool Registry (`config/tools.ts`)
Define a strictly typed configuration schema and populate it with metadata, category, SEO tags, How-To steps, and FAQ data for:
- `jpg-to-png` (Media Converter)
- `merge-pdf` (Document Utility)
- `json-formatter` (Developer Utility)
- `salary-to-hourly` (Financial Calculator)

#### 2. Dynamic SEO Layout & Route Template (`app/tools/[category]/[slug]/page.tsx`)
- Server component implementing dynamic `generateMetadata()`, dynamic JSON-LD injection, Breadcrumbs, and static generation params (`generateStaticParams`).
- Clean rendering of the Tool component, How-To section, Comparison table, and FAQ accordion.

#### 3. Reusable Tool Shell Component (`components/tool-shell/ToolLayout.tsx`)
- Universal layout wrapping every tool with drag-and-drop file zones, live progress indicators, 1-click copy/download, and the client-side privacy badge.

#### 4. High-Performance Client-Side Tool Implementations
Provide complete, functional code for:
- **`JPG / HEIC to PNG Converter` (`components/tools/media/ImageConverter.tsx`):** Using an offloaded Web Worker to process batch images locally, resize, control quality, and export to a single ZIP file with zero UI lag.
- **`JSON Formatter & Schema Validator` (`components/tools/developer/JsonFormatter.tsx`):** With instant syntax error highlighting, auto-fix formatting, tree view preview, and CSV conversion.

#### 5. Dynamic Sitemap (`app/sitemap.ts`)
- Automated script returning all static routes and all programmatic category/tool URLs.

Provide strictly typed, clean, production-ready code with responsive design and dark/light mode support.
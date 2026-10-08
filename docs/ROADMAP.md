# EveryUtili roadmap: new tools to add and what to improve

## Context

The site has 142 tools in 7 categories, 12 languages and a Chrome extension. This document lists the kinds of tools worth adding and what needs improving, based on a check of the code. Nothing here is built until it is picked.

**Where we are today** (checked in the code)

| Category | Tools |
|---|---|
| Media | 35 |
| Developer | 25 |
| Focus & Games | 23 |
| Document / PDF | 22 |
| Financial | 19 |
| Random & Decision | 10 |
| Math & Science | 8 |

## Part 1 — Tool types to add

I rank by search demand, how well it fits "free, private, runs in your browser", and effort. Everything below can run fully offline in the browser.

### A. Best next bets (high search demand, medium effort)

1. **New category: Health & Fitness** (nothing here yet, and these are very searched)
   - Calorie / TDEE / macro calculator, BMR, water intake, sleep-cycle calculator, heart-rate zones, one-rep max, running pace, pregnancy due date, ovulation / period tracker.
   - Reuses what exists: `lib/calc`, the saved-data hook `usePersisted`, the reminders on the home page.
2. **New category: Islamic & Prayer tools** (a strong fit for your Arabic, Indonesian and Hindi readers)
   - Prayer times (offline astronomy formulas, several calculation methods), Qibla compass, Hijri ⇄ Gregorian converter, Zakat calculator, Ramadan timetable, tasbih counter.
   - Reuses the reminders and notification code (`ReminderNotifier`).
3. **Document / PDF — what people search most**
   - OCR (image or scanned PDF to text, `tesseract.js`), PDF unlock / password-protect, redact PDF, PDF compare, PDF to Excel (table extraction), resume / CV builder, invoice generator, certificate maker.
   - Reuses `lib/pdf/*`, `lib/office/*`, the PDF Maker pipeline and `SignPdf`.
4. **Media**
   - Background remover, image upscaler (both need an ML model — heavy), video compressor and video-to-MP3 (`ffmpeg.wasm`), audio trimmer / converter, passport-photo maker, meme maker, colour-palette extractor, text-to-speech and speech-to-text (browser APIs, light).
   - Reuses `EditorLayout`, `BatchWorkspace` and `useBatchProcessor`.

### B. Cheap wins (small, quick, good for SEO)

- **Developer:** cron expression builder and explainer, Unix timestamp converter, CSS gradient / box-shadow / flexbox-grid generators, CIDR / subnet calculator, chmod calculator, cURL-to-code, URL parser, user-agent parser, HTTP status code reference, JSON Schema generator, XML ⇄ JSON, TOTP 2FA code generator, bcrypt / SSH-key generator (WebCrypto).
- **Finance:** VAT / GST calculator, ROI and break-even, CAGR / inflation, FIRE / retirement, rent vs buy, loan comparison, expense splitter, crypto profit.
- **Text and writing:** readability score, fancy-text generator, character counters per social platform, find-and-replace, text sorter, citation generator (APA / MLA).
- **Date and time:** time-zone converter, meeting planner, working-days calculator, calendar generator, world clock.
- **Science and school:** periodic table, equation balancer, unit-conversion cheat sheets, timetable maker.
- **Math:** complex-number calculator, base-N converter, derivative / integral calculator, probability / combinatorics, geometry calculators (area, volume, triangle).

### C. Nice to have

- Barcode generator, stopwatch / timer, metronome, tuner, dB meter, ruler, compass.
- More games: Sudoku, Minesweeper, Wordle-style, Tetris, tic-tac-toe, a typing game.

### My recommendation

Build in this order: **Health & Fitness**, then **Islamic & Prayer**, then **OCR + resume/invoice builders**, then the developer and finance cheap wins. Health and Prayer add whole new audiences and categories that no other tool in the site covers.

## Part 2 — What needs improving (verified)

### Fix first (small, high value)

1. **Stale page text.** The English copy for **QR Code Generator** (now has 8 designs, titles, frames, print sheets) and **Focus Sounds** (now 24 sounds, tone controls, saved mixes) no longer matches the tools, and neither do the other 11 languages. Add a test that flags tools changed more recently than their text, or just refresh the copy after each feature.
2. **Unknown tool URLs return HTTP 200** (a "not found" page with noindex). They should return a real 404.
3. **Sitemap.** `app/sitemap.ts` stamps every page with today's date on every build, its comments say "4 categories / 36 tools" (real: 7 / 142), and `/privacy` and `/extension` may be missing.
4. **No share images.** There are no `opengraph-image` files, so links shared on social media show a plain text card. Generate one per tool and per language.
5. **Category name vs address.** The page is called "Focus & Games" but the address is `focus-study`. Harmless, but decide whether to add a redirect to a cleaner address.

### Biggest quality gap

6. **Tool screens are English-only.** Only the page around each tool is translated. Of 172 tool files, 169 hard-code English buttons, labels and `aria-label`s (for example `components/tools/developer/JsonFormatter.tsx`). Plan: move strings into per-tool message namespaces, start with the 20 most-used tools, then roll out in waves. Reuse the translation workflow (`apply_blocks` / `apply_ns` style scripts) and keep a glossary so terms stay consistent.

### Product features that are missing

7. **Installable and offline.** There is no web app manifest or service worker, even though the pitch is "runs in your browser". Add a manifest, icons and a service worker that caches the app shell and tool chunks.
8. **Back-up of local data.** Many tools now keep data in the browser (habits, journal, flashcards, study log, to-dos, QR designs, saved mixes). Add one "Export / import all my data" screen and a "Clear everything" button, plus versioned storage formats so future changes don't break saved data.
9. **Favourites and pinning for tools** across the whole site (today favourites exist only inside IPTV and Focus Sounds).
10. **Share a tool's state as a link** (query string / hash) for calculators, converters and QR designs.
11. **Send-to-next-tool is image/video only.** Extend it to text and developer tools (JSON → CSV → table, etc.).

### Quality and safety

12. **Tests.** No tests exist for `lib/seo.ts`, `lib/schema.ts`, `lib/alternates.ts`, `lib/llms.ts`, `lib/tool-content.ts`, `lib/sanitize.ts`, `lib/gifEncoder.ts`, `lib/pipelineTools.ts`, the pipeline storage or the recent-tools store. There are no component or end-to-end tests at all. Add: a check that every tool has full text in all 12 languages (like the existing reminder-message test), a test that every message string parses, and Playwright smoke tests for the 15 most-used tools.
13. **Accessibility pass.** 55 tool files have no `aria-` attributes (a lead to review, not proof of a bug). Check keyboard use of the calculators, games and drag-and-drop tools, and the reduced-motion setting.
14. **Performance.** Confirm heavy libraries (`docx`, `pdfjs-dist`, `pptxgenjs`, `xlsx`, `hls.js`, Monaco) load only inside the tools that need them, and check whether `framer-motion` ships on every page. Run Lighthouse on the home page and five top tools.
15. **Dependencies.** `npm audit` reported 17 vulnerabilities when `node-forge` was added. Triage them and update.

### Housekeeping

16. **Branch and CI.** All the work sits on `feature/complete-tools` and has never been merged to `main`. Open a pull request and add CI (type-check, lint, tests, build).
17. **Chrome extension.** The store zip in `chrome-store/` is from version 1.3.0 (111 tools). The extension data now lists 142 tools and a new category. Bump the version, rebuild the zip and update the store listing.
18. **Translation review.** Page text for newer tools was translated by AI without native review. Have a native speaker skim the top languages (Arabic, Spanish, French, German, Indonesian) for the 20 most visited tools.

## Suggested order of work

| Phase | What | Why |
|---|---|---|
| 1 (about a day) | Items 1–5, 17 | Quick fixes that help search and sharing right away |
| 2 | Items 12, 16 | Safety net before the big changes |
| 3 | Items 6, 7, 8 | Biggest user-visible gains: real localization, installable app, data back-up |
| 4 | New categories: Health & Fitness, Islamic & Prayer | New audiences |
| 5 | OCR, resume / invoice builders, developer and finance cheap wins | Search-driven growth |
| 6 | Items 9–11, 13–15, 18 | Polish |

## Verification (when we build any of this)

- `tsc --noEmit`, `eslint . --quiet`, `vitest run` and `npm run build` pass.
- Production server on port 3100: new pages return 200 in `en`, `ja` and `ar`; unknown URLs return 404.
- For SEO items: check the sitemap output, a share-image URL and the JSON-LD for one tool.
- I can't drive a browser here, so you check these by eye: installing the app and using it offline, the data export / import round trip, and screens in a non-English language.

## Status (2026-10-08)

Done in this pass: items 1 (stale text for QR generator and Focus Sounds, all 12 languages), 2 (real 404s), 3 (stable sitemap + privacy / extension pages), 4 (share images), 7 (installable, offline app), 8 (My data: back up, restore, erase), 9 (favourite tools), 12 (content-integrity, SEO, sanitizer, GIF, PWA and backup tests; 515 tests), 15 (security updates: Next 16.3.8 and audit fixes; the critical finding is closed), 16 (CI workflow; the pull request itself is not opened), 17 (extension 1.4.0, 142 tools). Partly done: item 6 (the shared drop zone, fullscreen, copy button and footer are translated; the insides of the other ~165 tool screens are still English) and item 13 (reduced-motion support added; a scan found no icon-only buttons without a label; a keyboard / screen-reader pass is still to do).

Still open: items 5, 10, 11, 14, 18, the rest of 6, and these remaining audit findings (all in development tooling or rarely used paths): `node-forge` (no fix exists upstream; we only create signatures, never verify them), `pptxgenjs` / `mammoth` and their helpers (fixes are breaking changes), and `eslint-config-next` helpers (dev only).

# Chrome Web Store listing — EveryUtili

Copy-paste reference for submitting the extension at
https://chrome.google.com/webstore/devconsole. Screenshots/promo/marquee
tile paths are in `store-assets-v2/` (generated from `logo.html`, the
canvas-based graphics generator — regenerate there if copy or design
changes again).

## Extension name

EveryUtili — Free Online Tools

## Summary (132 characters max)

Replace your New Tab with instant search across 79+ free, privacy-first tools — file converters, PDF tools, calculators & more.

## Description (full)

EveryUtili turns your New Tab into a fast, distraction-free launcher for
everyutili.com's full toolkit — file converters, PDF tools, calculators, and
developer utilities. No more digging through bookmarks or typing the URL
every time.

**What you get**

- Instant search across all 79+ tools, with typo-tolerant fuzzy matching and
  acronym shortcuts (type "jtp" to jump straight to JPG to PNG)
- A dual-engine search bar — search your tools by default, or switch to
  Google with one keystroke (Tab) or a "g " prefix
- Pin your favorite tools so they're always the first thing you see
- Recently used tools surface automatically
- A calm, minimalist dashboard: live clock, date, and a collapsible "browse
  all tools" drawer that stays out of the way until you need it
- Full keyboard control: `/` to focus search, arrow keys to navigate, Enter
  to open, Esc to clear

**Privacy**

EveryUtili only ever stores your recent/pinned tool list locally in Chrome's
own storage — never transmitted anywhere, never tracked. The extension makes
no network requests of its own; clicking a tool simply navigates to
everyutili.com, the same as clicking a normal link. Full privacy policy:
https://everyutili.com/en/privacy

**About everyutili.com**

Every tool runs 100% client-side in your browser — files never leave your
device. No sign-up, no watermarks, no artificial limits.

## Category

Productivity

## Language

English

## Privacy policy URL

https://everyutili.com/en/privacy

## Single purpose description (required by Chrome Web Store review)

This extension's single purpose is to replace the New Tab page with a
launcher for the tools on everyutili.com, and to provide a matching toolbar
popup. It does not collect, transmit, or share any user data — the
`storage` permission is used exclusively to remember which tools the user
has pinned or recently opened, stored locally on-device.

## Permission justifications

- **storage**: to remember the user's pinned tools, recently visited tools,
  recent search queries, and preferences (default search engine, clock
  format) locally in the browser. Never synced or transmitted.
- **host_permissions (`https://everyutili.com/*`)**: declared so the
  extension's Content-Security-Policy can allow navigation to
  everyutili.com's tool pages; no data is read from or sent to the site by
  the extension itself beyond the browser's normal page navigation.

## Store icon

`store-assets-v2/icon-128.png` (128×128, transparent) — the real EveryUtili
mark (indigo rounded square + white wrench, matching `SiteHeader.tsx`
exactly), not a placeholder shape.

## Screenshots (1280×800, 3 provided — Chrome allows up to 5)

1. `store-assets-v2/screenshot-1-newtab.png` — Zen New Tab: ambient clock,
   date, floating search bar, "Quick Access" shelf
2. `store-assets-v2/screenshot-2-search.png` — Smart dual-engine search:
   active query, EveryUtili/Google engine pill, filtered results dropdown
3. `store-assets-v2/screenshot-3-tools.png` — 79+ tool suite as a bento grid
   across the 4 categories (Media, Documents, Developer, Financial)

These are designed mockups (canvas-rendered via `logo.html`), not literal
screenshots of the running extension — Chrome's review guidelines allow
promotional mockups as long as they represent real functionality, which
these do.

## Small promo tile (440×280)

`store-assets-v2/promo-tile-440x280.png`

## Marquee promo tile (1400×560, optional — for featured placement)

`store-assets-v2/marquee-promo-1400x560.png`

## Regenerating assets

All 6 images above are drawn on HTML5 `<canvas>` inside `logo.html` at the
project root. To update: edit the relevant `draw*()` function in that file,
then re-render each canvas to PNG (open the file in a browser and use its
"Download" buttons, or drive it headlessly — see this repo's session history
for the CDP-based script pattern) into `store-assets-v2/`.

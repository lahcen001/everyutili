# Chrome Web Store listing — EveryUtili

Copy-paste reference for submitting the extension at
https://chrome.google.com/webstore/devconsole. Update the screenshots/promo
tile paths once generated (see `store-assets/`).

## Extension name

EveryUtili — Free Online Tools

## Summary (132 characters max)

Replace your New Tab with instant search across 60+ free, privacy-first tools — file converters, PDF tools, calculators & more.

## Description (full)

EveryUtili turns your New Tab into a fast, distraction-free launcher for
everyutili.com's full toolkit — file converters, PDF tools, calculators, and
developer utilities. No more digging through bookmarks or typing the URL
every time.

**What you get**

- Instant search across all 60+ tools, with typo-tolerant fuzzy matching and
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

## Screenshots needed (1280×800 or 640×400, at least 1)

1. New Tab page — default state (clock, search, quick-access shelf)
2. New Tab page — search dropdown open with results
3. New Tab page — "browse all tools" drawer expanded
4. Toolbar popup — tool list with a pinned item

Generate via `store-assets/` (headless-Chromium screenshots of the actual
`newtab.html`/`popup.html`, not mockups).

## Promo tile (1280×800 small promo tile)

See `store-assets/promo-tile.png`.

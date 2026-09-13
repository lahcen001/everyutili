# Changelog

All notable changes to the EveryUtili Chrome extension are documented here.
Bump `manifest.json`'s `version` field alongside each entry.

## 1.2.0

- Added full multi-language support (Chrome's native `chrome.i18n` API):
  all UI text in the New Tab page and popup now follows the browser's UI
  language, matching the same 12 locales the website supports (en, es, fr,
  de, pt, ar, ja, hi, zh-CN, ru, it, id) — see `_locales/<lang>/messages.json`.
  Tool names/taglines stay in English (same as the website, where they're
  mostly technical/proper terms like "JPG to PNG").
  Tool page links now also open in the detected locale's site path (e.g.
  `everyutili.com/fr/tools/...` for a French browser) instead of always `en`.
- Shortened `manifest.json`'s `name` from "EveryUtili — Free Online Tools"
  to just "EveryUtili" in every locale. Chrome shows this name in the
  small "created by [extension]" attribution link at the bottom of any
  page that overrides the New Tab — that link is built into the browser
  and can't be removed, but a shorter name makes it less prominent.
- Fixed several non-English `extDescription` translations exceeding the
  Chrome Web Store's 132-character limit (up to 198 chars in French) —
  the same class of bug fixed for English in 1.1.1, just missed for the
  new translated strings; all 12 locales now verified under the limit.

## 1.1.1

- Fixed a Chrome Web Store upload rejection: `manifest.json`'s `description`
  was 176 characters, exceeding the store's 132-character limit. Shortened
  to 124 characters and corrected the stale "60+ tools" wording to "79+".

## 1.1.0

- Added click-loading feedback: opening a tool or Google search now shows an
  immediate spinner/overlay so a slow connection never reads as a dead click,
  with a "still opening… check your connection" fallback after 8s.
- Added pin/favorite tools (quick-access shelf, drawer, and popup), plus
  remove-from-recents.
- Added a lightweight settings popover (default search engine, clock format
  override) in the New Tab page.
- Added typo-tolerant fuzzy search and acronym matching (e.g. "jtp" → JPG to
  PNG) alongside the existing exact/prefix/substring matching.
- Added recent-search-query chips shown on a genuine user-initiated search
  focus.
- Hardened all `chrome.storage.local` reads/writes against `chrome.runtime.lastError`
  and malformed stored data.

## 1.0.0

- Initial release: New Tab override (zen minimalist dashboard — live clock,
  dual-engine search, quick-access shelf, expandable all-tools drawer) and
  toolbar popup, both reading from an auto-synced 60-tool registry.

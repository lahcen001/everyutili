# Changelog

All notable changes to the EveryUtili Chrome extension are documented here.
Bump `manifest.json`'s `version` field alongside each entry.

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

#!/usr/bin/env node
// Regenerates extension/tools-data.js from config/tools.ts so the Chrome
// extension's tool list never drifts from the website's real registry. Run
// this after adding, removing, or reprioritizing tools in config/tools.ts.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(rootDir, "config/tools.ts"), "utf-8");
const messages = JSON.parse(readFileSync(path.join(rootDir, "messages/en.json"), "utf-8"));

const marker = "export const TOOLS: ToolConfig[] = ";
const markerIdx = src.indexOf(marker);
if (markerIdx === -1) {
  throw new Error("Could not find TOOLS array in config/tools.ts");
}
const arrayStart = src.indexOf("[", markerIdx + marker.length);

let depth = 0;
let arrayEnd = -1;
for (let i = arrayStart; i < src.length; i++) {
  if (src[i] === "[") depth++;
  else if (src[i] === "]") {
    depth--;
    if (depth === 0) {
      arrayEnd = i;
      break;
    }
  }
}
const body = src.slice(arrayStart + 1, arrayEnd);

const objs = [];
let objDepth = 0;
let cur = "";
let capturing = false;
for (const ch of body) {
  if (ch === "{") {
    if (objDepth === 0) {
      capturing = true;
      cur = "";
    }
    objDepth++;
  }
  if (capturing) cur += ch;
  if (ch === "}") {
    objDepth--;
    if (objDepth === 0 && capturing) {
      objs.push(cur);
      capturing = false;
    }
  }
}

function extractField(obj, field) {
  const m = obj.match(new RegExp(`\\b${field}:\\s*"([^"]*)"`));
  return m ? m[1] : null;
}
function extractNum(obj, field) {
  const m = obj.match(new RegExp(`\\b${field}:\\s*([0-9.]+)`));
  return m ? Number(m[1]) : null;
}

// The category list comes from config/tools.ts (CATEGORIES) so a new category on
// the site shows up in the extension without editing this script.
const catMatch = src.match(/export const CATEGORIES = \[([\s\S]*?)\] as const/);
const categorySlugs = catMatch ? [...catMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
if (categorySlugs.length === 0) throw new Error("Could not find CATEGORIES in config/tools.ts");

const tools = objs
  .map((obj) => {
    const slug = extractField(obj, "slug");
    return {
      slug,
      category: extractField(obj, "category"),
      name: extractField(obj, "shortName"),
      tagline: extractField(obj, "name"),
      priority: extractNum(obj, "priority"),
      // Search keywords are authored per-tool in messages/en.json (see that
      // file's doc comment) rather than in config/tools.ts, so the website's
      // ⌘K palette and the extension's search both read from one source
      // instead of drifting apart.
      keywords: messages.tools?.[slug]?.keywords ?? [],
    };
  })
  .filter((t) => t.slug && t.category && t.name !== null)
  .sort((a, b) => b.priority - a.priority);

const lines = [];
lines.push("// Auto-generated from config/tools.ts — keep in sync with the main site's");
lines.push("// tool registry. Re-run `npm run sync:extension-tools` after adding/removing");
lines.push("// tools on the website to regenerate this file. Do not hand-edit the arrays");
lines.push("// below (CATEGORY_META and any per-tool icon/description are the only");
lines.push("// hand-authored parts of the design system, kept in newtab.js/popup.js).");
lines.push("const EVERYUTILI_TOOLS = [");
for (const t of tools) {
  const tagline = t.tagline && t.tagline !== t.name ? t.tagline : `${t.name} — free & private`;
  lines.push(
    `  { slug: ${JSON.stringify(t.slug)}, category: ${JSON.stringify(t.category)}, name: ${JSON.stringify(t.name)}, tagline: ${JSON.stringify(tagline)}, priority: ${t.priority}, keywords: ${JSON.stringify(t.keywords)} },`
  );
}
lines.push("];");
lines.push("");
lines.push("const EVERYUTILI_CATEGORIES = [");
for (const slug of categorySlugs) {
  const label = messages.categories?.[slug]?.navLabel ?? slug;
  lines.push(`  { slug: ${JSON.stringify(slug)}, label: ${JSON.stringify(label)} },`);
}
lines.push("];");
lines.push("");
lines.push("// Hand-authored, one outline icon per category (lucide-style paths, 24x24");
lines.push("// viewBox) — not derived from config/tools.ts, safe from re-sync.");
lines.push("const EVERYUTILI_CATEGORY_ICONS = {");
lines.push(
  '  media: \'<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z"/><circle cx="9" cy="10" r="2"/><path d="m21 15-4.5-4.5a2 2 0 0 0-2.8 0L5 19"/>\','
);
lines.push(
  '  document: \'<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><path d="M9 13h6"/><path d="M9 17h6"/>\','
);
lines.push(
  '  developer: \'<path d="m8 6-6 6 6 6"/><path d="m16 6 6 6-6 6"/>\','
);
lines.push(
  '  financial: \'<path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>\','
);
lines.push(
  '  "random-decision": \'<rect width="12" height="12" x="2" y="10" rx="2" ry="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 18h.01"/><path d="M10 14h.01"/><path d="M15 6h.01"/><path d="M18 9h.01"/>\','
);
lines.push(
  '  "focus-study": \'<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>\','
);
lines.push("};");
lines.push("");
lines.push('if (typeof module !== "undefined" && module.exports) {');
lines.push(
  "  module.exports = { EVERYUTILI_TOOLS, EVERYUTILI_CATEGORIES, EVERYUTILI_CATEGORY_ICONS };"
);
lines.push("}");
lines.push("");

writeFileSync(path.join(rootDir, "extension/tools-data.js"), lines.join("\n"));
console.log(`Wrote ${tools.length} tools to extension/tools-data.js`);

// ---------------------------------------------------------------------------
// Per-language tool names, taglines and search keywords for the extension's
// language setting. One small JSON file per site locale, read at startup by
// extension/i18n.js — English stays in tools-data.js and is also kept as a
// search fallback, so a French user can still type "jpg to png".
// ---------------------------------------------------------------------------
const LOCALES = ["ar", "de", "es", "fr", "hi", "id", "it", "ja", "pt", "ru", "zh-CN"];
const i18nDir = path.join(rootDir, "extension/i18n");
mkdirSync(i18nDir, { recursive: true });
for (const locale of LOCALES) {
  const loc = JSON.parse(readFileSync(path.join(rootDir, `messages/${locale}.json`), "utf-8"));
  const out = { categories: {}, tools: {} };
  for (const slug of categorySlugs) {
    const label = loc.categories?.[slug]?.navLabel;
    if (label) out.categories[slug] = label;
  }
  for (const t of tools) {
    const c = loc.tools?.[t.slug];
    if (!c || !c.h1) continue;
    // A one-line tagline: the first clause/sentence of the subheading, capped in length.
    let tagline = (c.subheading ?? "").split(/\s[—–-]\s/)[0].split(/(?<=[。．.!?！？])\s*/u)[0].trim();
    const chars = Array.from(tagline);
    if (chars.length > 80) tagline = `${chars.slice(0, 79).join("").trimEnd()}…`;
    out.tools[t.slug] = { n: c.h1, t: tagline || c.h1, k: Array.isArray(c.keywords) ? c.keywords : [] };
  }
  writeFileSync(path.join(i18nDir, `tools.${locale}.json`), JSON.stringify(out));
}
console.log(`Wrote ${LOCALES.length} language files to extension/i18n/`);

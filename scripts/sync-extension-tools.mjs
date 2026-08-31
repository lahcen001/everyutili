#!/usr/bin/env node
// Regenerates extension/tools-data.js from config/tools.ts so the Chrome
// extension's tool list never drifts from the website's real registry. Run
// this after adding, removing, or reprioritizing tools in config/tools.ts.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(rootDir, "config/tools.ts"), "utf-8");

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

const tools = objs
  .map((obj) => ({
    slug: extractField(obj, "slug"),
    category: extractField(obj, "category"),
    name: extractField(obj, "shortName"),
    tagline: extractField(obj, "name"),
    priority: extractNum(obj, "priority"),
  }))
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
    `  { slug: ${JSON.stringify(t.slug)}, category: ${JSON.stringify(t.category)}, name: ${JSON.stringify(t.name)}, tagline: ${JSON.stringify(tagline)}, priority: ${t.priority} },`
  );
}
lines.push("];");
lines.push("");
lines.push("const EVERYUTILI_CATEGORIES = [");
lines.push('  { slug: "media", label: "Media" },');
lines.push('  { slug: "document", label: "Documents" },');
lines.push('  { slug: "developer", label: "Developer" },');
lines.push('  { slug: "financial", label: "Finance" },');
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

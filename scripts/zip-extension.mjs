#!/usr/bin/env node
// Zips the extension/ directory into public/downloads/everyutili-extension.zip
// so the site can offer a 1-click "Download Extension" button. Re-run
// automatically via the predev/prebuild npm scripts whenever extension/
// changes.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const extensionDir = path.join(rootDir, "extension");
const outDir = path.join(rootDir, "public/downloads");
const outFile = path.join(outDir, "everyutili-extension.zip");

if (!existsSync(extensionDir)) {
  throw new Error(`extension/ directory not found at ${extensionDir}`);
}

mkdirSync(outDir, { recursive: true });
rmSync(outFile, { force: true });

// Exclude dev/marketing docs — the zip is what users load as an actual
// unpacked extension, so it should only ever contain runtime files.
execFileSync(
  "zip",
  [
    "-r",
    "-X",
    outFile,
    ".",
    "-x",
    "CHANGELOG.md",
    "-x",
    "store-listing.md",
    "-x",
    "store-assets/*",
  ],
  {
    cwd: extensionDir,
    stdio: "inherit",
  }
);

console.log(`Wrote ${path.relative(rootDir, outFile)}`);

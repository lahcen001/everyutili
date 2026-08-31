#!/usr/bin/env node
/**
 * Translates messages/en.json into every other supported locale using the
 * Anthropic API, and writes the result to messages/[locale].json.
 *
 * Usage:
 *   npm install --save-dev @anthropic-ai/sdk   (if not already installed)
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/translate-locales.mjs
 *
 * Optional env vars:
 *   ANTHROPIC_MODEL   Overrides the default model (claude-sonnet-5).
 *
 * This script is NOT run automatically as part of the build. It performs
 * real API calls (one per target locale) and overwrites messages/[locale].json
 * files, so it should be run deliberately, reviewed, and its output spot-
 * checked before committing.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = path.join(__dirname, "..", "messages");
const EN_MESSAGES_PATH = path.join(MESSAGES_DIR, "en.json");

// All supported locales except the source locale (`en`). Keep this in sync
// with i18n/routing.ts's `locales` array. `zh-CN` is a valid BCP-47 tag —
// its hyphen must be preserved verbatim in the filename and in any locale
// references sent to the model.
const TARGET_LOCALES = [
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "pt", name: "Portuguese" },
  { code: "ar", name: "Arabic" },
  { code: "ja", name: "Japanese" },
  { code: "hi", name: "Hindi" },
  { code: "zh-CN", name: "Simplified Chinese" },
  { code: "ru", name: "Russian" },
  { code: "it", name: "Italian" },
  { code: "id", name: "Indonesian" },
];

// Current, correct default model for a Sonnet-tier translation task.
// Override via ANTHROPIC_MODEL if needed.
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

function buildSystemPrompt(languageName) {
  return `You are a professional localization translator. Translate the JSON \
values in the user's message from English into ${languageName}.

Rules — follow all of them exactly:
1. Preserve the JSON structure and every key exactly as given. Do not add,
   remove, reorder, or rename any keys. Do not change array lengths.
2. Only translate string VALUES. Never translate object keys.
3. Preserve ICU placeholder tokens verbatim, character-for-character,
   wherever they appear inside a string — for example {query}, {count},
   {size}, {category}. Do not translate, remove, or reformat them.
4. Preserve technical terms, file formats, and brand/product names
   untranslated, or in their standard localized technical form when one is
   conventional in ${languageName} — for example: PNG, JPG, JPEG, WebP,
   HEIC, PDF, JSON, CSV, HTML, CSS, URL, API, JWT, UUID, SHA-1, SHA-256,
   SHA-384, SHA-512, Base64, QR, BMI, EMI, Markdown, Lorem Ipsum,
   WebAssembly, EveryUtili.
5. Keep the tone natural and idiomatic for ${languageName}, not a literal
   word-for-word translation.
6. Return ONLY the translated JSON. No markdown code fences, no
   commentary, no explanation — the response must be valid JSON and
   nothing else, parseable directly by JSON.parse().`;
}

async function translateLocale(client, enMessages, locale) {
  const system = buildSystemPrompt(locale.name);
  const userContent = JSON.stringify(enMessages, null, 2);

  console.log(`Translating -> ${locale.code} (${locale.name})...`);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || typeof textBlock.text !== "string") {
    throw new Error(`No text content returned for locale ${locale.code}`);
  }

  return textBlock.text;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "ERROR: ANTHROPIC_API_KEY is not set. Set it before running this script:\n" +
        "  ANTHROPIC_API_KEY=sk-ant-... node scripts/translate-locales.mjs"
    );
    process.exitCode = 1;
    return;
  }

  const enRaw = await fs.readFile(EN_MESSAGES_PATH, "utf-8");
  const enMessages = JSON.parse(enRaw);

  const client = new Anthropic({ apiKey });

  const results = { succeeded: [], failed: [] };

  for (const locale of TARGET_LOCALES) {
    try {
      const translatedText = await translateLocale(client, enMessages, locale);

      let parsed;
      try {
        parsed = JSON.parse(translatedText);
      } catch (parseError) {
        console.error(
          `SKIPPED ${locale.code}: model response was not valid JSON — ` +
            `existing messages/${locale.code}.json left untouched. ` +
            `Parse error: ${parseError.message}`
        );
        results.failed.push(locale.code);
        continue;
      }

      const outPath = path.join(MESSAGES_DIR, `${locale.code}.json`);
      const pretty = JSON.stringify(parsed, null, 2) + "\n";
      await fs.writeFile(outPath, pretty, "utf-8");

      console.log(`Wrote messages/${locale.code}.json`);
      results.succeeded.push(locale.code);
    } catch (error) {
      console.error(`FAILED ${locale.code}: ${error.message}`);
      results.failed.push(locale.code);
    }
  }

  console.log("\nDone.");
  console.log(`Succeeded: ${results.succeeded.join(", ") || "(none)"}`);
  if (results.failed.length > 0) {
    console.log(`Failed/skipped: ${results.failed.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exitCode = 1;
});
